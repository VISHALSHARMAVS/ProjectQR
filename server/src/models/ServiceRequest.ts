import { model, Schema, Types } from 'mongoose';

export type ServiceRequestType = 'WATER' | 'CUTLERY' | 'BILL' | 'WAITER';

const serviceRequestSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'DiningTable', required: true, index: true },
  type: { type: String, enum: ['WATER', 'CUTLERY', 'BILL', 'WAITER'], required: true },
  status: { type: String, enum: ['PENDING', 'RESOLVED'], default: 'PENDING', index: true },
  notes: { type: String, trim: true, maxlength: 200, default: '' },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

serviceRequestSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });

export interface ServiceRequestDoc {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  type: ServiceRequestType;
  status: 'PENDING' | 'RESOLVED';
  notes: string;
  createdAt: Date;
  resolvedAt?: Date | null;
}

export const ServiceRequest = model('ServiceRequest', serviceRequestSchema);
