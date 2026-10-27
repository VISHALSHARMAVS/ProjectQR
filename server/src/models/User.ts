import { model, Schema, Types } from 'mongoose';

const userSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['owner', 'staff', 'kitchen'], default: 'owner', required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export interface UserDoc { _id: Types.ObjectId; restaurantId: Types.ObjectId; name: string; email: string; passwordHash?: string; role: 'owner' | 'staff' | 'kitchen'; active: boolean }
export const User = model('User', userSchema);
