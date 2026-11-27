import { model, Schema, Types } from 'mongoose';

const categoryTranslationSchema = new Schema({
  name: { type: String, trim: true, maxlength: 80, default: '' },
  description: { type: String, trim: true, maxlength: 300, default: '' }
}, { _id: false });

const categorySchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  translations: {
    type: new Schema({
      hi: { type: categoryTranslationSchema, default: () => ({}) },
      mr: { type: categoryTranslationSchema, default: () => ({}) }
    }, { _id: false }),
    default: () => ({})
  },
  displayOrder: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });
categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
categorySchema.index({ restaurantId: 1, active: 1, displayOrder: 1 });

export interface CategoryTranslations {
  hi?: { name?: string; description?: string };
  mr?: { name?: string; description?: string };
}

export interface CategoryDoc { _id: Types.ObjectId; restaurantId: Types.ObjectId; name: string; description: string; translations?: CategoryTranslations; displayOrder: number; active: boolean }
export const Category = model('Category', categorySchema);
