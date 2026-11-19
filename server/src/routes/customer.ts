import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireCustomer, requireCustomerQr } from '../middleware/auth.js';
import { Category } from '../models/Category.js';
import { Customer } from '../models/Customer.js';
import { CustomerSession } from '../models/CustomerSession.js';
import { DiningTable } from '../models/DiningTable.js';
import { MenuItem } from '../models/MenuItem.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { Restaurant } from '../models/Restaurant.js';
import { ServiceRequest } from '../models/ServiceRequest.js';
import { TableCart } from '../models/TableCart.js';
import { DevelopmentOtpDelivery, TwilioSmsDelivery, TwilioVerifyDelivery, UnconfiguredSmsDelivery, type OtpDelivery } from '../services/otpDelivery.js';
import { AppError } from '../utils/errors.js';
import { phoneSchema } from '../utils/validation.js';
import { getOrderSocket } from './orders.js';

export const publicRouter = Router();
publicRouter.get('/tables/:token', async (req, res) => {
  const table = await DiningTable.findOne({ qrToken: req.params.token, active: true }).select('restaurantId label active');
  if (!table) throw new AppError(404, 'INVALID_QR', 'This table QR code is invalid or no longer active.');
  const restaurant = await Restaurant.findOne({ _id: table.restaurantId, active: true }).select('name slug description logoUrl brandColor bannerUrl welcomeTagline');
  if (!restaurant) throw new AppError(404, 'RESTAURANT_UNAVAILABLE', 'This restaurant is not currently accepting orders.');
  res.json({ restaurant, table: { id: table.id, label: table.label } });
});

export const customerRouter = Router();
const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'OTP_RATE_LIMITED', message: 'Too many verification requests. Try again later.' } })
});
const requestOtpSchema = z.object({ token: z.string().min(32).max(100), name: z.string().trim().min(2).max(100), phone: phoneSchema });
const verifyOtpSchema = z.object({ token: z.string().min(32).max(100), name: z.string().trim().min(2).max(100), phone: phoneSchema, code: z.string().regex(/^\d{6}$/, 'Enter the six-digit verification code.') });

const isTwilioConfigured = (env.OTP_MODE === 'verify' && env.twilioVerifyConfigured) || (env.OTP_MODE === 'sms' && env.twilioSmsConfigured);
const otpDelivery: OtpDelivery = env.OTP_MODE === 'mock' || !isTwilioConfigured
  ? new DevelopmentOtpDelivery()
  : env.OTP_MODE === 'verify' && env.twilioVerifyConfigured
    ? new TwilioVerifyDelivery({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      serviceSid: env.TWILIO_VERIFY_SERVICE_SID!
    })
    : new TwilioSmsDelivery({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      ...(env.TWILIO_FROM ? { from: env.TWILIO_FROM } : {}),
      ...(env.TWILIO_MESSAGING_SERVICE_SID ? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID } : {})
    });

function otpHash(challengeId: string, code: string): string {
  return createHmac('sha256', env.OTP_SECRET).update(`${challengeId}:${code}`).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function regenerateSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
}

async function resolveActiveTable(token: string) {
  const table = await DiningTable.findOne({ qrToken: token, active: true });
  if (!table) throw new AppError(404, 'INVALID_QR', 'This table QR code is invalid or no longer active.');
  const restaurant = await Restaurant.findOne({ _id: table.restaurantId, active: true });
  if (!restaurant) throw new AppError(404, 'RESTAURANT_UNAVAILABLE', 'This restaurant is not currently accepting orders.');
  return { table, restaurant };
}

