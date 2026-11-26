import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requirePermission, requireRoles, requireStaff } from '../middleware/auth.js';
import { CustomerSession } from '../models/CustomerSession.js';
import { DiningTable } from '../models/DiningTable.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order, type OrderDoc } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { ServiceRequest } from '../models/ServiceRequest.js';
import { TableCart } from '../models/TableCart.js';
import { User, getDefaultPermissions, type UserDoc, type UserPermissions, type UserRole } from '../models/User.js';
import { getOrderSocket } from './orders.js';
import { saveMenuImage } from '../services/imageStorage.js';
import { hashPassword } from '../services/password.js';
import { AppError } from '../utils/errors.js';
import { labelSchema, objectIdSchema } from '../utils/validation.js';
import { tenantFilter } from '../utils/tenant.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

export const restaurantRouter = Router();
restaurantRouter.use(requireStaff);

restaurantRouter.get('/dashboard', async (req, res) => {
  const restaurantId = req.staff!.restaurantId;
  const [menuItems, activeTables, newOrders, preparingOrders, completed, topItemsAgg, revenueAgg] = await Promise.all([
    MenuItem.countDocuments({ restaurantId }),
    DiningTable.countDocuments(tenantFilter(restaurantId, { active: true })),
    Order.countDocuments(tenantFilter(restaurantId, { status: 'NEW' })),
    Order.countDocuments(tenantFilter(restaurantId, { status: { $in: ['ACCEPTED', 'PREPARING'] } })),
    Order.find(tenantFilter(restaurantId, { status: { $in: ['DELIVERED', 'REJECTED'] } })).sort({ updatedAt: -1 }).limit(8),
    Order.aggregate([
      { $match: { restaurantId, status: { $ne: 'REJECTED' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItemId',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenuePaise: { $sum: '$items.subtotalPaise' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]),
    Order.aggregate([
      { $match: { restaurantId, status: { $ne: 'REJECTED' } } },
      {
        $group: {
          _id: null,
          totalSalesPaise: { $sum: '$totalPaise' },
          completedOrdersCount: { $sum: 1 }
        }
      }
    ])
  ]);
  const recent = completed as unknown as OrderDoc[];
  const labels = new Map((await DiningTable.find({ _id: { $in: recent.map((order) => order.tableId) }, restaurantId }).select('_id label').lean()).map((table) => [String(table._id), table.label]));
  
  const revenueSummary = revenueAgg[0] || { totalSalesPaise: 0, completedOrdersCount: 0 };
  const topSellers = topItemsAgg.map((item) => ({
    menuItemId: String(item._id),
    name: item.name,
    totalQuantity: item.totalQuantity,
    totalRevenuePaise: item.totalRevenuePaise
  }));

  const canViewFinancials = req.staff?.role === 'owner' || Boolean(req.staff?.permissions?.canViewFinancials);

  res.json({
    metrics: {
      menuItems,
      activeTables,
      newOrders,
      preparingOrders,
      totalSalesPaise: canViewFinancials ? revenueSummary.totalSalesPaise : 0,
      totalOrdersCount: revenueSummary.completedOrdersCount,
      financialsHidden: !canViewFinancials
    },
    topSellers: canViewFinancials ? topSellers : topSellers.map((item) => ({ ...item, totalRevenuePaise: 0 })),
    recentlyCompleted: recent.map((order) => ({
      id: String(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      totalPaise: canViewFinancials ? order.totalPaise : 0,
      updatedAt: order.updatedAt,
      tableLabel: labels.get(String(order.tableId)) ?? 'Table'
    }))
  });
});

restaurantRouter.get('/day-close', requirePermission('canCloseRegister'), async (req, res) => {
  const restaurantId = req.staff!.restaurantId;
  const restaurant = await Restaurant.findById(restaurantId).select('name gstin gstPercentage');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');

  const dateParam = typeof req.query.date === 'string' ? req.query.date : '';
  let targetDate = new Date();
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split('-').map(Number);
    targetDate = new Date(Date.UTC(y!, m! - 1, d!));
  }

  const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

  const orders = await Order.find({
    restaurantId,
    $or: [
      { settledAt: { $gte: startOfDay, $lte: endOfDay } },
      { settledAt: null, createdAt: { $gte: startOfDay, $lte: endOfDay } }
    ]
  }).sort({ createdAt: -1 }) as unknown as OrderDoc[];

  const tableLabels = new Map(
    (await DiningTable.find({ _id: { $in: orders.map((o) => o.tableId) }, restaurantId }).select('_id label').lean())
      .map((t) => [String(t._id), t.label])
  );

  let grossSalesPaise = 0;
  let totalDiscountsPaise = 0;
  let netSalesPaise = 0;
  let paidOrders = 0;
  let unpaidOrders = 0;
  let rejectedOrders = 0;
  let totalItemsSold = 0;

  const tenders = {
    cashPaise: 0,
    upiPaise: 0,
    cardPaise: 0,
    otherPaise: 0,
    unpaidPaise: 0
  };

  const settledOrdersList: Array<{
    id: string;
    orderNumber: string;
    tableLabel: string;
    totalPaise: number;
    discountPaise: number;
    finalPaidPaise: number;
    paymentStatus: string;
    paymentMethod: string | null;
    settledAt: string | null;
    createdAt: string;
  }> = [];

  for (const o of orders) {
    if (o.status === 'REJECTED') {
      rejectedOrders += 1;
      continue;
    }

    const itemsCount = o.items.reduce((acc, it) => acc + it.quantity, 0);
    totalItemsSold += itemsCount;

    if (o.paymentStatus === 'PAID') {
      paidOrders += 1;
      grossSalesPaise += o.totalPaise;
      const discount = o.discountPaise || 0;
      totalDiscountsPaise += discount;
      const paid = o.finalPaidPaise ?? Math.max(0, o.totalPaise - discount);
      netSalesPaise += paid;

      const method = o.paymentMethod || 'OTHER';
      if (method === 'CASH') tenders.cashPaise += paid;
      else if (method === 'UPI') tenders.upiPaise += paid;
      else if (method === 'CARD') tenders.cardPaise += paid;
      else tenders.otherPaise += paid;

      settledOrdersList.push({
        id: String(o._id),
        orderNumber: o.orderNumber,
        tableLabel: tableLabels.get(String(o.tableId)) ?? 'Table',
        totalPaise: o.totalPaise,
        discountPaise: discount,
        finalPaidPaise: paid,
        paymentStatus: 'PAID',
        paymentMethod: o.paymentMethod ?? 'OTHER',
        settledAt: o.settledAt ? o.settledAt.toISOString() : o.updatedAt.toISOString(),
        createdAt: o.createdAt.toISOString()
      });
    } else {
      unpaidOrders += 1;
      tenders.unpaidPaise += o.totalPaise;
      settledOrdersList.push({
        id: String(o._id),
        orderNumber: o.orderNumber,
        tableLabel: tableLabels.get(String(o.tableId)) ?? 'Table',
        totalPaise: o.totalPaise,
        discountPaise: 0,
        finalPaidPaise: 0,
        paymentStatus: 'UNPAID',
        paymentMethod: null,
        settledAt: null,
        createdAt: o.createdAt.toISOString()
      });
    }
  }

  const gstPercentage = restaurant.gstPercentage ?? 5;
  const taxableAmountPaise = gstPercentage > 0
    ? Math.round((netSalesPaise * 100) / (100 + gstPercentage))
    : netSalesPaise;
  const totalGstPaise = netSalesPaise - taxableAmountPaise;
  const cgstPaise = Math.round(totalGstPaise / 2);
  const sgstPaise = totalGstPaise - cgstPaise;
  const averageOrderValuePaise = paidOrders > 0 ? Math.round(netSalesPaise / paidOrders) : 0;

  res.json({
    report: {
      date: startOfDay.toISOString().slice(0, 10),
      restaurantName: restaurant.name,
      gstin: restaurant.gstin || '',
      gstPercentage,
      grossSalesPaise,
      totalDiscountsPaise,
      netSalesPaise,
      taxableAmountPaise,
      cgstPaise,
      sgstPaise,
      tenders,
      orderCounts: {
        totalOrders: paidOrders + unpaidOrders,
        paidOrders,
        unpaidOrders,
        rejectedOrders,
        totalItemsSold,
        averageOrderValuePaise
      },
      settledOrders: settledOrdersList
    }
  });
});

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().max(2048).refine((value) => !value || value.startsWith('/uploads/') || /^https:\/\//i.test(value), 'Use an HTTPS URL or uploaded image').optional(),
  brandColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Provide a valid hex color code (e.g. #315b43)').optional(),
  bannerUrl: z.string().trim().max(2048).refine((value) => !value || value.startsWith('/uploads/') || /^https:\/\//i.test(value), 'Use an HTTPS URL or uploaded image').optional(),
  welcomeTagline: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.union([z.literal(''), z.email().trim().toLowerCase()]).optional(),
  gstin: z.string().trim().max(15).optional(),
  gstPercentage: z.number().min(0).max(28).optional(),
  upiId: z.string().trim().max(100).optional(),
  requireCustomerOtp: z.boolean().optional(),
  googleReviewUrl: z.string().trim().max(2048).optional(),
  autoConfirmPayments: z.boolean().optional(),
  paymentGateway: z.enum(['direct_upi', 'razorpay', 'cashfree', 'custom']).optional(),
  gatewayKeyId: z.string().trim().max(200).optional(),
  gatewayKeySecret: z.string().trim().max(200).optional(),
  webhookSecret: z.string().trim().max(200).optional(),
  enableDishReviews: z.boolean().optional()
}).strict();
restaurantRouter.get('/settings', async (req, res) => {
  const restaurant = await Restaurant.findById(req.staff!.restaurantId)
    .select('name slug description logoUrl brandColor bannerUrl welcomeTagline address contactPhone contactEmail gstin gstPercentage upiId requireCustomerOtp googleReviewUrl autoConfirmPayments paymentGateway gatewayKeyId webhookSecret enableDishReviews active')
    .lean();
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  // Never expose gateway secret to frontend; only expose webhook secret to restaurant owner
  if (req.staff?.role !== 'owner') {
    (restaurant as Record<string, unknown>).webhookSecret = '';
  }
  res.json({ restaurant });
});
restaurantRouter.patch('/settings', requireRoles('owner'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError(400, 'INVALID_INPUT', parsed.success ? 'Provide at least one setting.' : parsed.error.issues[0]?.message ?? 'Invalid settings.');
  const restaurant = await Restaurant.findByIdAndUpdate(req.staff!.restaurantId, parsed.data, { returnDocument: 'after', runValidators: true })
    .select('name slug description logoUrl brandColor bannerUrl welcomeTagline address contactPhone contactEmail gstin gstPercentage upiId requireCustomerOtp googleReviewUrl autoConfirmPayments paymentGateway gatewayKeyId webhookSecret enableDishReviews active')
    .lean();
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  res.json({ restaurant });
});

restaurantRouter.post('/logo', requireRoles('owner'), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const file = files?.logo?.[0] || files?.image?.[0];
  if (!file) throw new AppError(400, 'IMAGE_REQUIRED', 'Choose an image file to upload.');
  const logoUrl = await saveMenuImage(file.buffer);
  const restaurant = await Restaurant.findByIdAndUpdate(
    req.staff!.restaurantId,
    { logoUrl },
    { returnDocument: 'after' }
  ).select('name slug description logoUrl brandColor bannerUrl welcomeTagline address contactPhone contactEmail active');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  res.json({ restaurant, logoUrl });
});

restaurantRouter.post('/banner', requireRoles('owner'), upload.fields([{ name: 'banner', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const file = files?.banner?.[0] || files?.image?.[0];
  if (!file) throw new AppError(400, 'IMAGE_REQUIRED', 'Choose an image file to upload.');
  const bannerUrl = await saveMenuImage(file.buffer);
  const restaurant = await Restaurant.findByIdAndUpdate(
    req.staff!.restaurantId,
    { bannerUrl },
    { returnDocument: 'after' }
  ).select('name slug description logoUrl brandColor bannerUrl welcomeTagline address contactPhone contactEmail active');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  res.json({ restaurant, bannerUrl });
});

restaurantRouter.get('/service-requests', async (req, res) => {
  const requests = await ServiceRequest.find(tenantFilter(req.staff!.restaurantId, { status: 'PENDING' }))
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  const tables = new Map(
    (await DiningTable.find({ _id: { $in: requests.map((r) => r.tableId) }, restaurantId: req.staff!.restaurantId }).select('_id label').lean())
      .map((t) => [String(t._id), t.label])
  );
  res.json({
    requests: requests.map((r) => ({
      id: String(r._id),
      type: r.type,
      tableLabel: tables.get(String(r.tableId)) ?? 'Table',
      notes: r.notes,
      createdAt: r.createdAt
    }))
  });
});

restaurantRouter.patch('/service-requests/:id/resolve', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid request identifier.');
  const request = await ServiceRequest.findOneAndUpdate(
    tenantFilter(req.staff!.restaurantId, { _id: req.params.id }),
    { $set: { status: 'RESOLVED', resolvedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Service request not found.');
  res.json({ success: true, id: String(request._id) });
});

export const tablesRouter = Router();
tablesRouter.use(requireStaff);

tablesRouter.get('/live-status', async (req, res) => {
  const restaurantId = req.staff!.restaurantId;

  // 1. Fetch all tables
  const tables = await DiningTable.find(tenantFilter(restaurantId))
    .sort({ label: 1, createdAt: 1 })
    .select('-qrToken')
    .lean();

  const tableIds = tables.map((t) => t._id);

  // 2. Fetch active assistance requests (PENDING)
  const pendingRequests = await ServiceRequest.find({
    restaurantId,
    tableId: { $in: tableIds },
    status: 'PENDING'
  }).sort({ createdAt: -1 }).lean();

  const requestByTable = new Map<string, { id: string; type: string; notes?: string; createdAt: Date }>();
  for (const reqItem of pendingRequests) {
    const tid = String(reqItem.tableId);
    if (!requestByTable.has(tid)) {
      requestByTable.set(tid, {
        id: String(reqItem._id),
        type: reqItem.type,
        notes: reqItem.notes,
        createdAt: reqItem.createdAt
      });
    }
  }

  // 3. Fetch active orders (NEW, ACCEPTED, PREPARING, READY)
  const activeOrders = await Order.find({
    restaurantId,
    tableId: { $in: tableIds },
    status: { $in: ['NEW', 'ACCEPTED', 'PREPARING', 'READY'] }
  }).sort({ createdAt: -1 }).lean();

  const ordersByTable = new Map<string, typeof activeOrders>();
  for (const ord of activeOrders) {
    const tid = String(ord.tableId);
    if (!ordersByTable.has(tid)) {
      ordersByTable.set(tid, []);
    }
    ordersByTable.get(tid)!.push(ord);
  }

  // 4. Construct live status summary per table
  const tableStatuses = tables.map((table) => {
    const tid = String(table._id);
    const pendingRequest = requestByTable.get(tid);
    const tableOrders = ordersByTable.get(tid) || [];

    // Derive status
    let state: 'VACANT' | 'NEEDS_CLEARING' | 'SEATED' | 'PREPARING' | 'READY' | 'HELP_NEEDED' | 'BILL_REQUESTED' = 'VACANT';

    if (pendingRequest?.type === 'BILL') {
      state = 'BILL_REQUESTED';
    } else if (pendingRequest) {
      state = 'HELP_NEEDED';
    } else if (tableOrders.some((o) => o.status === 'READY')) {
      state = 'READY';
    } else if (tableOrders.some((o) => ['ACCEPTED', 'PREPARING'].includes(o.status))) {
      state = 'PREPARING';
    } else if (tableOrders.some((o) => o.status === 'NEW')) {
      state = 'SEATED';
    } else if (table.needsClearing) {
      state = 'NEEDS_CLEARING';
    }

    const totalActiveBillPaise = tableOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    return {
      id: String(table._id),
      label: table.label,
      active: table.active,
      needsClearing: Boolean(table.needsClearing),
      state,
      pendingRequest: pendingRequest ? {
        id: pendingRequest.id,
        type: pendingRequest.type,
        notes: pendingRequest.notes,
        createdAt: pendingRequest.createdAt
      } : null,
      orders: tableOrders.map((o) => ({
        id: String(o._id),
        orderNumber: o.orderNumber,
        status: o.status,
        totalPaise: o.totalPaise,
        items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, subtotalPaise: i.subtotalPaise })),
        createdAt: o.createdAt
      })),
      totalBillPaise: totalActiveBillPaise
    };
  });

  res.json({ tables: tableStatuses });
});

tablesRouter.get('/', async (req, res) => {
  const tables = await DiningTable.find(tenantFilter(req.staff!.restaurantId)).sort({ createdAt: 1, label: 1 }).select('-qrToken').lean();
  res.json({ tables });
});
tablesRouter.post('/', requireRoles('owner', 'manager', 'staff'), async (req, res) => {
  const parsed = z.object({ label: labelSchema }).strict().safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Enter a table label.');
  const table = await DiningTable.create({ restaurantId: req.staff!.restaurantId, label: parsed.data.label, qrToken: randomBytes(24).toString('base64url') });
  res.status(201).json({ table: { id: table.id, label: table.label, active: table.active, createdAt: table.createdAt } });
});
tablesRouter.patch('/:id', requireRoles('owner', 'manager', 'staff'), async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const parsed = z.object({ label: labelSchema.optional(), active: z.boolean().optional() }).strict().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError(400, 'INVALID_INPUT', 'Provide a valid table label or active state.');
  const table = await DiningTable.findOneAndUpdate(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }), parsed.data, { returnDocument: 'after', runValidators: true }).select('-qrToken');
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  res.json({ table });
});
tablesRouter.delete('/:id', requireRoles('owner', 'manager', 'staff'), async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const table = await DiningTable.findOneAndUpdate(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }), { active: false }, { returnDocument: 'after', runValidators: true }).select('-qrToken');
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  res.status(204).end();
});
tablesRouter.post('/:id/vacate', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const table = await DiningTable.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }));
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');

  // 1. Mark table clean and ready, reset Table PIN defense
  table.needsClearing = false;
  table.clearedAt = new Date();
  table.clearedBy = req.staff!.id as unknown as import('mongoose').Types.ObjectId;
  table.currentPin = null;
  table.currentPinExpiresAt = null;
  await table.save();

  // 2. Revoke all active customer sessions for this table
  await CustomerSession.updateMany(
    { tableId: table._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  // 3. Clear all shared table carts and separate tabs
  await TableCart.deleteMany({ tableId: table._id });

  // 4. Resolve any outstanding service requests for this table
  await ServiceRequest.updateMany(
    { tableId: table._id, status: 'PENDING' },
    { $set: { status: 'RESOLVED', resolvedAt: new Date() } }
  );

  // 5. Broadcast real-time socket events
  const socket = getOrderSocket();
  socket?.to(`table:${table._id}`).emit('table:vacated', {
    tableId: String(table._id),
    tableLabel: table.label,
    message: 'This dining visit has been completed. The table is now clear.'
  });
  socket?.to(`restaurant:${req.staff!.restaurantId}`).emit('table:vacated', {
    tableId: String(table._id),
    tableLabel: table.label,
    clearedAt: table.clearedAt
  });

  res.json({
    success: true,
    table: {
      id: String(table._id),
      label: table.label,
      state: 'VACANT',
      needsClearing: false
    }
  });
});
tablesRouter.post('/:id/mark-clearing', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const table = await DiningTable.findOneAndUpdate(
    tenantFilter(req.staff!.restaurantId, { _id: req.params.id }),
    { $set: { needsClearing: true } },
    { returnDocument: 'after' }
  );
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');

  const socket = getOrderSocket();
  socket?.to(`restaurant:${req.staff!.restaurantId}`).emit('table:clearing_needed', {
    tableId: String(table._id),
    tableLabel: table.label,
    needsClearing: true
  });

  res.json({
    success: true,
    table: {
      id: String(table._id),
      label: table.label,
      state: 'NEEDS_CLEARING',
      needsClearing: true
    }
  });
});
export function resolvePublicAppUrl(req: import('express').Request): string {
  const host = req.get('host');
  if (host) {
    if (host.startsWith('projectqr-preview.') || host.startsWith('mesa-preview.')) {
      return 'https://trymesa.onrender.com';
    }
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    return `${proto}://${host}`;
  }
  return env.PUBLIC_APP_URL.replace(/\/$/, '');
}

