import type { Types } from 'mongoose';
import type { OrderStatus } from '../models/Order.js';
import type { UserPermissions, UserRole } from '../models/User.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    customerSessionId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      staff?: {
        id: Types.ObjectId;
        restaurantId: Types.ObjectId;
        name: string;
        email: string;
        role: UserRole;
        permissions?: UserPermissions;
      };
      customer?: {
        sessionId: Types.ObjectId;
        customerId: Types.ObjectId;
        restaurantId: Types.ObjectId;
        tableId: Types.ObjectId;
        tabId?: string;
        tabLabel?: string;
        isHost?: boolean;
      };
    }
  }
}

export type SafeOrderStatus = OrderStatus;
