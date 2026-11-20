import { randomInt } from 'node:crypto';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { z } from 'zod';
import { requireCustomer, requireCustomerQr, requireRoles, requireStaff } from '../middleware/auth.js';
import { CustomerSession } from '../models/CustomerSession.js';
import { DiningTable } from '../models/DiningTable.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order, orderStatuses, type OrderDoc, type OrderStatus } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { TableCart } from '../models/TableCart.js';
import { AppError } from '../utils/errors.js';
import { calculateSubtotal, nextOrderStatus } from '../utils/orderRules.js';
import { objectIdSchema } from '../utils/validation.js';
import { tenantFilter } from '../utils/tenant.js';

const customerOrders = Router();
const restaurantOrders = Router();
let orderSocket: Server | undefined;
const variantSelectionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  pricePaise: z.number().int().min(0)
});

const addonSelectionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  pricePaise: z.number().int().min(0)
});

const createOrderSchema = z.object({
  token: z.string().min(32).max(100),
  idempotencyKey: z.string().trim().min(12).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  items: z.array(z.object({
    menuItemId: objectIdSchema,
    quantity: z.number().int().min(1).max(50),
    selectedVariant: variantSelectionSchema.nullable().optional(),
    selectedAddons: z.array(addonSelectionSchema).optional(),
    notes: z.string().trim().max(250).default(''),
    expectedUnitPricePaise: z.number().int().min(0).optional()
  })).min(1).max(50),
  notes: z.string().trim().max(500).default('')
});
const statusSchema = z.object({ status: z.enum(orderStatuses), rejectionReason: z.string().trim().max(300).default('') });

function makeOrderNumber(): string {
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  const suffix = randomInt(36 ** 3, 36 ** 4).toString(36).toUpperCase();
  return `PQR-${date}-${suffix}`;
}