tablesRouter.post('/:id/qr', requireRoles('owner', 'manager', 'staff'), async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const table = await DiningTable.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }));
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  const restaurant = await Restaurant.findById(req.staff!.restaurantId).select('name brandColor logoUrl welcomeTagline');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  const baseUrl = resolvePublicAppUrl(req);
  const url = `${baseUrl}/order/${table.qrToken}`;
  const brandDark = restaurant.brandColor && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(restaurant.brandColor)
    ? restaurant.brandColor
    : '#171714';
  const dataUrl = await QRCode.toDataURL(url, {
    width: 640,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: brandDark, light: '#FFFFFF' }
  });
  res.json({
    qrCode: dataUrl,
    url,
    restaurantName: restaurant.name,
    tableLabel: table.label,
    brandColor: brandDark,
    logoUrl: restaurant.logoUrl || '',
    welcomeTagline: restaurant.welcomeTagline || ''
  });
});

const permissionSchema = z.object({
  canViewFinancials: z.boolean().optional(),
  canEditMenu: z.boolean().optional(),
  canManageStock: z.boolean().optional(),
  canSettleBills: z.boolean().optional(),
  canPunchOrders: z.boolean().optional(),
  canManageReviews: z.boolean().optional(),
  canCloseRegister: z.boolean().optional()
});

