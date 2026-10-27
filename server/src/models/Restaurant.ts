import { model, Schema, Types } from 'mongoose';

const restaurantSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  logoUrl: { type: String, default: '' },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  contactPhone: { type: String, trim: true, default: '' },
  contactEmail: { type: String, trim: true, lowercase: true, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export interface RestaurantDoc { _id: Types.ObjectId; name: string; slug: string; description: string; logoUrl: string; active: boolean }
export const Restaurant = model('Restaurant', restaurantSchema);