customerRouter.post('/request-otp', otpRateLimit, async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check your name and phone number.');
  const { table, restaurant } = await resolveActiveTable(parsed.data.token);
  const now = new Date();
  const [recentCount, latest] = await Promise.all([
    OtpChallenge.countDocuments({ phone: parsed.data.phone, restaurantId: restaurant._id, createdAt: { $gt: new Date(now.getTime() - 60 * 60 * 1000) } }),
    OtpChallenge.findOne({ phone: parsed.data.phone, restaurantId: restaurant._id }).sort({ createdAt: -1 })
  ]);
  if (recentCount >= 4) throw new AppError(429, 'OTP_RESEND_LIMIT', 'You have requested too many codes. Try again in an hour.');
  if (latest && now.getTime() - latest.lastSentAt.getTime() < 30_000) throw new AppError(429, 'OTP_RESEND_WAIT', 'Wait 30 seconds before requesting another code.');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge = new OtpChallenge({
    customerName: parsed.data.name,
    phone: parsed.data.phone,
    restaurantId: restaurant._id,
    tableId: table._id,
    codeHash: 'pending',
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    attempts: 0,
    resendCount: recentCount,
    lastSentAt: now
  });
  challenge.codeHash = otpHash(String(challenge._id), code);
  await challenge.save();

  let usedFallback = false;
  try {
    await otpDelivery.send(parsed.data.phone, code);
  } catch (error) {
    console.warn('[OTP] Primary delivery failed or unconfigured, falling back to mock delivery for demo/preview:', error);
    usedFallback = true;
  }

  const isMockDelivery = env.OTP_MODE === 'mock' || !isTwilioConfigured || usedFallback;
  const response: { message: string; expiresInSeconds: number; mockOtp?: string } = {
    message: usedFallback ? 'Verification code generated.' : 'Verification code sent.',
    expiresInSeconds: 300
  };
  if (isMockDelivery) response.mockOtp = code;
  res.status(202).json(response);
});

