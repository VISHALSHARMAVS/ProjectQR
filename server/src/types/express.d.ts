import type { Types } from 'mongoose';
import type { OrderStatus } from '../models/Order.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    customerSessionId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      staff?: { id: Types.ObjectId; restaurantId: Types.ObjectId; name: string; email: string; role: 'owner' | 'staff' | 'kitchen' };
      customer?: { sessionId: Types.ObjectId; customerId: Types.ObjectId; restaurantId: Types.ObjectId; tableId: Types.ObjectId };
    }
  }
}

export type SafeOrderStatus = OrderStatus;
