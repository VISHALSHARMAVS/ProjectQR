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

export interface MenuItem {
  _id: string;
  categoryId: string;
  name: string;
  description: string;
  pricePaise: number;
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

export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'REJECTED';

export interface TableCartLine {
  menuItemId: string;
  name: string;
  unitPricePaise: number;
  quantity: number;
  notes?: string;
  addedByName?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  table: { label: string };
  items: { menuItemId: string; name: string; unitPricePaise: number; quantity: number; notes: string; subtotalPaise: number }[];
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; note: string }[];
  subtotalPaise: number;
  totalPaise: number;
  notes: string;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
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
