import { model, Schema } from 'mongoose';

const authVerificationSchema = new Schema({
  purpose: { type: String, enum: ['REGISTER', 'RESET_PASSWORD'], required: true, index: true },
  identifier: { type: String, required: true, trim: true, lowercase: true, index: true },
  channel: { type: String, enum: ['email', 'sms'], required: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  resendCount: { type: Number, default: 1 },
  lastSentAt: { type: Date, required: true, default: () => new Date() },
  windowStartedAt: { type: Date, required: true, default: () => new Date() },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  pendingPayload: {
    restaurantName: { type: String },
    ownerName: { type: String },
    email: { type: String },
    passwordHash: { type: String }
  }
}, { timestamps: true });

authVerificationSchema.index({ purpose: 1, identifier: 1 }, { unique: true });

const emailQuotaSchema = new Schema({
  dateKey: { type: String, required: true, unique: true },
  sentCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
});

export const AuthVerification = model('AuthVerification', authVerificationSchema);
export const EmailQuota = model('EmailQuota', emailQuotaSchema);
