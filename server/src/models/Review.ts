import { model, Schema, Types } from 'mongoose';

export type ReviewSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type ReviewTag = 'FOOD_QUALITY' | 'SPEED' | 'HOSPITALITY' | 'CLEANLINESS' | 'VALUE' | 'AMBIANCE';

const dishRatingSchema = new Schema({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', default: null },
  name: { type: String, required: true },
  thumbsUp: { type: Boolean, required: true }
}, { _id: false });

const reviewSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'DiningTable', required: true, index: true },
  tableLabel: { type: String, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  orderNumber: { type: String, default: '' },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  customerName: { type: String, default: 'Guest', trim: true, maxlength: 100 },
  customerPhone: { type: String, default: '', trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  sentiment: { type: String, enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'], required: true, index: true },
  tags: { type: [String], default: [] },
  comment: { type: String, trim: true, maxlength: 500, default: '' },
  dishRatings: { type: [dishRatingSchema], default: [] },
  status: { type: String, enum: ['NEW', 'RESOLVED'], default: 'NEW', index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNote: { type: String, trim: true, maxlength: 500, default: '' },
  postedToGoogle: { type: Boolean, default: false }
}, { timestamps: true });

reviewSchema.index({ restaurantId: 1, createdAt: -1 });
reviewSchema.index({ restaurantId: 1, sentiment: 1, status: 1 });

export interface DishRatingSnapshot {
  menuItemId: Types.ObjectId;
  name: string;
  thumbsUp: boolean;
}

export interface ReviewDoc {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  tableLabel: string;
  orderId?: Types.ObjectId | null;
  orderNumber?: string;
  customerId?: Types.ObjectId | null;
  customerName: string;
  customerPhone?: string;
  rating: number;
  sentiment: ReviewSentiment;
  tags: string[];
  comment: string;
  dishRatings: DishRatingSnapshot[];
  status: 'NEW' | 'RESOLVED';
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | null;
  resolutionNote?: string;
  postedToGoogle?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const Review = model('Review', reviewSchema);
