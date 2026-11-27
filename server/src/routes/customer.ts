import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireCustomer, requireCustomerQr } from '../middleware/auth.js';
import { Category } from '../models/Category.js';
import { Customer } from '../models/Customer.js';
import { CustomerSession } from '../models/CustomerSession.js';
import { DiningTable } from '../models/DiningTable.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order, type OrderDoc } from '../models/Order.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { Restaurant } from '../models/Restaurant.js';
import { ServiceRequest } from '../models/ServiceRequest.js';
import { TableCart } from '../models/TableCart.js';
import { DevelopmentOtpDelivery, TwilioSmsDelivery, TwilioVerifyDelivery, type OtpDelivery } from '../services/otpDelivery.js';
import { AppError } from '../utils/errors.js';
import { resolveMenuItemLinePricing } from '../utils/orderRules.js';
import { phoneSchema, sanitizePlainText } from '../utils/validation.js';
import { getOrderSocket } from './orders.js';

export const publicRouter = Router();
publicRouter.get('/tables/:token', async (req, res) => {
  const table = await DiningTable.findOne({ qrToken: req.params.token, active: true }).select('restaurantId label capacity active currentPin currentPinExpiresAt');
  if (!table) throw new AppError(404, 'INVALID_QR', 'This table QR code is invalid or no longer active.');
  const restaurant = await Restaurant.findOne({ _id: table.restaurantId, active: true }).select('name slug description logoUrl brandColor bannerUrl welcomeTagline gstin gstPercentage requireCustomerOtp upiId googleReviewUrl autoConfirmPayments paymentGateway enableDishReviews');
  if (!restaurant) throw new AppError(404, 'RESTAURANT_UNAVAILABLE', 'This restaurant is not currently accepting orders.');
  const now = new Date();
  const hasActiveParty = Boolean(
    table.currentPin &&
    table.currentPinExpiresAt &&
    new Date(table.currentPinExpiresAt) > now
  );
  const activeGuestsCount = await CustomerSession.countDocuments({
    tableId: table._id,
    revokedAt: null,
    expiresAt: { $gt: now }
  });
  res.json({
    restaurant,
    table: {
      id: table.id,
      label: table.label,
      hasActiveParty,
      capacity: table.capacity ?? null,
      activeGuestsCount
    }
  });
});

export const customerRouter = Router();
const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => {
    const phone = (typeof req.body?.phone === 'string' ? req.body.phone : '') || '';
    return phone ? `${req.ip}_${phone}` : `${req.ip}`;
  },
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'OTP_RATE_LIMITED', message: 'Too many verification requests. Please wait a moment.' } })
});

const quickJoinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  keyGenerator: (req) => {
    const token = (typeof req.body?.token === 'string' ? req.body.token : '') || 'global';
    return `${req.ip}_${token}`;
  },
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many join attempts from this network. Please wait a moment and try again.' } })
});
const requestOtpSchema = z.object({ token: z.string().min(32).max(100), name: z.string().trim().min(2).max(100), phone: phoneSchema });
const verifyOtpSchema = z.object({
  token: z.string().min(32).max(100),
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit verification code.'),
  pin: z.string().trim().optional(),
  separateTab: z.boolean().optional()
});

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

