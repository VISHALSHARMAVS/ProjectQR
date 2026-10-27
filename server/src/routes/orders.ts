import { randomInt } from 'node:crypto';
import { Router } from 'express';
import type { Server } from 'socket.io';
import { z } from 'zod';
import { requireCustomer, requireCustomerQr, requireStaff } from '../middleware/auth.js';
import { CustomerSession } from '../models/CustomerSession.js';
import { DiningTable } from '../models/DiningTable.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order, orderStatuses, type OrderDoc, type OrderStatus } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { AppError } from '../utils/errors.js';
import { calculateSubtotal, nextOrderStatus } from '../utils/orderRules.js';
import { objectIdSchema } from '../utils/validation.js';
import { tenantFilter } from '../utils/tenant.js';

const customerOrders = Router();
const restaurantOrders = Router();
let orderSocket: Server | undefined;
const createOrderSchema = z.object({
  token: z.string().min(32).max(100),
  idempotencyKey: z.string().trim().min(12).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  items: z.array(z.object({
    menuItemId: objectIdSchema,
    quantity: z.number().int().min(1).max(50),
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

function serializeOrder(order: OrderDoc, tableLabel: string) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    table: { label: tableLabel },
    items: order.items.map((item) => ({ menuItemId: String(item.menuItemId), name: item.name, unitPricePaise: item.unitPricePaise, quantity: item.quantity, notes: item.notes, subtotalPaise: item.subtotalPaise })),
    status: order.status,
    statusHistory: order.statusHistory,
    subtotalPaise: order.subtotalPaise,
    totalPaise: order.totalPaise,
    notes: order.notes,
    rejectionReason: order.rejectionReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

async function tableLabelMap(orders: OrderDoc[]): Promise<Map<string, string>> {
  const ids = [...new Set(orders.map((order) => String(order.tableId)))];
  const restaurantId = orders[0]?.restaurantId;
  if (!restaurantId) return new Map();
  const tables = await DiningTable.find({ _id: { $in: ids }, restaurantId }).select('_id label').lean();
  return new Map(tables.map((table) => [String(table._id), table.label]));
}

customerOrders.use(requireCustomer, requireCustomerQr);
customerOrders.post('/', async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check your order details.');
  const { sessionId, restaurantId, tableId, customerId } = req.customer!;
  const duplicate = await Order.findOne({ customerSessionId: sessionId, idempotencyKey: parsed.data.idempotencyKey });
  if (duplicate) {
    const table = await DiningTable.findOne({ _id: duplicate.tableId, restaurantId: duplicate.restaurantId }).select('label');
    return res.status(200).json({ order: serializeOrder(duplicate as unknown as OrderDoc, table?.label ?? 'Table') });
  }
  const [table, restaurant] = await Promise.all([
    DiningTable.findOne(tenantFilter(restaurantId, { _id: tableId, active: true })),
    Restaurant.findOne({ _id: restaurantId, active: true })
  ]);
  if (!table) throw new AppError(403, 'TABLE_INACTIVE', 'This table is no longer accepting orders. Ask a staff member for help.');
  if (!restaurant) throw new AppError(403, 'RESTAURANT_INACTIVE', 'This restaurant is not currently accepting orders.');

  const ids = parsed.data.items.map((item) => item.menuItemId);
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'DUPLICATE_ORDER_ITEM', 'Each menu item should appear only once in the cart.');
  const menuItems = await MenuItem.find(tenantFilter(restaurantId, { _id: { $in: ids }, available: true }));
  const itemMap = new Map(menuItems.map((item) => [String(item._id), item]));
  const unavailable = parsed.data.items.filter((item) => !itemMap.has(item.menuItemId));
  if (unavailable.length) throw new AppError(409, 'ITEM_UNAVAILABLE', 'One or more items are no longer available. Review your cart and try again.');
  const priceChanges = parsed.data.items.flatMap((requested) => {
    const item = itemMap.get(requested.menuItemId)!;
    return requested.expectedUnitPricePaise !== undefined && requested.expectedUnitPricePaise !== item.pricePaise
      ? [{ menuItemId: requested.menuItemId, name: item.name, expectedPricePaise: requested.expectedUnitPricePaise, currentPricePaise: item.pricePaise }]
      : [];
  });
  if (priceChanges.length) throw new AppError(409, 'PRICE_CHANGED', 'Some prices changed. Review your cart before placing the order.');

  const snapshotItems = parsed.data.items.map((requested) => {
    const menuItem = itemMap.get(requested.menuItemId)!;
    return {
      menuItemId: menuItem._id,
      name: menuItem.name,
      unitPricePaise: menuItem.pricePaise,
      quantity: requested.quantity,
      notes: requested.notes,
      subtotalPaise: menuItem.pricePaise * requested.quantity
    };
  });
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
    return res.status(200).json({ order: serializeOrder(existing as unknown as OrderDoc, table.label) });
  }
  const response = serializeOrder(order as unknown as OrderDoc, table.label);
  orderSocket?.to(`restaurant:${restaurantId}`).emit('order:new', response);
  orderSocket?.to(`customer:${sessionId}`).emit('order:status', { id: order.id, orderNumber: order.orderNumber, status: order.status, updatedAt: order.updatedAt });
  res.status(201).json({ order: response });
});

customerOrders.get('/', async (req, res) => {
  const orders = await Order.find({ customerSessionId: req.customer!.sessionId }).sort({ createdAt: -1 }).limit(30) as unknown as OrderDoc[];
  const labels = await tableLabelMap(orders);
  res.json({ orders: orders.map((order) => serializeOrder(order, labels.get(String(order.tableId)) ?? 'Table')) });
});

customerOrders.get('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid order identifier.');
  const order = await Order.findOne({ _id: req.params.id, customerSessionId: req.customer!.sessionId }) as unknown as OrderDoc | null;
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  const table = await DiningTable.findOne({ _id: order.tableId, restaurantId: order.restaurantId }).select('label');
  res.json({ order: serializeOrder(order, table?.label ?? 'Table') });
});

restaurantOrders.use(requireStaff);
restaurantOrders.get('/', async (req, res) => {
  const parsedStatus = z.enum(orderStatuses).safeParse(req.query.status);
  if (req.query.status !== undefined && !parsedStatus.success) throw new AppError(400, 'INVALID_STATUS', 'Choose a valid order status.');
  const filter = tenantFilter(req.staff!.restaurantId, parsedStatus.success ? { status: parsedStatus.data } : {});
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100) as unknown as OrderDoc[];
  const labels = await tableLabelMap(orders);
  res.json({ orders: orders.map((order) => serializeOrder(order, labels.get(String(order.tableId)) ?? 'Table')) });
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
    DiningTable.findOne({ _id: updated.tableId, restaurantId: updated.restaurantId }).select('label'),
    CustomerSession.findById(updated.customerSessionId).select('_id')
  ]);
  const response = serializeOrder(updated, table?.label ?? 'Table');
  const event = { id: response.id, orderNumber: response.orderNumber, status: response.status, updatedAt: response.updatedAt, ...(status === 'REJECTED' ? { rejectionReason: response.rejectionReason } : {}) };
  orderSocket?.to(`restaurant:${req.staff!.restaurantId}`).emit('order:status', event);
  if (customerSession) orderSocket?.to(`customer:${customerSession._id}`).emit('order:status', event);
  res.json({ order: response });
});

export function mountOrderRoutes(app: import('express').Express, io: Server): void {
  orderSocket = io;
  app.use('/api/customer/orders', customerOrders);
  app.use('/api/restaurant/orders', restaurantOrders);
}
