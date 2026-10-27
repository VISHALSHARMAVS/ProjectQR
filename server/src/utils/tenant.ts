import type { Types } from 'mongoose';

/** Add the authenticated tenant last so filters cannot override it. */
export function tenantFilter<const ID extends Types.ObjectId | string, const T extends Record<string, unknown> = Record<string, never>>(
  restaurantId: ID,
  filters: T = {} as T
): Omit<T, 'restaurantId'> & { restaurantId: ID } {
  return { ...filters, restaurantId };
}
