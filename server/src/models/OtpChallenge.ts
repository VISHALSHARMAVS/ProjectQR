import { model, Schema, Types } from 'mongoose';

const otpChallengeSchema = new Schema({
  customerName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, index: true },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'DiningTable', required: true },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  resendCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });
otpChallengeSchema.index({ phone: 1, restaurantId: 1, tableId: 1, createdAt: -1 });
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export interface OtpChallengeDoc { _id: Types.ObjectId; customerName: string; phone: string; restaurantId: Types.ObjectId; tableId: Types.ObjectId; codeHash: string; expiresAt: Date; attempts: number; resendCount: number; lastSentAt: Date; verifiedAt: Date | null }
export const OtpChallenge = model('OtpChallenge', otpChallengeSchema);
