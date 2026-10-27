export interface RestaurantInfo {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
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

export interface MenuItem {
  _id: string;
  categoryId: string;
  name: string;
  description: string;
  pricePaise: number;
  imageUrl: string;
  available: boolean;
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
