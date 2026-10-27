import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
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
import { DevelopmentOtpDelivery, TwilioSmsDelivery, UnconfiguredSmsDelivery } from '../services/otpDelivery.js';
import { AppError } from '../utils/errors.js';
import { phoneSchema } from '../utils/validation.js';

export const publicRouter = Router();
publicRouter.get('/tables/:token', async (req, res) => {
  const table = await DiningTable.findOne({ qrToken: req.params.token, active: true }).select('restaurantId label active');
  if (!table) throw new AppError(404, 'INVALID_QR', 'This table QR code is invalid or no longer active.');
  const restaurant = await Restaurant.findOne({ _id: table.restaurantId, active: true }).select('name slug description logoUrl');
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
const otpDelivery = env.OTP_MODE === 'mock'
  ? new DevelopmentOtpDelivery()
  : env.twilioSmsConfigured
    ? new TwilioSmsDelivery({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      ...(env.TWILIO_FROM ? { from: env.TWILIO_FROM } : {}),
      ...(env.TWILIO_MESSAGING_SERVICE_SID ? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID } : {})
    })
    : new UnconfiguredSmsDelivery();

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
  try {
    await otpDelivery.send(parsed.data.phone, code);
  } catch (error) {
    await challenge.deleteOne();
    throw error;
  }
  const response: { message: string; expiresInSeconds: number; mockOtp?: string } = { message: 'Verification code sent.', expiresInSeconds: 300 };
  if (env.NODE_ENV !== 'production' && env.OTP_MODE === 'mock') response.mockOtp = code;
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
  if (!safeEqual(challenge.codeHash, otpHash(String(challenge._id), parsed.data.code))) {
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
    restaurant: { id: restaurant.id, name: restaurant.name, logoUrl: restaurant.logoUrl },
    table: { id: table.id, label: table.label },
    expiresAt
  });
});

customerRouter.get('/session', requireCustomer, requireCustomerQr, async (req, res) => {
  const [customer, restaurant, table] = await Promise.all([
    Customer.findById(req.customer!.customerId).select('name'),
    Restaurant.findById(req.customer!.restaurantId).select('name logoUrl'),
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