function serializeOrder(order: OrderDoc, tableInfo: { label: string; needsClearing?: boolean } | string) {
  const label = typeof tableInfo === 'string' ? tableInfo : tableInfo.label;
  const needsClearing = typeof tableInfo === 'string' ? false : Boolean(tableInfo.needsClearing);
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    table: { id: String(order.tableId), label, needsClearing },
    items: order.items.map((item) => ({
      menuItemId: String(item.menuItemId),
      name: item.name,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      selectedVariant: item.selectedVariant ?? null,
      selectedAddons: item.selectedAddons ?? [],
      notes: item.notes,
      subtotalPaise: item.subtotalPaise
    })),
    status: order.status,
    statusHistory: order.statusHistory,
    subtotalPaise: order.subtotalPaise,
    totalPaise: order.totalPaise,
    paymentStatus: order.paymentStatus ?? 'UNPAID',
    paymentMethod: order.paymentMethod ?? null,
    discountPaise: order.discountPaise ?? 0,
    discountReason: order.discountReason ?? '',
    finalPaidPaise: order.finalPaidPaise ?? (order.paymentStatus === 'PAID' ? order.totalPaise : 0),
    settledAt: order.settledAt ?? null,
    notes: order.notes,
    rejectionReason: order.rejectionReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

async function tableInfoMap(orders: OrderDoc[]): Promise<Map<string, { label: string; needsClearing: boolean }>> {
  const ids = [...new Set(orders.map((order) => String(order.tableId)))];
  const restaurantId = orders[0]?.restaurantId;
  if (!restaurantId) return new Map();
  const tables = await DiningTable.find({ _id: { $in: ids }, restaurantId }).select('_id label needsClearing').lean();
  return new Map(tables.map((table) => [String(table._id), { label: table.label, needsClearing: Boolean(table.needsClearing) }]));
}

customerOrders.use(requireCustomer, requireCustomerQr);
customerOrders.post('/', async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check your order details.');
  const { sessionId, restaurantId, tableId, customerId } = req.customer!;
  const duplicate = await Order.findOne({ customerSessionId: sessionId, idempotencyKey: parsed.data.idempotencyKey });
  if (duplicate) {
    const table = await DiningTable.findOne({ _id: duplicate.tableId, restaurantId: duplicate.restaurantId }).select('label needsClearing');
    return res.status(200).json({ order: serializeOrder(duplicate as unknown as OrderDoc, { label: table?.label ?? 'Table', needsClearing: Boolean(table?.needsClearing) }) });
  }
  const [table, restaurant] = await Promise.all([
    DiningTable.findOne(tenantFilter(restaurantId, { _id: tableId, active: true })),
    Restaurant.findOne({ _id: restaurantId, active: true })
  ]);
  if (!table) throw new AppError(403, 'TABLE_INACTIVE', 'This table is no longer accepting orders. Ask a staff member for help.');
  if (!restaurant) throw new AppError(403, 'RESTAURANT_INACTIVE', 'This restaurant is not currently accepting orders.');

  const ids = parsed.data.items.map((item) => item.menuItemId);
  const menuItems = await MenuItem.find(tenantFilter(restaurantId, { _id: { $in: ids }, available: true }));
  const itemMap = new Map(menuItems.map((item) => [String(item._id), item]));
  const unavailable = parsed.data.items.filter((item) => !itemMap.has(item.menuItemId));
  if (unavailable.length) throw new AppError(409, 'ITEM_UNAVAILABLE', 'One or more items are no longer available. Review your cart and try again.');

  const snapshotItems = parsed.data.items.map((requested) => {
    const menuItem = itemMap.get(requested.menuItemId)!;
    // Calculate unit price: variant price (if selected) or base price + sum of selected addons
    let basePrice = requested.selectedVariant ? requested.selectedVariant.pricePaise : menuItem.pricePaise;
    const addonsTotal = (requested.selectedAddons || []).reduce((sum, a) => sum + a.pricePaise, 0);
    const calculatedUnitPrice = basePrice + addonsTotal;

    return {
      menuItemId: menuItem._id,
      name: menuItem.name,
      unitPricePaise: calculatedUnitPrice,
      quantity: requested.quantity,
      selectedVariant: requested.selectedVariant ?? null,
      selectedAddons: requested.selectedAddons ?? [],
      notes: requested.notes,
      subtotalPaise: calculatedUnitPrice * requested.quantity
    };
  });

  const priceChanges = parsed.data.items.flatMap((requested, index) => {
    const calc = snapshotItems[index];
    return requested.expectedUnitPricePaise !== undefined && calc && requested.expectedUnitPricePaise !== calc.unitPricePaise
      ? [{ menuItemId: requested.menuItemId, name: calc.name, expectedPricePaise: requested.expectedUnitPricePaise, currentPricePaise: calc.unitPricePaise }]
      : [];
  });
  if (priceChanges.length) throw new AppError(409, 'PRICE_CHANGED', 'Some prices changed. Review your cart before placing the order.');
  const subtotalPaise = calculateSubtotal(snapshotItems.map((item) => ({ pricePaise: item.unitPricePaise, quantity: item.quantity })));
  const order = new Order({
    restaurantId, tableId, customerId, customerSessionId: sessionId,
    idempotencyKey: parsed.data.idempotencyKey,
    orderNumber: makeOrderNumber(),
    items: snapshotItems,
    subtotalPaise,
    totalPaise: subtotalPaise,
    notes: parsed.data.notes,
    status: 'NEW',
    statusHistory: [{ status: 'NEW', at: new Date(), note: '' }]
  });
  try {
    await order.save();
  } catch (error) {
    const duplicateError = error && typeof error === 'object' && 'code' in error && error.code === 11000;
    if (!duplicateError) throw error;
    const existing = await Order.findOne({ customerSessionId: sessionId, idempotencyKey: parsed.data.idempotencyKey });
    if (!existing) throw error;
    return res.status(200).json({ order: serializeOrder(existing as unknown as OrderDoc, { label: table.label, needsClearing: Boolean(table.needsClearing) }) });
  }
  const response = serializeOrder(order as unknown as OrderDoc, { label: table.label, needsClearing: Boolean(table.needsClearing) });
  await TableCart.findOneAndUpdate({ tableId, restaurantId }, { $set: { items: [] } });
  orderSocket?.to(`restaurant:${restaurantId}`).emit('order:new', response);
  orderSocket?.to(`customer:${sessionId}`).emit('order:status', { id: order.id, orderNumber: order.orderNumber, status: order.status, updatedAt: order.updatedAt });
  orderSocket?.to(`table:${tableId}`).emit('table-cart:updated', { items: [] });
  orderSocket?.to(`table:${tableId}`).emit('order:status', { id: order.id, orderNumber: order.orderNumber, status: order.status, updatedAt: order.updatedAt });
  res.status(201).json({ order: response });
});

