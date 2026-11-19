import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireRoles, requireStaff } from '../middleware/auth.js';
import { DiningTable } from '../models/DiningTable.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order, type OrderDoc } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { ServiceRequest } from '../models/ServiceRequest.js';
import { User } from '../models/User.js';
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

  res.json({
    metrics: {
      menuItems,
      activeTables,
      newOrders,
      preparingOrders,
      totalSalesPaise: revenueSummary.totalSalesPaise,
      totalOrdersCount: revenueSummary.completedOrdersCount
    },
    topSellers,
    recentlyCompleted: recent.map((order) => ({
      id: String(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      totalPaise: order.totalPaise,
      updatedAt: order.updatedAt,
      tableLabel: labels.get(String(order.tableId)) ?? 'Table'
    }))
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
  contactEmail: z.union([z.literal(''), z.email().trim().toLowerCase()]).optional()
}).strict();
restaurantRouter.get('/settings', async (req, res) => {
  const restaurant = await Restaurant.findById(req.staff!.restaurantId).select('name slug description logoUrl brandColor bannerUrl welcomeTagline address contactPhone contactEmail active');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  res.json({ restaurant });
});
restaurantRouter.patch('/settings', requireRoles('owner'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError(400, 'INVALID_INPUT', parsed.success ? 'Provide at least one setting.' : parsed.error.issues[0]?.message ?? 'Invalid settings.');
  const restaurant = await Restaurant.findByIdAndUpdate(req.staff!.restaurantId, parsed.data, { returnDocument: 'after', runValidators: true }).select('name slug description logoUrl brandColor bannerUrl welcomeTagline address contactPhone contactEmail active');
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
tablesRouter.use(requireStaff, requireRoles('owner', 'staff'));

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
    let state: 'VACANT' | 'SEATED' | 'PREPARING' | 'READY' | 'HELP_NEEDED' | 'BILL_REQUESTED' = 'VACANT';

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
    }

    const totalActiveBillPaise = tableOrders.reduce((sum, o) => sum + o.totalPaise, 0);

    return {
      id: String(table._id),
      label: table.label,
      active: table.active,
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
tablesRouter.post('/', async (req, res) => {
  const parsed = z.object({ label: labelSchema }).strict().safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Enter a table label.');
  const table = await DiningTable.create({ restaurantId: req.staff!.restaurantId, label: parsed.data.label, qrToken: randomBytes(24).toString('base64url') });
  res.status(201).json({ table: { id: table.id, label: table.label, active: table.active, createdAt: table.createdAt } });
});
tablesRouter.patch('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const parsed = z.object({ label: labelSchema.optional(), active: z.boolean().optional() }).strict().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError(400, 'INVALID_INPUT', 'Provide a valid table label or active state.');
  const table = await DiningTable.findOneAndUpdate(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }), parsed.data, { returnDocument: 'after', runValidators: true }).select('-qrToken');
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  res.json({ table });
});
tablesRouter.delete('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const table = await DiningTable.findOneAndUpdate(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }), { active: false }, { returnDocument: 'after', runValidators: true }).select('-qrToken');
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  res.status(204).end();
});
tablesRouter.post('/:id/qr', requireRoles('owner', 'staff'), async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid table identifier.');
  const table = await DiningTable.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }));
  if (!table) throw new AppError(404, 'NOT_FOUND', 'Table not found.');
  const restaurant = await Restaurant.findById(req.staff!.restaurantId).select('name');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  const url = `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/order/${table.qrToken}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#171714', light: '#FFFFFF' } });
  res.json({ qrCode: dataUrl, url, restaurantName: restaurant.name, tableLabel: table.label });
});

export const staffRouter = Router();
staffRouter.use(requireStaff, requireRoles('owner'));
staffRouter.get('/', async (req, res) => {
  const users = await User.find(tenantFilter(req.staff!.restaurantId)).select('name email role active createdAt').sort({ createdAt: 1 }).lean();
  res.json({ users });
});
staffRouter.post('/', async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(10).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
    role: z.enum(['staff', 'kitchen'])
  }).strict().safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check the staff details.');
  if (await User.exists({ email: parsed.data.email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
  const user = await User.create({
    restaurantId: req.staff!.restaurantId,
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role
  });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt } });
});
staffRouter.patch('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid staff account identifier.');
  const parsed = z.object({ active: z.boolean() }).strict().safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Choose whether this account is active.');
  const user = await User.findOneAndUpdate(tenantFilter(req.staff!.restaurantId, { _id: req.params.id, role: { $in: ['staff', 'kitchen'] } }), parsed.data, { returnDocument: 'after', runValidators: true }).select('name email role active createdAt');
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Staff account not found.');
  res.json({ user });
});