async function resolveTableParty(
  table: import('../models/DiningTable.js').DiningTableDoc,
  name: string,
  options?: { pin?: string; separateTab?: boolean }
): Promise<{ tabId: string; tabLabel: string; isHost: boolean; tablePin: string | null }> {
  const now = new Date();
  let currentTable = table;
  let hasActiveParty = Boolean(
    currentTable.currentPin &&
    currentTable.currentPinExpiresAt &&
    new Date(currentTable.currentPinExpiresAt) > now
  );

  let tabId = 'main';
  let tabLabel = 'Main Table';
  let isHost = false;

  if (!hasActiveParty) {
    const generatedPin = String(randomInt(1000, 10000));
    const claimed = await DiningTable.findOneAndUpdate(
      {
        _id: currentTable._id,
        $or: [
          { currentPin: null },
          { currentPinExpiresAt: null },
          { currentPinExpiresAt: { $lte: now } }
        ]
      },
      {
        $set: {
          currentPin: generatedPin,
          currentPinExpiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000)
        }
      },
      { returnDocument: 'after' }
    );
    if (claimed) {
      currentTable = claimed as unknown as import('../models/DiningTable.js').DiningTableDoc;
      return {
        tabId: 'main',
        tabLabel: 'Main Table',
        isHost: true,
        tablePin: currentTable.currentPin ?? null
      };
    }
    const refreshed = await DiningTable.findById(currentTable._id);
    if (refreshed) {
      currentTable = refreshed as unknown as import('../models/DiningTable.js').DiningTableDoc;
      hasActiveParty = Boolean(
        currentTable.currentPin &&
        currentTable.currentPinExpiresAt &&
        new Date(currentTable.currentPinExpiresAt) > now
      );
    }
  }

  if (hasActiveParty) {
    if (options?.separateTab) {
      tabId = `tab_${randomBytes(4).toString('hex')}`;
      tabLabel = `Separate Bill (${name})`;
      isHost = false;
    } else {
      const pin = (options?.pin || '').trim();
      if (!pin || pin !== currentTable.currentPin) {
        throw new AppError(
          403,
          'INVALID_TABLE_PIN',
          'Incorrect 4-digit Table PIN. Ask your table host for the code shown on their phone, or choose "Start Separate Bill".'
        );
      }
      tabId = 'main';
      tabLabel = 'Main Table';
      isHost = false;
    }
  }

  return {
    tabId,
    tabLabel,
    isHost,
    tablePin: tabId === 'main' ? (currentTable.currentPin ?? null) : null
  };
}