customerOrders.get('/', async (req, res) => {
  const orders = await Order.find({
    tableId: req.customer!.tableId,
    restaurantId: req.customer!.restaurantId,
    createdAt: { $gt: new Date(Date.now() - 12 * 60 * 60 * 1000) }
  }).sort({ createdAt: -1 }).limit(30) as unknown as OrderDoc[];
  const tableInfos = await tableInfoMap(orders);
  res.json({ orders: orders.map((order) => serializeOrder(order, tableInfos.get(String(order.tableId)) ?? { label: 'Table', needsClearing: false })) });
});

customerOrders.get('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid order identifier.');
  const order = await Order.findOne({
    _id: req.params.id,
    tableId: req.customer!.tableId,
    restaurantId: req.customer!.restaurantId
  }) as unknown as OrderDoc | null;
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  const table = await DiningTable.findOne({ _id: order.tableId, restaurantId: order.restaurantId }).select('label needsClearing');
  res.json({ order: serializeOrder(order, { label: table?.label ?? 'Table', needsClearing: Boolean(table?.needsClearing) }) });
});

restaurantOrders.use(requireStaff);
restaurantOrders.get('/', async (req, res) => {
  const parsedStatus = z.enum(orderStatuses).safeParse(req.query.status);
  if (req.query.status !== undefined && !parsedStatus.success) throw new AppError(400, 'INVALID_STATUS', 'Choose a valid order status.');
  const filter = tenantFilter(req.staff!.restaurantId, parsedStatus.success ? { status: parsedStatus.data } : {});
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100) as unknown as OrderDoc[];
  const tableInfos = await tableInfoMap(orders);
  res.json({ orders: orders.map((order) => serializeOrder(order, tableInfos.get(String(order.tableId)) ?? { label: 'Table', needsClearing: false })) });
});

const staffCreateOrderSchema = z.object({
  tableId: objectIdSchema,
  items: z.array(z.object({
    menuItemId: objectIdSchema,
    quantity: z.number().int().min(1).max(50),
    selectedVariant: variantSelectionSchema.nullable().optional(),
    selectedAddons: z.array(addonSelectionSchema).optional(),
    notes: z.string().trim().max(250).default('')
  })).min(1).max(50),
  notes: z.string().trim().max(500).default('')
});

