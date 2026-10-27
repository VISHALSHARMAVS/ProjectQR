import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Restaurant } from '../models/Restaurant.js';
import { User } from '../models/User.js';
import { CustomerSession } from '../models/CustomerSession.js';
import { requireStaff } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { AppError } from '../utils/errors.js';

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sign-in requests. Try again later.' } })
});
const registrationSchema = z.object({
  restaurantName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes')
});
const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(72) });

function makeSlug(name: string): string {
  const base = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'restaurant';
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function regenerateSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
}

router.post('/register', authRateLimit, async (req, res) => {
  const input = registrationSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', input.error.issues[0]?.message ?? 'Please check the submitted information.');
  const { restaurantName, ownerName, email, password } = input.data;
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
  const restaurant = await Restaurant.create({ name: restaurantName, slug: makeSlug(restaurantName) });
  let createdUserId: string | undefined;
  try {
    const passwordHash = await hashPassword(password);
    const user = await User.create({ restaurantId: restaurant._id, name: ownerName, email, passwordHash, role: 'owner' });
    createdUserId = user.id;
    await regenerateSession(req);
    req.session.userId = String(user._id);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug } });
  } catch (error) {
    if (createdUserId) await User.deleteOne({ _id: createdUserId });
    await Restaurant.deleteOne({ _id: restaurant._id });
    throw error;
  }
});

router.post('/login', authRateLimit, async (req, res) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'INVALID_INPUT', 'Enter a valid email and password.');
  const user = await User.findOne({ email: input.data.email }).select('+passwordHash');
  if (!user || !user.active || !await verifyPassword(input.data.password, user.passwordHash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const restaurant = await Restaurant.findOne({ _id: user.restaurantId, active: true });
  if (!restaurant) throw new AppError(403, 'RESTAURANT_INACTIVE', 'This restaurant account is currently inactive.');
  await regenerateSession(req);
  req.session.userId = String(user._id);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug } });
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
  const restaurant = await Restaurant.findById(req.staff!.restaurantId).select('name slug logoUrl description');
  res.json({ user: req.staff, restaurant });
});

export default router;
