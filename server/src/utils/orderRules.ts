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
