export interface RestaurantInfo {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  brandColor?: string;
  bannerUrl?: string;
  welcomeTagline?: string;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  gstin?: string;
  gstPercentage?: number;
  requireCustomerOtp?: boolean;
  active?: boolean;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff' | 'kitchen';
}

export interface Category {
  _id: string;
  name: string;
  description: string;
  displayOrder: number;
  active: boolean;
}

export type DietaryType = 'VEG' | 'NON_VEG' | 'EGG';

export interface MenuItemVariant {
  name: string;
  pricePaise: number;
}

export interface MenuItemAddon {
  name: string;
  pricePaise: number;
}

export interface MenuItem {
  _id: string;
  categoryId: string;
  name: string;
  description: string;
  pricePaise: number;
  variants?: MenuItemVariant[];
  addons?: MenuItemAddon[];
  imageUrl: string;
  available: boolean;
  dietary?: DietaryType;
  preparationMinutes: number | null;
  displayOrder: number;
}

export interface TableRecord {
  _id: string;
  id?: string;
  label: string;
  active: boolean;
  createdAt?: string;
}

export type TableLiveState = 'VACANT' | 'SEATED' | 'PREPARING' | 'READY' | 'HELP_NEEDED' | 'BILL_REQUESTED';

export interface LiveTableInfo {
  id: string;
  label: string;
  active: boolean;
  state: TableLiveState;
  pendingRequest: {
    id: string;
    type: 'WATER' | 'CUTLERY' | 'BILL' | 'WAITER';
    notes?: string;
    createdAt: string;
  } | null;
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalPaise: number;
    items: { name: string; quantity: number; subtotalPaise: number }[];
    createdAt: string;
  }[];
  totalBillPaise: number;
}

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'REJECTED';

export interface TableCartLine {
  menuItemId: string;
  name: string;
  unitPricePaise: number;
  quantity: number;
  selectedVariant?: MenuItemVariant | null;
  selectedAddons?: MenuItemAddon[];
  notes?: string;
  addedByName?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  table: { label: string };
  items: {
    menuItemId: string;
    name: string;
    unitPricePaise: number;
    quantity: number;
    selectedVariant?: MenuItemVariant | null;
    selectedAddons?: MenuItemAddon[];
    notes: string;
    subtotalPaise: number;
  }[];
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; note: string }[];
  subtotalPaise: number;
  totalPaise: number;
  paymentStatus?: 'UNPAID' | 'PAID';
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'OTHER' | null;
  discountPaise?: number;
  discountReason?: string;
  finalPaidPaise?: number;
  settledAt?: string | null;
  notes: string;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayCloseReport {
  date: string;
  restaurantName: string;
  gstin?: string;
  gstPercentage: number;
  grossSalesPaise: number;
  totalDiscountsPaise: number;
  netSalesPaise: number;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  tenders: {
    cashPaise: number;
    upiPaise: number;
    cardPaise: number;
    otherPaise: number;
    unpaidPaise: number;
  };
  orderCounts: {
    totalOrders: number;
    paidOrders: number;
    unpaidOrders: number;
    rejectedOrders: number;
    totalItemsSold: number;
    averageOrderValuePaise: number;
  };
  settledOrders: {
    id: string;
    orderNumber: string;
    tableLabel: string;
    totalPaise: number;
    discountPaise: number;
    finalPaidPaise: number;
    paymentStatus: string;
    paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'OTHER' | null;
    settledAt: string | null;
    createdAt: string;
  }[];
}

export interface CustomerHistory {
  lastVisit: {
    date: string;
    orderNumber: string;
    totalPaise: number;
  } | null;
  favoriteItems: {
    menuItemId: string;
    name: string;
    pricePaise: number;
    dietaryType?: DietaryType;
    imageUrl?: string;
    orderCount: number;
  }[];
  pastOrders: {
    id: string;
    orderNumber: string;
    createdAt: string;
    totalPaise: number;
    items: { name: string; quantity: number; pricePaise: number }[];
  }[];
}
