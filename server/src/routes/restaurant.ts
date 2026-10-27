import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireRoles, requireStaff } from '../middleware/auth.js';
import { DiningTable } from '../models/DiningTable.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order, type OrderDoc } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { User } from '../models/User.js';
import { hashPassword } from '../services/password.js';
import { AppError } from '../utils/errors.js';
import { labelSchema, objectIdSchema } from '../utils/validation.js';
import { tenantFilter } from '../utils/tenant.js';

export const restaurantRouter = Router();
restaurantRouter.use(requireStaff);

restaurantRouter.get('/dashboard', async (req, res) => {
  const restaurantId = req.staff!.restaurantId;
  const [menuItems, activeTables, newOrders, preparingOrders, completed] = await Promise.all([
    MenuItem.countDocuments({ restaurantId }),
    DiningTable.countDocuments(tenantFilter(restaurantId, { active: true })),
    Order.countDocuments(tenantFilter(restaurantId, { status: 'NEW' })),
    Order.countDocuments(tenantFilter(restaurantId, { status: { $in: ['ACCEPTED', 'PREPARING'] } })),
    Order.find(tenantFilter(restaurantId, { status: { $in: ['DELIVERED', 'REJECTED'] } })).sort({ updatedAt: -1 }).limit(8)
  ]);
  const recent = completed as unknown as OrderDoc[];
  const labels = new Map((await DiningTable.find({ _id: { $in: recent.map((order) => order.tableId) }, restaurantId }).select('_id label').lean()).map((table) => [String(table._id), table.label]));
  res.json({ metrics: { menuItems, activeTables, newOrders, preparingOrders }, recentlyCompleted: recent.map((order) => ({ id: String(order._id), orderNumber: order.orderNumber, status: order.status, totalPaise: order.totalPaise, updatedAt: order.updatedAt, tableLabel: labels.get(String(order.tableId)) ?? 'Table' })) });
});

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().max(2048).refine((value) => !value || value.startsWith('/uploads/') || /^https:\/\//i.test(value), 'Use an HTTPS URL or uploaded image').optional(),
  address: z.string().trim().max(300).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.union([z.literal(''), z.email().trim().toLowerCase()]).optional()
}).strict();
restaurantRouter.get('/settings', async (req, res) => {
  const restaurant = await Restaurant.findById(req.staff!.restaurantId).select('name slug description logoUrl address contactPhone contactEmail active');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  res.json({ restaurant });
});
restaurantRouter.patch('/settings', requireRoles('owner'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError(400, 'INVALID_INPUT', parsed.success ? 'Provide at least one setting.' : parsed.error.issues[0]?.message ?? 'Invalid settings.');
  const restaurant = await Restaurant.findByIdAndUpdate(req.staff!.restaurantId, parsed.data, { returnDocument: 'after', runValidators: true }).select('name slug description logoUrl address contactPhone contactEmail active');
  if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant not found.');
  res.json({ restaurant });
});

export const tablesRouter = Router();
tablesRouter.use(requireStaff, requireRoles('owner', 'staff'));
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
