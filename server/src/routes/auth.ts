import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireStaff } from '../middleware/auth.js';
import { AuthVerification } from '../models/AuthVerification.js';
import { CustomerSession } from '../models/CustomerSession.js';
import { Restaurant } from '../models/Restaurant.js';
import { User } from '../models/User.js';
import {
  consumeDailyEmailQuota,
  createEmailDelivery,
  validateRegistrationEmail,
  verifyTurnstileIfConfigured
} from '../services/emailDelivery.js';
import { DevelopmentOtpDelivery, TwilioSmsDelivery, TwilioVerifyDelivery, type OtpDelivery } from '../services/otpDelivery.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { AppError } from '../utils/errors.js';
import { normalizePhone } from '../utils/validation.js';

const router = Router();
const emailDelivery = createEmailDelivery();

const isTwilioConfigured = (env.OTP_MODE === 'verify' && env.twilioVerifyConfigured) || (env.OTP_MODE === 'sms' && env.twilioSmsConfigured);
const smsDelivery: OtpDelivery = env.OTP_MODE === 'mock' || !isTwilioConfigured
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

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sign-in requests. Try again later.' } })
});

const authOtpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 60 : 6,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'OTP_RATE_LIMITED', message: 'Too many verification requests. Please wait 15 minutes and try again.' } })
});

const strongPasswordSchema = z.string()
  .min(10, 'Password must be at least 10 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), 'Password must include at least one letter and one number');

const registrationSchema = z.object({
  restaurantName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes')
});

const registerRequestSchema = z.object({
  restaurantName: z.string().trim().min(2, 'Enter your restaurant name (at least 2 characters)').max(120),
  ownerName: z.string().trim().min(2, 'Enter your name (at least 2 characters)').max(100),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: strongPasswordSchema,
  turnstileToken: z.string().optional(),
  website: z.string().optional() // Honeypot
});

const registerVerifySchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit verification code')
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(120).optional(),
  email: z.string().trim().min(3).max(120).optional(),
  password: z.string().min(1).max(72)
}).refine((data) => Boolean(data.identifier || data.email), { message: 'Enter your email address or mobile number.' });

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email address or mobile number').max(120),
  turnstileToken: z.string().optional(),
  website: z.string().optional() // Honeypot
});

const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit reset code'),
  newPassword: strongPasswordSchema
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: strongPasswordSchema
});

function makeSlug(name: string): string {
  const base = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'restaurant';
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function regenerateSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
}