export const staffRouter = Router();
staffRouter.use(requireStaff, requireRoles('owner'));

staffRouter.get('/', async (req, res) => {
  const users = await User.find(tenantFilter(req.staff!.restaurantId))
    .select('name email role permissions active createdAt')
    .sort({ createdAt: 1 })
    .lean();
  res.json({
    users: users.map((u) => ({
      ...u,
      id: String(u._id),
      permissions: (u.permissions && Object.keys(u.permissions).length > 0)
        ? u.permissions
        : getDefaultPermissions(u.role as UserRole)
    }))
  });
});

staffRouter.post('/', async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
    email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters').refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
    role: z.preprocess(
      (val) => typeof val === 'string' ? val.trim().toLowerCase() : val,
      z.enum(['manager', 'cashier', 'waiter', 'kitchen', 'staff'], { message: "Role must be 'manager', 'cashier', 'waiter', 'kitchen', or 'staff'" })
    ),
    permissions: permissionSchema.optional()
  }).safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check the staff details.');
  if (await User.exists({ email: parsed.data.email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');

  const role = parsed.data.role as UserRole;
  const permissions = {
    ...getDefaultPermissions(role),
    ...(parsed.data.permissions || {})
  };

  const user = await User.create({
    restaurantId: req.staff!.restaurantId,
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    role,
    permissions
  });

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      active: user.active,
      createdAt: user.createdAt
    }
  });
});

