import { describe, expect, it } from 'vitest';
import { calculateSubtotal, nextOrderStatus } from './orderRules.js';

describe('order rules', () => {
  it('calculates order totals using integer paise', () => {
    expect(calculateSubtotal([{ pricePaise: 1250, quantity: 2 }, { pricePaise: 999, quantity: 1 }])).toBe(3499);
  });

  it('accepts only the intended kitchen transitions', () => {
    expect(nextOrderStatus('NEW', 'ACCEPTED')).toBe('ACCEPTED');
    expect(nextOrderStatus('READY', 'DELIVERED')).toBe('DELIVERED');
    expect(() => nextOrderStatus('NEW', 'READY')).toThrow(/cannot move from NEW to READY/);
    expect(() => nextOrderStatus('DELIVERED', 'PREPARING')).toThrow();
  });

  it('rejects empty, fractional and unreasonable quantities', () => {
    expect(() => calculateSubtotal([])).toThrow();
    expect(() => calculateSubtotal([{ pricePaise: 100, quantity: 1.5 }])).toThrow();
    expect(() => calculateSubtotal([{ pricePaise: 100, quantity: 51 }])).toThrow();
  });
});