function otpHmac(purpose: string, identifier: string, code: string): string {
  return createHmac('sha256', env.OTP_SECRET).update(`${purpose}:${identifier}:${code}`).digest('hex');
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function resolveIdentifierQuery(raw: string): { kind: 'email' | 'phone'; normalized: string } {
  const trimmed = raw.trim();
  if (trimmed.includes('@')) {
    return { kind: 'email', normalized: trimmed.toLowerCase() };
  }
  const phone = normalizePhone(trimmed);
  if (phone) {
    return { kind: 'phone', normalized: phone };
  }
  return { kind: 'email', normalized: trimmed.toLowerCase() };
}

// Step 1 of Email-Verified Restaurant Registration
router.post('/register-request', authOtpRateLimit, async (req, res) => {
  const input = registerRequestSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', input.error.issues[0]?.message ?? 'Please check the submitted information.');
  if (input.data.website && input.data.website.trim().length > 0) {
    throw new AppError(400, 'INVALID_INPUT', 'Unable to process request.');
  }

  await verifyTurnstileIfConfigured(input.data.turnstileToken, req.ip);
  const email = await validateRegistrationEmail(input.data.email);

  if (await User.exists({ email })) {
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists. Please sign in or reset your password.');
  }

  const now = new Date();
  const existing = await AuthVerification.findOne({ purpose: 'REGISTER', identifier: email });
  if (existing) {
    const elapsedMs = now.getTime() - new Date(existing.lastSentAt).getTime();
    if (elapsedMs < 60_000) {
      const waitSec = Math.ceil((60_000 - elapsedMs) / 1000);
      throw new AppError(429, 'OTP_COOLDOWN', `Please wait ${waitSec}s before requesting another verification code.`);
    }
    const windowAgeMs = now.getTime() - new Date(existing.windowStartedAt).getTime();
    if (windowAgeMs < 24 * 60 * 60 * 1000 && existing.resendCount >= 3) {
      throw new AppError(429, 'OTP_RESEND_LIMIT', 'Maximum verification attempts reached for this email today. Please try again tomorrow.');
    }
  }

  await consumeDailyEmailQuota();

  const code = String(randomInt(100_000, 1_000_000));
  const passwordHash = await hashPassword(input.data.password);
  const resetWindow = !existing || (now.getTime() - new Date(existing.windowStartedAt).getTime() >= 24 * 60 * 60 * 1000);

  await AuthVerification.findOneAndUpdate(
    { purpose: 'REGISTER', identifier: email },
    {
      $set: {
        channel: 'email',
        otpHash: otpHmac('REGISTER', email, code),
        attempts: 0,
        lastSentAt: now,
        windowStartedAt: resetWindow ? now : existing!.windowStartedAt,
        resendCount: resetWindow ? 1 : (existing!.resendCount + 1),
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        pendingPayload: {
          restaurantName: input.data.restaurantName,
          ownerName: input.data.ownerName,
          email,
          passwordHash
        }
      }
    },
    { upsert: true }
  );

  const deliveryResult = await emailDelivery.sendOtp({
    to: email,
    code,
    purpose: 'REGISTER',
    restaurantName: input.data.restaurantName
  });

  res.json({
    message: `We sent a 6-digit verification code to ${email}.`,
    expiresInSeconds: 600,
    ...(deliveryResult.mockOtp ? { mockOtp: deliveryResult.mockOtp } : {})
  });
});

// Step 2 of Email-Verified Restaurant Registration
router.post('/register-verify', authRateLimit, async (req, res) => {
  const input = registerVerifySchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', input.error.issues[0]?.message ?? 'Invalid verification code.');

  const email = input.data.email.trim().toLowerCase();
  const record = await AuthVerification.findOne({
    purpose: 'REGISTER',
    identifier: email,
    expiresAt: { $gt: new Date() }
  });

  if (!record || !record.pendingPayload?.restaurantName || !record.pendingPayload?.ownerName || !record.pendingPayload?.passwordHash) {
    throw new AppError(400, 'OTP_EXPIRED', 'Verification code expired or not found. Please request a new code.');
  }

  if (record.attempts >= 5) {
    throw new AppError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect codes. Please request a new verification code.');
  }

  const expectedHash = otpHmac('REGISTER', email, input.data.code);
  if (!safeEqualHex(record.otpHash, expectedHash)) {
    await AuthVerification.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw new AppError(400, 'INVALID_OTP', 'Incorrect verification code. Please check and try again.');
  }

  if (await User.exists({ email })) {
    await AuthVerification.deleteOne({ _id: record._id });
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
  }

  const { restaurantName, ownerName, passwordHash } = record.pendingPayload;
  const restaurant = await Restaurant.create({ name: restaurantName, slug: makeSlug(restaurantName) });
  let createdUserId: string | undefined;
  try {
    const user = await User.create({
      restaurantId: restaurant._id,
      name: ownerName,
      email,
      emailVerified: true,
      passwordHash,
      tokenVersion: 0,
      role: 'owner'
    });
    createdUserId = user.id;
    await AuthVerification.deleteOne({ _id: record._id });
    await regenerateSession(req);
    req.session.userId = String(user._id);
    req.session.tokenVersion = user.tokenVersion ?? 0;
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug }
    });
  } catch (error) {
    if (createdUserId) await User.deleteOne({ _id: createdUserId });
    await Restaurant.deleteOne({ _id: restaurant._id });
    throw error;
  }
});

// Direct registration kept for automated test suites; blocked in production when email verification is required
router.post('/register', authRateLimit, async (req, res) => {
  if (env.NODE_ENV === 'production') {
    throw new AppError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Please verify your email address via /api/auth/register-request before creating a restaurant.');
  }
  const input = registrationSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', input.error.issues[0]?.message ?? 'Please check the submitted information.');
  const { restaurantName, ownerName, email, password } = input.data;
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
  const restaurant = await Restaurant.create({ name: restaurantName, slug: makeSlug(restaurantName) });
  let createdUserId: string | undefined;
  try {
    const passwordHash = await hashPassword(password);
    const user = await User.create({ restaurantId: restaurant._id, name: ownerName, email, emailVerified: true, passwordHash, tokenVersion: 0, role: 'owner' });
    createdUserId = user.id;
    await regenerateSession(req);
    req.session.userId = String(user._id);
    req.session.tokenVersion = user.tokenVersion ?? 0;
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug } });
  } catch (error) {
    if (createdUserId) await User.deleteOne({ _id: createdUserId });
    await Restaurant.deleteOne({ _id: restaurant._id });
    throw error;
  }
});

