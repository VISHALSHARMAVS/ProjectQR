import { model, Schema, Types } from 'mongoose';

export const orderStatuses = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'REJECTED'] as const;
export type OrderStatus = typeof orderStatuses[number];

const orderItemSchema = new Schema({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  unitPricePaise: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 50 },
  selectedVariant: {
    type: new Schema({ name: { type: String, required: true }, pricePaise: { type: Number, required: true } }, { _id: false }),
    default: null
  },
  selectedAddons: {
    type: [new Schema({ name: { type: String, required: true }, pricePaise: { type: Number, required: true } }, { _id: false })],
    default: []
  },
  notes: { type: String, trim: true, maxlength: 250, default: '' },
  subtotalPaise: { type: Number, required: true, min: 0 }
}, { _id: false });

const statusEventSchema = new Schema({
  status: { type: String, enum: orderStatuses, required: true },
  at: { type: Date, required: true, default: Date.now },
  note: { type: String, trim: true, maxlength: 300, default: '' }
}, { _id: false });

const orderSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'DiningTable', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: false, default: null },
  customerSessionId: { type: Schema.Types.ObjectId, ref: 'CustomerSession', required: false, default: null },
  createdByStaffId: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },
  tabId: { type: String, default: 'main', index: true },
  tabLabel: { type: String, default: 'Main Table' },
  idempotencyKey: { type: String, required: true, maxlength: 80 },
  orderNumber: { type: String, required: true },
  items: { type: [orderItemSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
  status: { type: String, enum: orderStatuses, default: 'NEW', required: true, index: true },
  statusHistory: { type: [statusEventSchema], default: () => [{ status: 'NEW', at: new Date() }] },
  subtotalPaise: { type: Number, required: true, min: 0 },
  totalPaise: { type: Number, required: true, min: 0 },
  paymentStatus: { type: String, enum: ['UNPAID', 'PAID'], default: 'UNPAID', index: true },
  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'OTHER'], default: null },
  discountPaise: { type: Number, min: 0, default: 0 },
  discountReason: { type: String, trim: true, maxlength: 100, default: '' },
  finalPaidPaise: { type: Number, min: 0, default: 0 },
  settledAt: { type: Date, default: null },
  settledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  autoConfirmed: { type: Boolean, default: false },
  gatewayOrderId: { type: String, trim: true, default: '' },
  gatewayPaymentId: { type: String, trim: true, default: '' },
  transactionReference: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  rejectionReason: { type: String, trim: true, maxlength: 300, default: '' }
}, { timestamps: true });
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: 1 });
orderSchema.index({ restaurantId: 1, paymentStatus: 1, settledAt: -1 });
orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index(
  { customerSessionId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { customerSessionId: { $type: 'objectId' } } }
);

export interface OrderItemSnapshot {
  menuItemId: Types.ObjectId;
  name: string;
  unitPricePaise: number;
  quantity: number;
  selectedVariant?: { name: string; pricePaise: number } | null;
  selectedAddons?: { name: string; pricePaise: number }[];
  notes: string;
  subtotalPaise: number;
}
export interface OrderDoc {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  customerSessionId?: Types.ObjectId | null;
  createdByStaffId?: Types.ObjectId | null;
  tabId?: string;
  tabLabel?: string;
  idempotencyKey: string;
  orderNumber: string;
  items: OrderItemSnapshot[];
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date; note: string }[];
  subtotalPaise: number;
  totalPaise: number;
  paymentStatus: 'UNPAID' | 'PAID';
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'OTHER' | null;
  discountPaise?: number;
  discountReason?: string;
  finalPaidPaise?: number;
  settledAt?: Date | null;
  settledBy?: Types.ObjectId | null;
  autoConfirmed?: boolean;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  transactionReference?: string;
  notes: string;
  rejectionReason: string;
  createdAt: Date;
  updatedAt: Date;
}
export const Order = model('Order', orderSchema);
