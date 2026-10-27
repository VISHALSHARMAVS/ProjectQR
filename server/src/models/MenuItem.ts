import { model, Schema, Types } from 'mongoose';

const menuItemSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  pricePaise: { type: Number, required: true, min: 0, max: 100000000, validate: Number.isSafeInteger },
  imageUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  available: { type: Boolean, default: true },
  preparationMinutes: { type: Number, min: 1, max: 600, default: null },
  displayOrder: { type: Number, min: 0, default: 0 }
}, { timestamps: true });
menuItemSchema.index({ restaurantId: 1, categoryId: 1, available: 1, displayOrder: 1 });

export interface MenuItemDoc { _id: Types.ObjectId; restaurantId: Types.ObjectId; categoryId: Types.ObjectId; name: string; description: string; pricePaise: number; imageUrl: string; available: boolean; preparationMinutes: number | null; displayOrder: number }
export const MenuItem = model('MenuItem', menuItemSchema);
