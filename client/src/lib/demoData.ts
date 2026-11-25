import type { Category, MenuItem, OrderRecord, RestaurantInfo, TableRecord } from '../types';

export interface DemoState {
  restaurant: RestaurantInfo;
  categories: Category[];
  items: MenuItem[];
  tables: (TableRecord & { status: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED'; activeOrdersCount: number })[];
  orders: OrderRecord[];
}

const STORAGE_KEY = 'mesa_interactive_demo_v3';

export const initialDemoRestaurant: RestaurantInfo = {
  id: 'demo-rest-01',
  name: 'The Olive Tree Bistro & Cafe',
  description: 'Artisanal sourdough, wood-fired mains and craft drinks',
  brandColor: '#1b4d3e',
  gstin: '27AABCU9603R1ZM',
  gstPercentage: 5,
  upiId: 'olivetree@okhdfcbank',
  requireCustomerOtp: false,
  autoConfirmPayments: true,
  enableDishReviews: true,
  welcomeTagline: 'Welcome to your table'
};

export const initialDemoCategories: Category[] = [
  { _id: 'cat-1', name: 'Small plates & Starters', description: 'Fresh appetizers and dips to share', displayOrder: 1, active: true },
  { _id: 'cat-2', name: 'Wood-fired mains', description: 'Signature clay-oven roasts and sourdough specialties', displayOrder: 2, active: true },
  { _id: 'cat-3', name: 'Artisanal brews & Coolers', description: 'Cold-pressed tonics and speciality coffees', displayOrder: 3, active: true },
  { _id: 'cat-4', name: 'Handcrafted desserts', description: 'Traditional sweets with a modern twist', displayOrder: 4, active: true }
];

export const initialDemoItems: MenuItem[] = [
  {
    _id: 'item-1',
    categoryId: 'cat-1',
    name: 'Paneer Tikka Sourdough Toast',
    description: 'Charred cottage cheese cubes over in-house fermented sourdough with mint emulsion and pickled onions',
    pricePaise: 34000,
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=500&q=80',
    available: true,
    dietary: 'VEG',
    preparationMinutes: 10,
    displayOrder: 1,
    variants: [
      { name: 'Regular portion', pricePaise: 34000 },
      { name: 'Sharing platter (Double)', pricePaise: 58000 }
    ],
    addons: [
      { name: 'Extra smoked garlic butter', pricePaise: 4000 },
      { name: 'Artisanal dip sampler', pricePaise: 6000 }
    ]
  },
  {
    _id: 'item-2',
    categoryId: 'cat-1',
    name: 'Crispy Truffle Fries',
    description: 'Double fried potato batons tossed in white truffle oil and rosemary salt',
    pricePaise: 26000,
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80',
    available: true,
    dietary: 'VEG',
    preparationMinutes: 8,
    displayOrder: 2
  },
  {
    _id: 'item-3',
    categoryId: 'cat-2',
    name: 'Wild Mushroom Sourdough Pizza',
    description: 'Shiitake, button and oyster mushrooms over San Marzano sauce and fior di latte mozzarella',
    pricePaise: 54000,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80',
    available: true,
    dietary: 'VEG',
    preparationMinutes: 14,
    displayOrder: 1,
    variants: [
      { name: '10-inch Medium', pricePaise: 54000 },
      { name: '12-inch Large', pricePaise: 69000 }
    ]
  },
  {
    _id: 'item-4',
    categoryId: 'cat-2',
    name: 'Smoked Chicken & Rosemary Flatbread',
    description: 'Slow-smoked pulled chicken breast, caramelized balsamic shallots and pecorino cheese',
    pricePaise: 58000,
    imageUrl: 'https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=500&q=80',
    available: true,
    dietary: 'NON_VEG',
    preparationMinutes: 15,
    displayOrder: 2
  },
  {
    _id: 'item-5',
    categoryId: 'cat-3',
    name: 'Valencia Orange Cold Brew Tonic',
    description: 'Single-origin Karnataka arabica cold brew shaken with sparkling tonic and fresh orange peel',
    pricePaise: 22000,
    imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=500&q=80',
    available: true,
    dietary: 'VEG',
    preparationMinutes: 5,
    displayOrder: 1
  },
  {
    _id: 'item-6',
    categoryId: 'cat-4',
    name: 'Saffron Pistachio Tres Leches',
    description: 'Kashmiri saffron soaked sponge cake crowned with crushed roasted pistachios',
    pricePaise: 31000,
    imageUrl: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=500&q=80',
    available: true,
    dietary: 'VEG',
    preparationMinutes: 4,
    displayOrder: 1
  }
];

export const initialDemoTables: (TableRecord & { status: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED'; activeOrdersCount: number })[] = [
  { _id: 'tbl-1', label: 'Table 1', active: true, pin: '4192', status: 'OCCUPIED', activeOrdersCount: 1 },
  { _id: 'tbl-2', label: 'Table 2', active: true, pin: '8831', status: 'OCCUPIED', activeOrdersCount: 1 },
  { _id: 'tbl-3', label: 'Table 3', active: true, pin: '2049', status: 'AVAILABLE', activeOrdersCount: 0 },
  { _id: 'tbl-4', label: 'Table 4', active: true, pin: '7712', status: 'OCCUPIED', activeOrdersCount: 1 },
  { _id: 'tbl-5', label: 'Table 5', active: true, pin: null, status: 'AVAILABLE', activeOrdersCount: 0 },
  { _id: 'tbl-6', label: 'Table 6', active: true, pin: null, status: 'AVAILABLE', activeOrdersCount: 0 },
  { _id: 'tbl-7', label: 'Table 7', active: true, pin: '6021', status: 'BILL_REQUESTED', activeOrdersCount: 1 },
  { _id: 'tbl-8', label: 'Table 8', active: true, pin: null, status: 'AVAILABLE', activeOrdersCount: 0 }
];

export const initialDemoOrders: OrderRecord[] = [
  {
    id: 'ord-101',
    orderNumber: 'TK-101',
    table: { id: 'tbl-1', label: 'Table 1' },
    customer: { id: 'cust-1', name: 'Pooja V.' },
    status: 'READY',
    statusHistory: [{ status: 'READY', at: new Date(Date.now() - 14 * 60 * 1000).toISOString(), note: 'Ready for runner' }],
    paymentStatus: 'PAID',
    paymentMethod: 'UPI',
    autoConfirmed: true,
    items: [
      { menuItemId: 'item-1', name: 'Paneer Tikka Sourdough Toast', unitPricePaise: 34000, quantity: 1, subtotalPaise: 34000, selectedVariant: { name: 'Regular portion', pricePaise: 34000 }, notes: '' },
      { menuItemId: 'item-5', name: 'Valencia Orange Cold Brew Tonic', unitPricePaise: 22000, quantity: 2, subtotalPaise: 44000, notes: '' }
    ],
    subtotalPaise: 78000,
    totalPaise: 81900,
    notes: '',
    rejectionReason: '',
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString()
  },
  {
    id: 'ord-102',
    orderNumber: 'TK-102',
    table: { id: 'tbl-2', label: 'Table 2' },
    customer: { id: 'cust-2', name: 'Karan Mehra' },
    status: 'ACCEPTED',
    statusHistory: [{ status: 'ACCEPTED', at: new Date(Date.now() - 6 * 60 * 1000).toISOString(), note: 'Order accepted' }],
    paymentStatus: 'PAID',
    paymentMethod: 'UPI',
    autoConfirmed: true,
    items: [
      { menuItemId: 'item-3', name: 'Wild Mushroom Sourdough Pizza', unitPricePaise: 54000, quantity: 1, subtotalPaise: 54000, selectedVariant: { name: '10-inch Medium', pricePaise: 54000 }, notes: 'Extra crispy crust' }
    ],
    subtotalPaise: 54000,
    totalPaise: 56700,
    notes: 'Extra crispy crust requested',
    rejectionReason: '',
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString()
  },
  {
    id: 'ord-103',
    orderNumber: 'TK-103',
    table: { id: 'tbl-4', label: 'Table 4' },
    customer: { id: 'cust-3', name: 'Ananya S.' },
    status: 'PREPARING',
    statusHistory: [{ status: 'PREPARING', at: new Date(Date.now() - 11 * 60 * 1000).toISOString(), note: 'Cooking in kitchen' }],
    paymentStatus: 'PAID',
    paymentMethod: 'UPI',
    autoConfirmed: true,
    items: [
      { menuItemId: 'item-4', name: 'Smoked Chicken & Rosemary Flatbread', unitPricePaise: 58000, quantity: 1, subtotalPaise: 58000, notes: '' },
      { menuItemId: 'item-2', name: 'Crispy Truffle Fries', unitPricePaise: 26000, quantity: 1, subtotalPaise: 26000, notes: '' }
    ],
    subtotalPaise: 84000,
    totalPaise: 88200,
    notes: '',
    rejectionReason: '',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString()
  }
];

export function getInitialDemoState(): DemoState {
  return {
    restaurant: initialDemoRestaurant,
    categories: initialDemoCategories,
    items: initialDemoItems,
    tables: initialDemoTables,
    orders: initialDemoOrders
  };
}

export function loadDemoState(): DemoState {
  if (typeof window === 'undefined') return getInitialDemoState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.restaurant && parsed.items && parsed.orders && parsed.tables) {
        return parsed;
      }
    }
  } catch {
    // Fallback on parse failure
  }
  const defaultState = getInitialDemoState();
  saveDemoState(defaultState);
  return defaultState;
}

export function saveDemoState(state: DemoState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable
  }
}

export function resetDemoState(): DemoState {
  const fresh = getInitialDemoState();
  saveDemoState(fresh);
  return fresh;
}
