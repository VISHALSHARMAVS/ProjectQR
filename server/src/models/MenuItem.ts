import { model, Schema, Types } from 'mongoose';

const variantOptionSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  pricePaise: { type: Number, required: true, min: 0, max: 100000000, validate: Number.isSafeInteger }
}, { _id: false });

const addonOptionSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  pricePaise: { type: Number, required: true, min: 0, max: 100000000, validate: Number.isSafeInteger }
}, { _id: false });

const menuItemSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  pricePaise: { type: Number, required: true, min: 0, max: 100000000, validate: Number.isSafeInteger },
  variants: { type: [variantOptionSchema], default: [] },
  addons: { type: [addonOptionSchema], default: [] },
  imageUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  available: { type: Boolean, default: true },
  dietary: { type: String, enum: ['VEG', 'NON_VEG', 'EGG'], default: 'VEG' },
  preparationMinutes: { type: Number, min: 1, max: 600, default: null },
  displayOrder: { type: Number, min: 0, default: 0 }
}, { timestamps: true });
menuItemSchema.index({ restaurantId: 1, categoryId: 1, available: 1, displayOrder: 1 });

export interface MenuItemVariant { name: string; pricePaise: number }
export interface MenuItemAddon { name: string; pricePaise: number }
export interface MenuItemDoc {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  description: string;
  pricePaise: number;
  variants: MenuItemVariant[];
  addons: MenuItemAddon[];
  imageUrl: string;
  available: boolean;
  dietary?: 'VEG' | 'NON_VEG' | 'EGG';
  preparationMinutes: number | null;
  displayOrder: number;
}
export const MenuItem = model('MenuItem', menuItemSchema);
