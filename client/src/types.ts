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
  upiId?: string;
  requireCustomerOtp?: boolean;
  googleReviewUrl?: string;
  autoConfirmPayments?: boolean;
  paymentGateway?: 'direct_upi' | 'razorpay' | 'cashfree' | 'custom';
  gatewayKeyId?: string;
  gatewayKeySecret?: string;
  webhookSecret?: string;
  enableDishReviews?: boolean;
  active?: boolean;
}

export type UserRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'staff';

export interface UserPermissions {
  canViewFinancials: boolean;
  canEditMenu: boolean;
  canManageStock: boolean;
  canSettleBills: boolean;
  canPunchOrders: boolean;
  canManageReviews: boolean;
  canCloseRegister: boolean;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: UserPermissions;
  active?: boolean;
  createdAt?: string;
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
  pin?: string | null;
  createdAt?: string;
}

export interface CustomerTabInfo {
  id: string;
  label: string;
  isHost: boolean;
  isSeparateTab: boolean;
}

export type TableLiveState = 'VACANT' | 'NEEDS_CLEARING' | 'SEATED' | 'PREPARING' | 'READY' | 'HELP_NEEDED' | 'BILL_REQUESTED';

export interface LiveTableInfo {
  id: string;
  label: string;
  active: boolean;
  needsClearing?: boolean;
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
  table: { id?: string; label: string; needsClearing?: boolean };
  customer?: { id?: string; name?: string };
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
  autoConfirmed?: boolean;
  transactionReference?: string | null;
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

export type ReviewSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export type ReviewRootCauseTag =
  | 'FOOD_QUALITY'
  | 'SLOW_SERVICE'
  | 'WRONG_ITEM'
  | 'CLEANLINESS'
  | 'STAFF_BEHAVIOR'
  | 'PORTION_SIZE'
  | 'PRICING'
  | 'AMBIENCE'
  | 'OTHER';

export interface DishRatingPayload {
  menuItemId?: string;
  dishName: string;
  liked: boolean;
  comment?: string;
}

export interface SubmitReviewPayload {
  orderId?: string;
  tableId?: string;
  rating: number; // 1 to 5
  tags?: ReviewRootCauseTag[];
  comment?: string;
  dishRatings?: DishRatingPayload[];
}

export interface ReviewRecord {
  id: string;
  orderId?: string;
  tableLabel?: string;
  customerName?: string;
  rating: number;
  sentiment: ReviewSentiment;
  tags: ReviewRootCauseTag[];
  comment: string;
  dishRatings: {
    menuItemId?: string;
    dishName: string;
    liked: boolean;
    comment: string;
  }[];
  googleReviewClicked: boolean;
  resolved: boolean;
  resolvedBy?: { id: string; name: string };
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  sentimentCounts: Record<ReviewSentiment, number>;
  unresolvedComplaints: number;
  googleClicks: number;
  googleClickConversionRate: number;
}

export interface DishLeaderboardItem {
  dishName: string;
  thumbsUp: number;
  thumbsDown: number;
  totalVotes: number;
  satisfactionRate: number;
}