restaurantOrders.post('/', requireRoles('owner', 'staff'), async (req, res) => {
  const parsed = staffCreateOrderSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check order details.');

  const restaurantId = req.staff!.restaurantId;
  const table = await DiningTable.findOne(tenantFilter(restaurantId, { _id: parsed.data.tableId, active: true }));
  if (!table) throw new AppError(404, 'TABLE_NOT_FOUND', 'Dining table not found or inactive.');

  const ids = parsed.data.items.map((item) => item.menuItemId);
  const menuItems = await MenuItem.find(tenantFilter(restaurantId, { _id: { $in: ids } }));
  const itemMap = new Map(menuItems.map((item) => [String(item._id), item]));
  const missing = parsed.data.items.filter((item) => !itemMap.has(item.menuItemId));
  if (missing.length) throw new AppError(400, 'ITEM_NOT_FOUND', 'One or more items do not belong to this restaurant.');

  const snapshotItems = parsed.data.items.map((requested) => {
    const menuItem = itemMap.get(requested.menuItemId)!;
    const basePrice = requested.selectedVariant ? requested.selectedVariant.pricePaise : menuItem.pricePaise;
    const addonsTotal = (requested.selectedAddons || []).reduce((sum, a) => sum + a.pricePaise, 0);
    const calculatedUnitPrice = basePrice + addonsTotal;

    return {
      menuItemId: menuItem._id,
      name: menuItem.name,
      unitPricePaise: calculatedUnitPrice,
      quantity: requested.quantity,
      selectedVariant: requested.selectedVariant ?? null,
      selectedAddons: requested.selectedAddons ?? [],
      notes: requested.notes,
      subtotalPaise: calculatedUnitPrice * requested.quantity
    };
  });

  const subtotalPaise = calculateSubtotal(snapshotItems.map((item) => ({ pricePaise: item.unitPricePaise, quantity: item.quantity })));
  const staffName = req.staff?.name || 'Staff';
  const order = new Order({
    restaurantId,
    tableId: table._id,
    idempotencyKey: `staff-${Date.now()}-${randomInt(10000, 99999)}`,
    orderNumber: makeOrderNumber(),
    items: snapshotItems,
    subtotalPaise,
    totalPaise: subtotalPaise,
    notes: parsed.data.notes ? `[Waiter Punch] ${parsed.data.notes}` : '[Waiter Punch]',
    status: 'ACCEPTED',
    statusHistory: [
      { status: 'NEW', at: new Date(), note: `Punched by ${staffName}` },
      { status: 'ACCEPTED', at: new Date(), note: 'Accepted by staff' }
    ]
  });

  await order.save();
  const response = serializeOrder(order as unknown as OrderDoc, { label: table.label, needsClearing: Boolean(table.needsClearing) });

  orderSocket?.to(`restaurant:${restaurantId}`).emit('order:new', response);
  orderSocket?.to(`table:${table._id}`).emit('order:status', { id: order.id, orderNumber: order.orderNumber, status: order.status, updatedAt: order.updatedAt });

  res.status(201).json({ order: response });
});

restaurantOrders.patch('/:id/status', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid order identifier.');
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Choose a valid status.');
  const current = await Order.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id })) as unknown as OrderDoc | null;
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  const status = nextOrderStatus(current.status, parsed.data.status as OrderStatus);
  if (status === 'REJECTED' && !parsed.data.rejectionReason) throw new AppError(400, 'REJECTION_REASON_REQUIRED', 'Add a short reason for rejecting this order.');
  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    tenantFilter(req.staff!.restaurantId, { _id: current._id, status: current.status }),
    { $set: { status, ...(status === 'REJECTED' ? { rejectionReason: parsed.data.rejectionReason } : {}) }, $push: { statusHistory: { status, at: now, note: status === 'REJECTED' ? parsed.data.rejectionReason : '' } } },
    { returnDocument: 'after' }
  ) as unknown as OrderDoc | null;
  if (!updated) throw new AppError(409, 'ORDER_CHANGED', 'This order changed. Refresh the order and try again.');
  const [table, customerSession] = await Promise.all([
    DiningTable.findOne({ _id: updated.tableId, restaurantId: updated.restaurantId }).select('label needsClearing'),
    CustomerSession.findById(updated.customerSessionId).select('_id')
  ]);
  const response = serializeOrder(updated, { label: table?.label ?? 'Table', needsClearing: Boolean(table?.needsClearing) });
  const event = { id: response.id, orderNumber: response.orderNumber, status: response.status, updatedAt: response.updatedAt, ...(status === 'REJECTED' ? { rejectionReason: response.rejectionReason } : {}) };
  orderSocket?.to(`restaurant:${req.staff!.restaurantId}`).emit('order:status', event);
  if (customerSession) orderSocket?.to(`customer:${customerSession._id}`).emit('order:status', event);
  orderSocket?.to(`table:${updated.tableId}`).emit('order:status', event);
  res.json({ order: response });
});

