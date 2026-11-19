import { model, Schema, Types } from 'mongoose';

const tableCartItemSchema = new Schema({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  unitPricePaise: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  selectedVariant: {
    type: new Schema({ name: { type: String, required: true }, pricePaise: { type: Number, required: true } }, { _id: false }),
    default: null
  },
  selectedAddons: {
    type: [new Schema({ name: { type: String, required: true }, pricePaise: { type: Number, required: true } }, { _id: false })],
    default: []
  },
  notes: { type: String, default: '' },
  addedByName: { type: String, default: 'Guest' },
  addedByCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' }
}, { _id: false });

const tableCartSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'DiningTable', required: true, unique: true, index: true },
  items: { type: [tableCartItemSchema], default: [] }
}, { timestamps: true });

export interface TableCartItemDoc {
  menuItemId: Types.ObjectId;
  name: string;
  unitPricePaise: number;
  quantity: number;
  selectedVariant?: { name: string; pricePaise: number } | null;
  selectedAddons?: { name: string; pricePaise: number }[];
  notes?: string;
  addedByName?: string;
  addedByCustomerId?: Types.ObjectId;
}

export interface TableCartDoc {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  items: TableCartItemDoc[];
  updatedAt: Date;
}

export const TableCart = model('TableCart', tableCartSchema);
