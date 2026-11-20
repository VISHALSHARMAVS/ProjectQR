import { model, Schema, Types } from 'mongoose';

const customerSessionSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'DiningTable', required: true },
  tabId: { type: String, default: 'main', index: true },
  tabLabel: { type: String, default: 'Main Table' },
  isHost: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

export interface CustomerSessionDoc {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  tabId?: string;
  tabLabel?: string;
  isHost?: boolean;
  expiresAt: Date;
  revokedAt: Date | null;
}
export const CustomerSession = model('CustomerSession', customerSessionSchema);