async function createBoundedCustomerSession(params: {
  table: import('../models/DiningTable.js').DiningTableDoc;
  restaurantId: Types.ObjectId;
  customerId: Types.ObjectId;
  party: { tabId: string; tabLabel: string; isHost: boolean };
  previousSessionId?: string;
}): Promise<{ customerSession: import('../models/CustomerSession.js').CustomerSessionDoc; expiresAt: Date }> {
  const { table, restaurantId, customerId, party, previousSessionId } = params;
  const now = new Date();
  const capacity = typeof table.capacity === 'number' && table.capacity > 0 ? table.capacity : null;

  if (capacity !== null) {
    const activeFilter: Record<string, unknown> = {
      tableId: table._id,
      revokedAt: null,
      expiresAt: { $gt: now }
    };
    if (previousSessionId && Types.ObjectId.isValid(previousSessionId)) {
      activeFilter._id = { $ne: new Types.ObjectId(previousSessionId) };
    }
    const activeCount = await CustomerSession.countDocuments(activeFilter);
    if (activeCount >= capacity) {
      throw new AppError(
        409,
        'TABLE_FULL',
        `This table has reached its maximum capacity of ${capacity} ${capacity === 1 ? 'guest' : 'guests'}.`
      );
    }
  }

  if (previousSessionId) {
    await CustomerSession.updateOne(
      { _id: previousSessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const customerSession = await CustomerSession.create({
    customerId,
    restaurantId,
    tableId: table._id,
    tabId: party.tabId,
    tabLabel: party.tabLabel,
    isHost: party.isHost,
    expiresAt
  });

  if (capacity !== null) {
    const activeSessions = await CustomerSession.find({
      tableId: table._id,
      revokedAt: null,
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id')
      .lean();
    const position = activeSessions.findIndex((s) => String(s._id) === String(customerSession._id));
    if (position === -1 || position >= capacity) {
      await CustomerSession.deleteOne({ _id: customerSession._id });
      throw new AppError(
        409,
        'TABLE_FULL',
        `This table has reached its maximum capacity of ${capacity} ${capacity === 1 ? 'guest' : 'guests'}.`
      );
    }
  }

  return {
    customerSession: customerSession as unknown as import('../models/CustomerSession.js').CustomerSessionDoc,
    expiresAt
  };
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

  const isMockDelivery = (env.OTP_MODE === 'mock' || !isTwilioConfigured || usedFallback) && env.NODE_ENV !== 'production';
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

  const isMockDelivery = (env.OTP_MODE === 'mock' || !isTwilioConfigured) && env.NODE_ENV !== 'production';
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
  const cleanName = sanitizePlainText(parsed.data.name);
  if (cleanName.length < 2) throw new AppError(400, 'INVALID_INPUT', 'Please enter a valid name (at least 2 characters).');
  const customer = await Customer.findOneAndUpdate(
    { phone: parsed.data.phone },
    { $set: { name: cleanName, phone: parsed.data.phone } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  const party = await resolveTableParty(table, cleanName, {
    pin: parsed.data.pin,
    separateTab: parsed.data.separateTab
  });

  const { customerSession, expiresAt } = await createBoundedCustomerSession({
    table,
    restaurantId: restaurant._id,
    customerId: customer._id,
    party,
    previousSessionId: req.session.customerSessionId
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
      welcomeTagline: restaurant.welcomeTagline,
      upiId: restaurant.upiId,
      googleReviewUrl: restaurant.googleReviewUrl,
      autoConfirmPayments: restaurant.autoConfirmPayments,
      paymentGateway: restaurant.paymentGateway,
      enableDishReviews: restaurant.enableDishReviews
    },
    table: { id: table.id, label: table.label, pin: party.tablePin },
    tab: {
      id: party.tabId,
      label: party.tabLabel,
      isHost: party.isHost,
      isSeparateTab: party.tabId !== 'main'
    },
    expiresAt
  });
});

customerRouter.get('/session', requireCustomer, async (req, res) => {
  const [customer, restaurant, table] = await Promise.all([
    Customer.findById(req.customer!.customerId).select('name'),
    Restaurant.findById(req.customer!.restaurantId).select('name logoUrl brandColor bannerUrl welcomeTagline upiId googleReviewUrl autoConfirmPayments paymentGateway enableDishReviews'),
    DiningTable.findOne({ _id: req.customer!.tableId, restaurantId: req.customer!.restaurantId }).select('label qrToken currentPin currentPinExpiresAt')
  ]);
  if (!customer || !restaurant || !table) throw new AppError(401, 'CUSTOMER_SESSION_EXPIRED', 'This ordering session is no longer available.');

  const isMainTab = (req.customer!.tabId || 'main') === 'main';
  const tablePin = isMainTab ? (table.currentPin ?? null) : null;

  const requestedToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (requestedToken && table.qrToken !== requestedToken) {
    const scannedTable = await DiningTable.findOne({ qrToken: requestedToken, active: true }).select('_id label restaurantId');
    if (scannedTable && String(scannedTable.restaurantId) === String(req.customer!.restaurantId)) {
      return res.json({
        sessionId: String(req.customer!.sessionId),
        customer: { id: customer.id, name: customer.name },
        restaurant,
        table: { id: table.id, label: table.label, pin: tablePin },
        tab: {
          id: req.customer!.tabId || 'main',
          label: req.customer!.tabLabel || 'Main Table',
          isHost: Boolean(req.customer!.isHost),
          isSeparateTab: !isMainTab
        },
        tableMismatch: {
          currentTable: { id: table.id, label: table.label },
          scannedTable: { id: scannedTable.id, label: scannedTable.label, token: requestedToken }
        }
      });
    }
    throw new AppError(403, 'CUSTOMER_SESSION_TABLE_MISMATCH', 'This session belongs to a different table. Verify your phone for this table to continue.');
  }

  res.json({
    sessionId: String(req.customer!.sessionId),
    customer: { id: customer.id, name: customer.name },
    restaurant,
    table: { id: table.id, label: table.label, pin: tablePin },
    tab: {
      id: req.customer!.tabId || 'main',
      label: req.customer!.tabLabel || 'Main Table',
      isHost: Boolean(req.customer!.isHost),
      isSeparateTab: !isMainTab
    },
    tableMismatch: null
  });
});

const switchTableSchema = z.object({
  token: z.string().min(32).max(100),
  pin: z.string().trim().optional(),
  separateTab: z.boolean().optional()
});

customerRouter.post('/switch-table', requireCustomer, async (req, res) => {
  const parsed = switchTableSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Invalid table QR token.');
  const { table, restaurant } = await resolveActiveTable(parsed.data.token);

  if (String(restaurant._id) !== String(req.customer!.restaurantId)) {
    throw new AppError(400, 'RESTAURANT_MISMATCH', 'Cannot switch table across different restaurants.');
  }

  const customer = await Customer.findById(req.customer!.customerId).select('name');
  const party = await resolveTableParty(table, customer?.name || 'Guest', {
    pin: parsed.data.pin,
    separateTab: parsed.data.separateTab
  });

  const { customerSession, expiresAt } = await createBoundedCustomerSession({
    table,
    restaurantId: restaurant._id,
    customerId: req.customer!.customerId,
    party,
    previousSessionId: req.session.customerSessionId
  });

  await regenerateSession(req);
  req.session.customerSessionId = String(customerSession._id);

  res.json({
    sessionId: String(customerSession._id),
    customer: { id: req.customer!.customerId, name: customer?.name || 'Guest' },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      brandColor: restaurant.brandColor,
      bannerUrl: restaurant.bannerUrl,
      welcomeTagline: restaurant.welcomeTagline,
      upiId: restaurant.upiId,
      googleReviewUrl: restaurant.googleReviewUrl,
      autoConfirmPayments: restaurant.autoConfirmPayments,
      paymentGateway: restaurant.paymentGateway,
      enableDishReviews: restaurant.enableDishReviews
    },
    table: { id: table.id, label: table.label, pin: party.tablePin },
    tab: {
      id: party.tabId,
      label: party.tabLabel,
      isHost: party.isHost,
      isSeparateTab: party.tabId !== 'main'
    },
    expiresAt
  });
});

interface RestaurantMenuHighlights {
  todaysWinner: { menuItemId: string; name: string; quantityToday: number } | null;
  bestsellerItemIds: string[];
  cachedUntil: number;
}

const menuHighlightsCache = new Map<string, RestaurantMenuHighlights>();

async function getMenuHighlights(restaurantId: string): Promise<{
  todaysWinner: { menuItemId: string; name: string; quantityToday: number } | null;
  bestsellerItemIds: string[];
}> {
  const now = Date.now();
  const cached = menuHighlightsCache.get(restaurantId);
  if (cached && cached.cachedUntil > now) {
    return {
      todaysWinner: cached.todaysWinner,
      bestsellerItemIds: cached.bestsellerItemIds
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const rId = new Types.ObjectId(String(restaurantId));

  const [todaysWinnerAgg, pastMonthTopAgg] = await Promise.all([
    Order.aggregate([
      { $match: { restaurantId: rId, status: { $ne: 'REJECTED' }, createdAt: { $gte: startOfToday } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.menuItemId', name: { $first: '$items.name' }, count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]),
    Order.aggregate([
      {
        $match: {
          restaurantId: rId,
          status: { $ne: 'REJECTED' },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      { $unwind: '$items' },
      { $group: { _id: '$items.menuItemId', count: { $sum: '$items.quantity' } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ])
  ]);

  let todaysWinner: { menuItemId: string; name: string; quantityToday: number } | null = null;
  if (todaysWinnerAgg.length > 0 && todaysWinnerAgg[0].count >= 3) {
    todaysWinner = {
      menuItemId: String(todaysWinnerAgg[0]._id),
      name: todaysWinnerAgg[0].name,
      quantityToday: todaysWinnerAgg[0].count
    };
  }

  const bestsellerItemIds = pastMonthTopAgg
    .filter((entry) => entry.count >= 2)
    .map((entry) => String(entry._id));

  const result: RestaurantMenuHighlights = {
    todaysWinner,
    bestsellerItemIds,
    cachedUntil: now + 5 * 60 * 1000
  };

  menuHighlightsCache.set(restaurantId, result);
  return { todaysWinner, bestsellerItemIds };
}

customerRouter.get('/menu', requireCustomer, requireCustomerQr, async (req, res) => {
  const restaurantId = req.customer!.restaurantId;
  const categories = await Category.find({ restaurantId, active: true }).sort({ displayOrder: 1, name: 1 }).lean();
  const items = await MenuItem.find({ restaurantId, categoryId: { $in: categories.map((category) => category._id) } }).sort({ displayOrder: 1, name: 1 }).lean();
  const highlights = await getMenuHighlights(String(restaurantId));
  res.json({
    categories,
    items,
    todaysWinner: highlights.todaysWinner,
    bestsellerItemIds: highlights.bestsellerItemIds
  });
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
  name: z.string().trim().min(2).max(100),
  pin: z.string().trim().optional(),
  separateTab: z.boolean().optional()
});

customerRouter.post('/quick-join', quickJoinRateLimit, async (req, res) => {
  const parsed = quickJoinSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Please enter your name.');
  const cleanName = sanitizePlainText(parsed.data.name);
  if (cleanName.length < 2) throw new AppError(400, 'INVALID_INPUT', 'Please enter a valid name (at least 2 characters).');

  const { table, restaurant } = await resolveActiveTable(parsed.data.token);

  if (restaurant.requireCustomerOtp) {
    throw new AppError(403, 'OTP_REQUIRED', 'This restaurant requires phone number verification via OTP.');
  }

  const party = await resolveTableParty(table, cleanName, {
    pin: parsed.data.pin,
    separateTab: parsed.data.separateTab
  });

  const guestPhone = `guest-${table._id.toString().slice(-6)}-${randomBytes(4).toString('hex')}`;
  const customer = await Customer.create({
    name: cleanName,
    phone: guestPhone
  });

  let customerSession: import('../models/CustomerSession.js').CustomerSessionDoc;
  let expiresAt: Date;
  try {
    ({ customerSession, expiresAt } = await createBoundedCustomerSession({
      table,
      restaurantId: restaurant._id,
      customerId: customer._id,
      party,
      previousSessionId: req.session.customerSessionId
    }));
  } catch (err) {
    await Customer.deleteOne({ _id: customer._id }).catch(() => undefined);
    throw err;
  }
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
      welcomeTagline: restaurant.welcomeTagline,
      upiId: restaurant.upiId,
      googleReviewUrl: restaurant.googleReviewUrl,
      autoConfirmPayments: restaurant.autoConfirmPayments,
      paymentGateway: restaurant.paymentGateway,
      enableDishReviews: restaurant.enableDishReviews
    },
    table: { id: table.id, label: table.label, pin: party.tablePin },
    tab: {
      id: party.tabId,
      label: party.tabLabel,
      isHost: party.isHost,
      isSeparateTab: party.tabId !== 'main'
    },
    expiresAt
  });
});

const cartItemSchema = z.object({
  token: z.string().optional(),
  menuItemId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid item ID'),
  quantity: z.number().int().min(0).max(99),
  selectedVariant: z.object({ name: z.string().trim().min(1).max(60), pricePaise: z.number().int().min(0) }).nullable().optional(),
  selectedAddons: z.array(z.object({ name: z.string().trim().min(1).max(60), pricePaise: z.number().int().min(0) })).optional(),
  notes: z.string().trim().max(200).default('')
});

customerRouter.get('/cart', requireCustomer, requireCustomerQr, async (req, res) => {
  const tabId = req.customer!.tabId || 'main';
  const cart = await TableCart.findOne({ tableId: req.customer!.tableId, tabId, restaurantId: req.customer!.restaurantId }).lean();
  res.json({
    items: (cart?.items || []).map((item) => ({
      menuItemId: String(item.menuItemId),
      name: item.name,
      unitPricePaise: item.unitPricePaise,
      quantity: item.quantity,
      selectedVariant: item.selectedVariant ?? null,
      selectedAddons: item.selectedAddons ?? [],
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

  const tabId = req.customer!.tabId || 'main';
  const cleanNotes = sanitizePlainText(parsed.data.notes);

  // Calculate unit price securely from database menu item definition
  const { unitPricePaise: calculatedUnitPrice, validatedVariant, validatedAddons } = resolveMenuItemLinePricing(
    menuItem,
    parsed.data.selectedVariant,
    parsed.data.selectedAddons
  );

  const variantName = validatedVariant?.name || '';

  // Atomic upsert + retry loop for concurrent cart creation/updates on the same tab
  let savedCart: import('../models/TableCart.js').TableCartDoc | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let cart;
    try {
      cart = await TableCart.findOneAndUpdate(
        { restaurantId: req.customer!.restaurantId, tableId: req.customer!.tableId, tabId },
        { $setOnInsert: { restaurantId: req.customer!.restaurantId, tableId: req.customer!.tableId, tabId, items: [] } },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 11000 && attempt < 2) {
        continue;
      }
      throw err;
    }
    if (!cart) continue;

    const existingIndex = cart.items.findIndex((item) => {
      const itemVariantName = item.selectedVariant?.name || '';
      return String(item.menuItemId) === parsed.data.menuItemId && itemVariantName === variantName;
    });

    if (parsed.data.quantity <= 0) {
      if (existingIndex >= 0) cart.items.splice(existingIndex, 1);
    } else if (existingIndex >= 0 && cart.items[existingIndex]) {
      const existing = cart.items[existingIndex];
      existing.quantity = parsed.data.quantity;
      existing.unitPricePaise = calculatedUnitPrice;
      existing.selectedVariant = validatedVariant;
      (existing as unknown as { selectedAddons: unknown[] }).selectedAddons = validatedAddons;
      if (cleanNotes) existing.notes = cleanNotes;
      existing.addedByName = customer?.name || 'Guest';
    } else {
      cart.items.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        unitPricePaise: calculatedUnitPrice,
        quantity: parsed.data.quantity,
        selectedVariant: validatedVariant,
        selectedAddons: validatedAddons,
        notes: cleanNotes,
        addedByName: customer?.name || 'Guest',
        addedByCustomerId: req.customer!.customerId
      });
    }

    try {
      savedCart = (await cart.save()) as unknown as import('../models/TableCart.js').TableCartDoc;
      break;
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'VersionError' && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
  if (!savedCart) throw new AppError(409, 'CART_CONFLICT', 'Could not update cart due to concurrent edits. Please try again.');

  const serializedItems = savedCart.items.map((item) => ({
    menuItemId: String(item.menuItemId),
    name: item.name,
    unitPricePaise: item.unitPricePaise,
    quantity: item.quantity,
    selectedVariant: item.selectedVariant ?? null,
    selectedAddons: item.selectedAddons ?? [],
    notes: item.notes || '',
    addedByName: item.addedByName || 'Guest'
  }));

  const io = getOrderSocket();
  if (tabId === 'main') {
    io?.to(`table:${req.customer!.tableId}`).emit('table-cart:updated', { items: serializedItems });
  } else {
    io?.to(`tab:${req.customer!.tableId}:${tabId}`).emit('table-cart:updated', { items: serializedItems });
    io?.to(`customer:${req.customer!.sessionId}`).emit('table-cart:updated', { items: serializedItems });
  }

  res.json({ items: serializedItems });
});

customerRouter.delete('/cart', requireCustomer, requireCustomerQr, async (req, res) => {
  const tabId = req.customer!.tabId || 'main';
  await TableCart.findOneAndUpdate({ tableId: req.customer!.tableId, tabId, restaurantId: req.customer!.restaurantId }, { $set: { items: [] } });
  const io = getOrderSocket();
  if (tabId === 'main') {
    io?.to(`table:${req.customer!.tableId}`).emit('table-cart:updated', { items: [] });
  } else {
    io?.to(`tab:${req.customer!.tableId}:${tabId}`).emit('table-cart:updated', { items: [] });
    io?.to(`customer:${req.customer!.sessionId}`).emit('table-cart:updated', { items: [] });
  }
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

customerRouter.get('/history', requireCustomer, requireCustomerQr, async (req, res) => {
  const customerId = req.customer!.customerId;
  const restaurantId = req.customer!.restaurantId;

  // Find previous orders placed by this customer at this restaurant, sorted by newest first
  const pastOrders = await Order.find({
    customerId,
    restaurantId,
    status: { $ne: 'REJECTED' }
  })
    .sort({ createdAt: -1 })
    .limit(10) as unknown as OrderDoc[];

  if (pastOrders.length === 0) {
    return res.json({ lastVisit: null, pastOrders: [] });
  }

  // Get current active menu items so we only show items that are still available
  const availableItems = await MenuItem.find({
    restaurantId,
    available: true
  }).select('_id name pricePaise description dietary imageUrl').lean();

  const availableMap = new Map(availableItems.map((item) => [String(item._id), item]));

  // Deduplicate dishes ordered across their past visits for 1-tap reordering
  const reorderMap = new Map<string, { menuItemId: string; name: string; pricePaise: number; dietaryType?: string; imageUrl?: string; orderCount: number }>();

  for (const order of pastOrders) {
    for (const item of order.items) {
      const active = availableMap.get(String(item.menuItemId));
      if (!active) continue; // Skip item if currently removed or 86'd
      const existing = reorderMap.get(String(item.menuItemId));
      if (existing) {
        existing.orderCount += item.quantity;
      } else {
        reorderMap.set(String(item.menuItemId), {
          menuItemId: String(active._id),
          name: active.name,
          pricePaise: active.pricePaise,
          dietaryType: active.dietary,
          imageUrl: active.imageUrl,
          orderCount: item.quantity
        });
      }
    }
  }

  const latestOrder = pastOrders[0];

  res.json({
    lastVisit: latestOrder ? {
      date: latestOrder.createdAt,
      orderNumber: latestOrder.orderNumber,
      totalPaise: latestOrder.totalPaise
    } : null,
    favoriteItems: Array.from(reorderMap.values()).sort((a, b) => b.orderCount - a.orderCount).slice(0, 6),
    pastOrders: pastOrders.map((o: OrderDoc) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      totalPaise: o.totalPaise,
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, pricePaise: i.unitPricePaise }))
    }))
  });
});