staffRouter.patch('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid staff account identifier.');
  const parsed = z.object({
    active: z.boolean().optional(),
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(['manager', 'cashier', 'waiter', 'kitchen', 'staff']).optional(),
    permissions: permissionSchema.optional()
  }).safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Check staff updates.');

  const existing = await User.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id, role: { $ne: 'owner' } }));
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Staff account not found or cannot be modified.');

  if (parsed.data.name !== undefined) existing.name = parsed.data.name;
  if (parsed.data.active !== undefined) existing.active = parsed.data.active;
  if (parsed.data.role !== undefined) {
    existing.role = parsed.data.role as UserRole;
    if (!parsed.data.permissions) {
      existing.permissions = getDefaultPermissions(existing.role);
    }
  }
  if (parsed.data.permissions !== undefined) {
    existing.permissions = {
      ...(existing.permissions || getDefaultPermissions(existing.role)),
      ...parsed.data.permissions
    };
  }

  await existing.save();

  res.json({
    user: {
      id: String(existing._id),
      name: existing.name,
      email: existing.email,
      role: existing.role,
      permissions: existing.permissions,
      active: existing.active,
      createdAt: (existing as unknown as { createdAt: Date }).createdAt
    }
  });
});

staffRouter.delete('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid staff account identifier.');
  const user = await User.findOneAndDelete(tenantFilter(req.staff!.restaurantId, { _id: req.params.id, role: { $ne: 'owner' } }));
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Staff account not found or cannot be deleted.');
  res.json({ success: true, message: 'Staff account removed successfully.' });
});
