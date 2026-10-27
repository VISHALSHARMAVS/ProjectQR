import { describe, expect, it } from 'vitest';
import { tenantFilter } from './tenant.js';

describe('tenant isolation filters', () => {
  it('always uses the authenticated restaurant, even if another tenant is present in a filter', () => {
    expect(tenantFilter('restaurant-a', { _id: 'item-id', restaurantId: 'restaurant-b' })).toEqual({ _id: 'item-id', restaurantId: 'restaurant-a' });
  });

  it('keeps the resource constraint while requiring the authenticated tenant', () => {
    expect(tenantFilter('restaurant-a', { _id: 'other-restaurant-resource' })).toEqual({ _id: 'other-restaurant-resource', restaurantId: 'restaurant-a' });
  });
});
