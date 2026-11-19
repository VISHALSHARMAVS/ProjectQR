import { model, Schema, Types } from 'mongoose';

const restaurantSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  logoUrl: { type: String, default: '' },
  brandColor: { type: String, trim: true, default: '#315b43' },
  bannerUrl: { type: String, trim: true, default: '' },
  welcomeTagline: { type: String, trim: true, maxlength: 200, default: '' },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  contactPhone: { type: String, trim: true, default: '' },
  contactEmail: { type: String, trim: true, lowercase: true, default: '' },
  gstin: { type: String, trim: true, uppercase: true, default: '' },
  gstPercentage: { type: Number, min: 0, max: 28, default: 5 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export interface RestaurantDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  brandColor?: string;
  bannerUrl?: string;
  welcomeTagline?: string;
  gstin?: string;
  gstPercentage?: number;
  active: boolean;
}
export const Restaurant = model('Restaurant', restaurantSchema);
