import type { MenuItemDoc } from '../models/MenuItem.js';
import type { OrderStatus } from '../models/Order.js';
import { AppError } from './errors.js';

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  REJECTED: []
};

export function nextOrderStatus(current: OrderStatus, next: OrderStatus): OrderStatus {
  if (!transitions[current].includes(next)) {
    throw new AppError(409, 'INVALID_ORDER_TRANSITION', `An order cannot move from ${current} to ${next}.`);
  }
  return next;
}

export function calculateSubtotal(items: { pricePaise: number; quantity: number }[]): number {
  if (items.length === 0 || items.some(({ pricePaise, quantity }) => !Number.isSafeInteger(pricePaise) || pricePaise < 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 50)) {
    throw new AppError(400, 'INVALID_ORDER_ITEMS', 'Add at least one valid menu item to the order.');
  }
  const total = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  if (!Number.isSafeInteger(total)) throw new AppError(400, 'ORDER_TOTAL_TOO_LARGE', 'The order total is too large.');
  return total;
}

export function resolveMenuItemLinePricing(
  menuItem: {
    name: string;
    pricePaise: number;
    variants?: { name: string; pricePaise: number }[] | null;
    addons?: { name: string; pricePaise: number }[] | null;
  },
  selectedVariant?: { name: string; pricePaise?: number } | null,
  selectedAddons?: { name: string; pricePaise?: number }[]
): {
  unitPricePaise: number;
  validatedVariant: { name: string; pricePaise: number } | null;
  validatedAddons: { name: string; pricePaise: number }[];
} {
  let basePrice = menuItem.pricePaise;
  let validatedVariant: { name: string; pricePaise: number } | null = null;

  if (selectedVariant && selectedVariant.name) {
    const match = menuItem.variants?.find((v) => v.name.trim().toLowerCase() === selectedVariant.name.trim().toLowerCase());
    if (!match) {
      throw new AppError(400, 'INVALID_VARIANT', `Variant "${selectedVariant.name}" is not valid for ${menuItem.name}.`);
    }
    basePrice = match.pricePaise;
    validatedVariant = { name: match.name, pricePaise: match.pricePaise };
  }

  const validatedAddons: { name: string; pricePaise: number }[] = [];
  let addonsTotal = 0;
  if (selectedAddons && selectedAddons.length > 0) {
    for (const addonReq of selectedAddons) {
      const match = menuItem.addons?.find((a) => a.name.trim().toLowerCase() === addonReq.name.trim().toLowerCase());
      if (!match) {
        throw new AppError(400, 'INVALID_ADDON', `Addon "${addonReq.name}" is not valid for ${menuItem.name}.`);
      }
      addonsTotal += match.pricePaise;
      validatedAddons.push({ name: match.name, pricePaise: match.pricePaise });
    }
  }

  const unitPricePaise = basePrice + addonsTotal;
  return { unitPricePaise, validatedVariant, validatedAddons };
}
