import type { NextFunction, Request, Response } from 'express';
import { CustomerSession } from '../models/CustomerSession.js';
import { DiningTable } from '../models/DiningTable.js';
import { Restaurant } from '../models/Restaurant.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';

export async function requireStaff(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) return next(new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'));
  const user = await User.findById(req.session.userId).select('_id restaurantId name email role active');
  const restaurantActive = user ? await Restaurant.exists({ _id: user.restaurantId, active: true }) : null;
  if (!user || !user.active || !restaurantActive) {
    req.session.destroy(() => undefined);
    return next(new AppError(401, 'AUTH_REQUIRED', 'Your session is no longer active. Please sign in again.'));
  }
  req.staff = { id: user._id, restaurantId: user.restaurantId, name: user.name, email: user.email, role: user.role };
  next();
}

export function requireRoles(...roles: ('owner' | 'staff' | 'kitchen')[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff || !roles.includes(req.staff.role)) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.'));
    next();
  };
}

export async function requireCustomer(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.session.customerSessionId;
  if (!sessionId) return next(new AppError(401, 'CUSTOMER_SESSION_REQUIRED', 'Verify your phone to continue.'));
  const customerSession = await CustomerSession.findOne({ _id: sessionId, revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!customerSession) {
    delete req.session.customerSessionId;
    return next(new AppError(401, 'CUSTOMER_SESSION_EXPIRED', 'Your ordering session expired. Please verify your phone again.'));
  }
  const tableBelongsToRestaurant = await DiningTable.exists({ _id: customerSession.tableId, restaurantId: customerSession.restaurantId });
  const restaurantExists = await Restaurant.exists({ _id: customerSession.restaurantId });
  if (!tableBelongsToRestaurant || !restaurantExists) {
    customerSession.revokedAt = new Date();
    await customerSession.save();
    delete req.session.customerSessionId;
    return next(new AppError(401, 'CUSTOMER_SESSION_EXPIRED', 'This ordering session is no longer available.'));
  }
  req.customer = {
    sessionId: customerSession._id,
    customerId: customerSession.customerId,
    restaurantId: customerSession.restaurantId,
    tableId: customerSession.tableId
  };
  next();
}

export async function requireCustomerQr(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.method === 'GET' ? req.query.token : req.body?.token;
  if (!req.customer || typeof token !== 'string') return next(new AppError(400, 'TABLE_TOKEN_REQUIRED', 'Reopen this page from your table QR code.'));
  const table = await DiningTable.exists({ _id: req.customer.tableId, restaurantId: req.customer.restaurantId, qrToken: token });
  if (!table) return next(new AppError(403, 'CUSTOMER_SESSION_TABLE_MISMATCH', 'This session belongs to a different table. Verify your phone for this table to continue.'));
  next();
}
