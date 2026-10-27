import { model, Schema, Types } from 'mongoose';

const tableSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  label: { type: String, required: true, trim: true, maxlength: 40 },
  qrToken: { type: String, required: true, unique: true, index: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });
tableSchema.index({ restaurantId: 1, label: 1 }, { unique: true });

export interface DiningTableDoc { _id: Types.ObjectId; restaurantId: Types.ObjectId; label: string; qrToken: string; active: boolean }
export const DiningTable = model('DiningTable', tableSchema);