// Unified Login (Email or Mobile Number) with Brute-Force Lockout
router.post('/login', authRateLimit, async (req, res) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', 'Enter your email or mobile number and password.');

  const rawIdentifier = (input.data.identifier || input.data.email || '').trim();
  const { kind, normalized } = resolveIdentifierQuery(rawIdentifier);
  const query = kind === 'phone' ? { phone: normalized } : { email: normalized };

  const user = await User.findOne(query).select('+passwordHash +failedLoginAttempts +lockUntil');
  if (!user || !user.active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  const now = new Date();
  if (user.lockUntil && new Date(user.lockUntil) > now) {
    const minsLeft = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - now.getTime()) / 60_000));
    throw new AppError(429, 'ACCOUNT_LOCKED', `Too many failed sign-in attempts. Try again in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}.`);
  }

  const passwordValid = await verifyPassword(input.data.password, user.passwordHash || '');
  if (!passwordValid) {
    const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
    const lockUntil = nextAttempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null;
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: nextAttempts >= 5 ? 0 : nextAttempts, lockUntil } }
    );
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email/mobile number or password is incorrect.');
  }

  const restaurant = await Restaurant.findOne({ _id: user.restaurantId, active: true });
  if (!restaurant) throw new AppError(403, 'RESTAURANT_INACTIVE', 'This restaurant account is currently inactive.');

  if ((user.failedLoginAttempts ?? 0) > 0 || user.lockUntil) {
    await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
  }

  await regenerateSession(req);
  req.session.userId = String(user._id);
  req.session.tokenVersion = user.tokenVersion ?? 0;
  res.json({
    user: { id: user.id, name: user.name, email: user.email ?? '', phone: user.phone ?? '', role: user.role },
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug }
  });
});

// Forgot Password: Request 6-digit OTP via Email or SMS (anti-enumeration response)
router.post('/forgot-password', authOtpRateLimit, async (req, res) => {
  const input = forgotPasswordSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', input.error.issues[0]?.message ?? 'Enter your email or mobile number.');
  if (input.data.website && input.data.website.trim().length > 0) {
    throw new AppError(400, 'INVALID_INPUT', 'Unable to process request.');
  }

  await verifyTurnstileIfConfigured(input.data.turnstileToken, req.ip);

  const genericMessage = 'If an account matches that email or mobile number, a 6-digit reset code has been sent.';
  const { kind, normalized } = resolveIdentifierQuery(input.data.identifier);
  const user = await User.findOne(kind === 'phone' ? { phone: normalized, active: true } : { email: normalized, active: true });

  if (!user) {
    return res.json({ message: genericMessage });
  }

  const channel: 'email' | 'sms' = kind === 'email' && user.email ? 'email' : (user.phone ? 'sms' : 'email');
  const target = channel === 'email' ? (user.email || normalized) : (user.phone || normalized);
  const now = new Date();

  const existing = await AuthVerification.findOne({ purpose: 'RESET_PASSWORD', identifier: normalized });
  if (existing) {
    const elapsedMs = now.getTime() - new Date(existing.lastSentAt).getTime();
    if (elapsedMs < 60_000) {
      const waitSec = Math.ceil((60_000 - elapsedMs) / 1000);
      throw new AppError(429, 'OTP_COOLDOWN', `Please wait ${waitSec}s before requesting another reset code.`);
    }
    const windowAgeMs = now.getTime() - new Date(existing.windowStartedAt).getTime();
    if (windowAgeMs < 24 * 60 * 60 * 1000 && existing.resendCount >= 3) {
      throw new AppError(429, 'OTP_RESEND_LIMIT', 'Maximum reset attempts reached today. Please try again tomorrow.');
    }
  }

  if (channel === 'email') {
    await consumeDailyEmailQuota();
  }

  const code = String(randomInt(100_000, 1_000_000));
  const resetWindow = !existing || (now.getTime() - new Date(existing.windowStartedAt).getTime() >= 24 * 60 * 60 * 1000);

  await AuthVerification.findOneAndUpdate(
    { purpose: 'RESET_PASSWORD', identifier: normalized },
    {
      $set: {
        channel,
        otpHash: otpHmac('RESET_PASSWORD', normalized, code),
        attempts: 0,
        lastSentAt: now,
        windowStartedAt: resetWindow ? now : existing!.windowStartedAt,
        resendCount: resetWindow ? 1 : (existing!.resendCount + 1),
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000)
      }
    },
    { upsert: true }
  );

  let mockOtp: string | undefined;
  if (channel === 'email') {
    const result = await emailDelivery.sendOtp({ to: target, code, purpose: 'RESET_PASSWORD' });
    mockOtp = result.mockOtp;
  } else {
    await smsDelivery.send(target, code);
    if (env.NODE_ENV !== 'production') mockOtp = code;
  }

  res.json({
    message: genericMessage,
    expiresInSeconds: 600,
    ...(mockOtp && env.NODE_ENV !== 'production' ? { mockOtp } : {})
  });
});

