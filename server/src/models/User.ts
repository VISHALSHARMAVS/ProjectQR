import { model, Schema, Types } from 'mongoose';

export type UserRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'staff';

export interface UserPermissions {
  canViewFinancials: boolean;
  canEditMenu: boolean;
  canManageStock: boolean;
  canSettleBills: boolean;
  canPunchOrders: boolean;
  canManageReviews: boolean;
  canCloseRegister: boolean;
}

export function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case 'owner':
    case 'manager':
      return {
        canViewFinancials: true,
        canEditMenu: true,
        canManageStock: true,
        canSettleBills: true,
        canPunchOrders: true,
        canManageReviews: true,
        canCloseRegister: true
      };
    case 'cashier':
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: true,
        canPunchOrders: true,
        canManageReviews: false,
        canCloseRegister: true
      };
    case 'waiter':
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: false,
        canPunchOrders: true,
        canManageReviews: false,
        canCloseRegister: false
      };
    case 'kitchen':
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: false,
        canPunchOrders: false,
        canManageReviews: false,
        canCloseRegister: false
      };
    case 'staff':
    default:
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: true,
        canPunchOrders: true,
        canManageReviews: true,
        canCloseRegister: false
      };
  }
}

const userSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true, index: true },
  phone: { type: String, trim: true, unique: true, sparse: true, index: true },
  emailVerified: { type: Boolean, default: false },
  passwordHash: { type: String, required: true, select: false },
  tokenVersion: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, default: null, select: false },
  role: {
    type: String,
    enum: ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'staff'],
    default: 'owner',
    required: true
  },
  permissions: {
    canViewFinancials: { type: Boolean, default: false },
    canEditMenu: { type: Boolean, default: false },
    canManageStock: { type: Boolean, default: true },
    canSettleBills: { type: Boolean, default: false },
    canPunchOrders: { type: Boolean, default: false },
    canManageReviews: { type: Boolean, default: false },
    canCloseRegister: { type: Boolean, default: false }
  },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export interface UserDoc {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  passwordHash?: string;
  tokenVersion?: number;
  failedLoginAttempts?: number;
  lockUntil?: Date | null;
  role: UserRole;
  permissions: UserPermissions;
  active: boolean;
}

export const User = model('User', userSchema);