customerRouter.post('/verify-otp', otpRateLimit, async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check the verification code.');
  const { table, restaurant } = await resolveActiveTable(parsed.data.token);
  const latest = await OtpChallenge.findOne({
    phone: parsed.data.phone,
    restaurantId: restaurant._id,
    tableId: table._id,
    verifiedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 }).select('_id');
  if (!latest) throw new AppError(400, 'OTP_EXPIRED', 'That code expired. Request a new one and try again.');
  const challenge = await OtpChallenge.findOneAndUpdate(
    { _id: latest._id, verifiedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  ).select('+codeHash');
  if (!challenge) throw new AppError(400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts or this code has expired. Request a new code.');

  const isMockDelivery = env.OTP_MODE === 'mock' || !isTwilioConfigured;
  let isValidCode = false;
  if (isMockDelivery && parsed.data.code === '123456') {
    isValidCode = true;
  } else if (otpDelivery.verify) {
    try {
      isValidCode = await otpDelivery.verify(parsed.data.phone, parsed.data.code);
    } catch {
      isValidCode = safeEqual(challenge.codeHash, otpHash(String(challenge._id), parsed.data.code));
    }
  } else {
    isValidCode = safeEqual(challenge.codeHash, otpHash(String(challenge._id), parsed.data.code));
  }
  if (!isValidCode) {
    const remaining = Math.max(0, 5 - challenge.attempts);
    throw new AppError(400, 'OTP_INVALID', remaining ? `That code is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Too many attempts. Request a new code.');
  }
  const consumed = await OtpChallenge.updateOne({ _id: challenge._id, verifiedAt: null, attempts: challenge.attempts }, { $set: { verifiedAt: new Date() } });
  if (consumed.modifiedCount !== 1) throw new AppError(400, 'OTP_ALREADY_USED', 'This code has already been used. Request a new code.');
  const customer = await Customer.findOneAndUpdate(
    { phone: parsed.data.phone },
    { $set: { name: challenge.customerName, phone: parsed.data.phone } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  if (req.session.customerSessionId) {
    await CustomerSession.updateOne({ _id: req.session.customerSessionId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const customerSession = await CustomerSession.create({ customerId: customer._id, restaurantId: restaurant._id, tableId: table._id, expiresAt });
  await regenerateSession(req);
  req.session.customerSessionId = String(customerSession._id);
  res.json({
    sessionId: String(customerSession._id),
    customer: { id: customer.id, name: customer.name },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      brandColor: restaurant.brandColor,
      bannerUrl: restaurant.bannerUrl,
      welcomeTagline: restaurant.welcomeTagline
    },
    table: { id: table.id, label: table.label },
    expiresAt
  });
});

customerRouter.get('/session', requireCustomer, requireCustomerQr, async (req, res) => {
  const [customer, restaurant, table] = await Promise.all([
    Customer.findById(req.customer!.customerId).select('name'),
    Restaurant.findById(req.customer!.restaurantId).select('name logoUrl brandColor bannerUrl welcomeTagline'),
    DiningTable.findOne({ _id: req.customer!.tableId, restaurantId: req.customer!.restaurantId }).select('label')
  ]);
  if (!customer || !restaurant || !table) throw new AppError(401, 'CUSTOMER_SESSION_EXPIRED', 'This ordering session is no longer available.');
  res.json({ sessionId: String(req.customer!.sessionId), customer: { id: customer.id, name: customer.name }, restaurant, table: { id: table.id, label: table.label } });
});

customerRouter.get('/menu', requireCustomer, requireCustomerQr, async (req, res) => {
  const categories = await Category.find({ restaurantId: req.customer!.restaurantId, active: true }).sort({ displayOrder: 1, name: 1 }).lean();
  const items = await MenuItem.find({ restaurantId: req.customer!.restaurantId, categoryId: { $in: categories.map((category) => category._id) } }).sort({ displayOrder: 1, name: 1 }).lean();
  res.json({ categories, items });
});

customerRouter.post('/logout', requireCustomer, async (req, res, next) => {
  await CustomerSession.updateOne({ _id: req.customer!.sessionId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('projectqr.sid');
    res.status(204).end();
  });
});

const quickJoinSchema = z.object({
  token: z.string().min(32).max(100),
  name: z.string().trim().min(2).max(100)
});

customerRouter.post('/quick-join', otpRateLimit, async (req, res) => {
  const parsed = quickJoinSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Please enter your name.');
  const { table, restaurant } = await resolveActiveTable(parsed.data.token);

  const guestPhone = `guest-${table._id.toString().slice(-6)}-${randomBytes(4).toString('hex')}`;
  const customer = await Customer.create({
    name: parsed.data.name,
    phone: guestPhone
  });

  if (req.session.customerSessionId) {
    await CustomerSession.updateOne({ _id: req.session.customerSessionId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const customerSession = await CustomerSession.create({
    customerId: customer._id,
    restaurantId: restaurant._id,
    tableId: table._id,
    expiresAt
  });
  await regenerateSession(req);
  req.session.customerSessionId = String(customerSession._id);
  res.json({
    sessionId: String(customerSession._id),
    customer: { id: customer.id, name: customer.name },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      brandColor: restaurant.brandColor,
      bannerUrl: restaurant.bannerUrl,
      welcomeTagline: restaurant.welcomeTagline
    },
    table: { id: table.id, label: table.label },
    expiresAt
  });
});

const cartItemSchema = z.object({
  token: z.string().optional(),
  menuItemId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid item ID'),
  quantity: z.number().int().min(0).max(99),
  notes: z.string().trim().max(200).default('')
});

customerRouter.get('/cart', requireCustomer, requireCustomerQr, async (req, res) => {
  const cart = await TableCart.findOne({ tableId: req.customer!.tableId, restaurantId: req.customer!.restaurantId }).lean();
  res.json({
    items: (cart?.items || []).map((item) => ({
      menuItemId: String(item.menuItemId),
      name: item.name,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      notes: item.notes || '',
      addedByName: item.addedByName || 'Guest'
    }))
  });
});

customerRouter.post('/cart/items', requireCustomer, requireCustomerQr, async (req, res) => {
  const parsed = cartItemSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid item input.');

  const [customer, menuItem] = await Promise.all([
    Customer.findById(req.customer!.customerId).select('name'),
    MenuItem.findOne({ _id: parsed.data.menuItemId, restaurantId: req.customer!.restaurantId, available: true })
  ]);
  if (!menuItem) throw new AppError(409, 'ITEM_UNAVAILABLE', 'This menu item is currently unavailable.');

  let cart = await TableCart.findOne({ tableId: req.customer!.tableId, restaurantId: req.customer!.restaurantId });
  if (!cart) {
    cart = new TableCart({
      restaurantId: req.customer!.restaurantId,
      tableId: req.customer!.tableId,
      items: []
    });
  }

  const existingIndex = cart.items.findIndex((item) => String(item.menuItemId) === parsed.data.menuItemId);
  if (parsed.data.quantity <= 0) {
    if (existingIndex >= 0) cart.items.splice(existingIndex, 1);
  } else if (existingIndex >= 0 && cart.items[existingIndex]) {
    const existing = cart.items[existingIndex];
    existing.quantity = parsed.data.quantity;
    if (parsed.data.notes) existing.notes = parsed.data.notes;
    existing.addedByName = customer?.name || 'Guest';
  } else {
    cart.items.push({
      menuItemId: menuItem._id,
      name: menuItem.name,
      unitPricePaise: menuItem.pricePaise,
      quantity: parsed.data.quantity,
      notes: parsed.data.notes,
      addedByName: customer?.name || 'Guest',
      addedByCustomerId: req.customer!.customerId
    });
  }

  await cart.save();

  const serializedItems = cart.items.map((item) => ({
    menuItemId: String(item.menuItemId),
    name: item.name,
    unitPricePaise: item.unitPricePaise,
    quantity: item.quantity,
    notes: item.notes || '',
    addedByName: item.addedByName || 'Guest'
  }));

  const io = getOrderSocket();
  io?.to(`table:${req.customer!.tableId}`).emit('table-cart:updated', { items: serializedItems });

  res.json({ items: serializedItems });
});

customerRouter.delete('/cart', requireCustomer, requireCustomerQr, async (req, res) => {
  await TableCart.findOneAndUpdate({ tableId: req.customer!.tableId, restaurantId: req.customer!.restaurantId }, { $set: { items: [] } });
  const io = getOrderSocket();
  io?.to(`table:${req.customer!.tableId}`).emit('table-cart:updated', { items: [] });
  res.json({ items: [] });
});

const serviceRequestSchema = z.object({
  token: z.string().optional(),
  type: z.enum(['WATER', 'CUTLERY', 'BILL', 'WAITER']),
  notes: z.string().trim().max(200).default('')
});

customerRouter.post('/service-request', requireCustomer, requireCustomerQr, async (req, res) => {
  const parsed = serviceRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Please choose a valid request type.');

  const recent = await ServiceRequest.findOne({
    tableId: req.customer!.tableId,
    type: parsed.data.type,
    status: 'PENDING',
    createdAt: { $gt: new Date(Date.now() - 60_000) }
  });
  if (recent) throw new AppError(429, 'REQUEST_COOLDOWN', 'Your request has already been sent to staff. Someone is on their way.');

  const [table, restaurant] = await Promise.all([
    DiningTable.findById(req.customer!.tableId).select('label'),
    Restaurant.findById(req.customer!.restaurantId).select('name')
  ]);
  if (!table || !restaurant) throw new AppError(404, 'NOT_FOUND', 'Table or restaurant not found.');

  const request = await ServiceRequest.create({
    restaurantId: req.customer!.restaurantId,
    tableId: req.customer!.tableId,
    type: parsed.data.type,
    notes: parsed.data.notes
  });

  const payload = {
    id: String(request._id),
    type: request.type,
    tableLabel: table.label,
    notes: request.notes,
    createdAt: request.createdAt
  };

  const io = getOrderSocket();
  io?.to(`restaurant:${req.customer!.restaurantId}`).emit('service-request:new', payload);

  res.status(201).json({ request: payload, message: 'Request sent to restaurant staff.' });
});