// Reset Password with 6-digit OTP (invalidates all existing sessions via tokenVersion)
router.post('/reset-password', authRateLimit, async (req, res) => {
  const input = resetPasswordSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', input.error.issues[0]?.message ?? 'Check your reset code and new password.');

  const { kind, normalized } = resolveIdentifierQuery(input.data.identifier);
  const record = await AuthVerification.findOne({
    purpose: 'RESET_PASSWORD',
    identifier: normalized,
    expiresAt: { $gt: new Date() }
  });

  if (!record) {
    throw new AppError(400, 'OTP_EXPIRED', 'Reset code expired or invalid. Please request a new code.');
  }
  if (record.attempts >= 5) {
    throw new AppError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect codes. Please request a new reset code.');
  }

  const expectedHash = otpHmac('RESET_PASSWORD', normalized, input.data.code);
  if (!safeEqualHex(record.otpHash, expectedHash)) {
    await AuthVerification.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw new AppError(400, 'INVALID_OTP', 'Incorrect reset code. Please check and try again.');
  }

  const user = await User.findOne(kind === 'phone' ? { phone: normalized, active: true } : { email: normalized, active: true });
  if (!user) {
    await AuthVerification.deleteOne({ _id: record._id });
    throw new AppError(404, 'USER_NOT_FOUND', 'Account not found.');
  }

  const newHash = await hashPassword(input.data.newPassword);
  await User.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: newHash, failedLoginAttempts: 0, lockUntil: null },
      $inc: { tokenVersion: 1 }
    }
  );
  await AuthVerification.deleteOne({ _id: record._id });

  res.json({ success: true, message: 'Password reset successfully. Please sign in with your new password.' });
});

// Change Password for Logged-in Owner / Staff (rotates tokenVersion & regenerates current session)
router.post('/change-password', requireStaff, async (req, res) => {
  const input = changePasswordSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', input.error.issues[0]?.message ?? 'Check your password fields.');

  if (input.data.currentPassword === input.data.newPassword) {
    throw new AppError(400, 'SAME_PASSWORD', 'New password must be different from your current password.');
  }

  const user = await User.findById(req.staff!.id).select('+passwordHash tokenVersion');
  if (!user || !user.passwordHash) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
  }

  const valid = await verifyPassword(input.data.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }

  const nextTokenVersion = (user.tokenVersion ?? 0) + 1;
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(input.data.newPassword), tokenVersion: nextTokenVersion } }
  );

  await regenerateSession(req);
  req.session.userId = String(user._id);
  req.session.tokenVersion = nextTokenVersion;

  res.json({ success: true, message: 'Password updated successfully. All other sessions have been signed out.' });
});

router.post('/logout', (req, res, next) => {
  const destroy = (): void => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('projectqr.sid');
      res.status(204).end();
    });
  };
  if (!req.session.customerSessionId) return destroy();
  CustomerSession.updateOne({ _id: req.session.customerSessionId, revokedAt: null }, { $set: { revokedAt: new Date() } }).then(destroy, next);
});

router.get('/me', requireStaff, async (req, res) => {
  const restaurant = await Restaurant.findById(req.staff!.restaurantId).select('name slug logoUrl brandColor bannerUrl welcomeTagline description gstin gstPercentage upiId googleReviewUrl autoConfirmPayments paymentGateway gatewayKeyId enableDishReviews defaultLanguage');
  res.json({ user: req.staff, restaurant });
});

export default router;
