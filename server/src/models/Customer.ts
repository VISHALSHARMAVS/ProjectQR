import { model, Schema, Types } from 'mongoose';

const customerSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, unique: true, index: true }
}, { timestamps: true });

export interface CustomerDoc { _id: Types.ObjectId; name: string; phone: string }
export const Customer = model('Customer', customerSchema);
