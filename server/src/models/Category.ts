import { model, Schema, Types } from 'mongoose';

const categorySchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  displayOrder: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });
categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
categorySchema.index({ restaurantId: 1, active: 1, displayOrder: 1 });

export interface CategoryDoc { _id: Types.ObjectId; restaurantId: Types.ObjectId; name: string; description: string; displayOrder: number; active: boolean }
export const Category = model('Category', categorySchema);
