import { model, Schema, Types } from 'mongoose';

export const orderStatuses = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'REJECTED'] as const;
export type OrderStatus = typeof orderStatuses[number];

const orderItemSchema = new Schema({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  unitPricePaise: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 50 },
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
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerSessionId: { type: Schema.Types.ObjectId, ref: 'CustomerSession', required: true },
  idempotencyKey: { type: String, required: true, maxlength: 80 },
  orderNumber: { type: String, required: true },
  items: { type: [orderItemSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
  status: { type: String, enum: orderStatuses, default: 'NEW', required: true, index: true },
  statusHistory: { type: [statusEventSchema], default: () => [{ status: 'NEW', at: new Date() }] },
  subtotalPaise: { type: Number, required: true, min: 0 },
  totalPaise: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  rejectionReason: { type: String, trim: true, maxlength: 300, default: '' }
}, { timestamps: true });
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: 1 });
orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ customerSessionId: 1, idempotencyKey: 1 }, { unique: true });

export interface OrderItemSnapshot { menuItemId: Types.ObjectId; name: string; unitPricePaise: number; quantity: number; notes: string; subtotalPaise: number }
export interface OrderDoc { _id: Types.ObjectId; restaurantId: Types.ObjectId; tableId: Types.ObjectId; customerId: Types.ObjectId; customerSessionId: Types.ObjectId; idempotencyKey: string; orderNumber: string; items: OrderItemSnapshot[]; status: OrderStatus; statusHistory: { status: OrderStatus; at: Date; note: string }[]; subtotalPaise: number; totalPaise: number; notes: string; rejectionReason: string; createdAt: Date; updatedAt: Date }
export const Order = model('Order', orderSchema);
