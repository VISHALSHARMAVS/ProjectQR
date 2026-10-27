import { model, Schema, Types } from 'mongoose';

const customerSessionSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'DiningTable', required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

export interface CustomerSessionDoc { _id: Types.ObjectId; customerId: Types.ObjectId; restaurantId: Types.ObjectId; tableId: Types.ObjectId; expiresAt: Date; revokedAt: Date | null }
export const CustomerSession = model('CustomerSession', customerSessionSchema);