const settleSchema = z.object({
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']),
  discountPaise: z.number().int().min(0).default(0),
  discountReason: z.string().trim().max(100).default('')
});

restaurantOrders.patch('/:id/settle', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid order identifier.');
  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid settlement details.');

  const current = await Order.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id })) as unknown as OrderDoc | null;
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  if (current.status === 'REJECTED') throw new AppError(400, 'INVALID_STATE', 'Cannot settle a rejected order.');
  if (parsed.data.discountPaise > current.totalPaise) throw new AppError(400, 'INVALID_DISCOUNT', 'Discount cannot exceed order total.');

  const finalPaidPaise = Math.max(0, current.totalPaise - parsed.data.discountPaise);
  const now = new Date();

  const updatedStatus = current.status === 'DELIVERED' ? current.status : 'DELIVERED';
  const statusHistoryEntry = updatedStatus !== current.status
    ? [{ status: updatedStatus, at: now, note: `Settled via ${parsed.data.paymentMethod}` }]
    : [];

  const updated = await Order.findOneAndUpdate(
    tenantFilter(req.staff!.restaurantId, { _id: current._id }),
    {
      $set: {
        paymentStatus: 'PAID',
        paymentMethod: parsed.data.paymentMethod,
        discountPaise: parsed.data.discountPaise,
        discountReason: parsed.data.discountReason,
        finalPaidPaise,
        settledAt: now,
        settledBy: req.staff!.id,
        status: updatedStatus
      },
      ...(statusHistoryEntry.length > 0 ? { $push: { statusHistory: { $each: statusHistoryEntry } } } : {})
    },
    { returnDocument: 'after' }
  ) as unknown as OrderDoc | null;

  if (!updated) throw new AppError(409, 'ORDER_CHANGED', 'This order could not be updated.');

  // Automatically mark the dining table as needing clearing upon settlement
  await DiningTable.updateOne(
    { _id: updated.tableId, restaurantId: updated.restaurantId },
    { $set: { needsClearing: true } }
  );

  const [table, customerSession] = await Promise.all([
    DiningTable.findOne({ _id: updated.tableId, restaurantId: updated.restaurantId }).select('label needsClearing'),
    CustomerSession.findById(updated.customerSessionId).select('_id')
  ]);
  const response = serializeOrder(updated, { label: table?.label ?? 'Table', needsClearing: true });

  orderSocket?.to(`restaurant:${req.staff!.restaurantId}`).emit('order:settled', response);
  orderSocket?.to(`restaurant:${req.staff!.restaurantId}`).emit('table:clearing_needed', {
    tableId: String(updated.tableId),
    tableLabel: table?.label ?? 'Table',
    needsClearing: true
  });
  orderSocket?.to(`restaurant:${req.staff!.restaurantId}`).emit('order:status', {
    id: response.id,
    orderNumber: response.orderNumber,
    status: response.status,
    updatedAt: response.updatedAt
  });
  if (customerSession) orderSocket?.to(`customer:${customerSession._id}`).emit('order:status', {
    id: response.id,
    orderNumber: response.orderNumber,
    status: response.status,
    updatedAt: response.updatedAt
  });
  orderSocket?.to(`table:${updated.tableId}`).emit('order:status', {
    id: response.id,
    orderNumber: response.orderNumber,
    status: response.status,
    updatedAt: response.updatedAt
  });

  res.json({ order: response });
});

export function mountOrderRoutes(app: import('express').Express, io: Server): void {
  orderSocket = io;
  app.use('/api/customer/orders', customerOrders);
  app.use('/api/restaurant/orders', restaurantOrders);
}

export function getOrderSocket(): Server | undefined {
  return orderSocket;
}
