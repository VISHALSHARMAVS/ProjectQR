import { describe, expect, it } from 'vitest';
import { calculateSubtotal, resolveMenuItemLinePricing } from './utils/orderRules.js';

describe('orderRules pricing & validation security', () => {
  const dummyItem = {
    name: 'Paneer Butter Masala',
    pricePaise: 25000,
    variants: [
      { name: 'Half', pricePaise: 16000 },
      { name: 'Full', pricePaise: 28000 }
    ],
    addons: [
      { name: 'Extra Butter', pricePaise: 3000 },
      { name: 'Garlic Naan', pricePaise: 6000 }
    ]
  };

  it('calculates standard base price when no variant or addon is chosen', () => {
    const result = resolveMenuItemLinePricing(dummyItem);
    expect(result.unitPricePaise).toBe(25000);
    expect(result.validatedVariant).toBeNull();
    expect(result.validatedAddons).toEqual([]);
  });

  it('ignores malicious client-sent price on variant and uses database price', () => {
    const maliciousVariant = { name: 'Full', pricePaise: 0 }; // Attacker sends 0
    const result = resolveMenuItemLinePricing(dummyItem, maliciousVariant);
    expect(result.unitPricePaise).toBe(28000); // Enforced to 28000!
    expect(result.validatedVariant).toEqual({ name: 'Full', pricePaise: 28000 });
  });

  it('ignores malicious client-sent price on addons and uses database price', () => {
    const maliciousAddons = [
      { name: 'Extra Butter', pricePaise: 1 },
      { name: 'Garlic Naan', pricePaise: 0 }
    ];
    const result = resolveMenuItemLinePricing(dummyItem, null, maliciousAddons);
    expect(result.unitPricePaise).toBe(25000 + 3000 + 6000); // 34000
    expect(result.validatedAddons).toEqual([
      { name: 'Extra Butter', pricePaise: 3000 },
      { name: 'Garlic Naan', pricePaise: 6000 }
    ]);
  });

  it('rejects unknown variant choices', () => {
    expect(() => {
      resolveMenuItemLinePricing(dummyItem, { name: 'Super Jumbo', pricePaise: 500 });
    }).toThrow('not valid');
  });

  it('rejects unknown addon choices', () => {
    expect(() => {
      resolveMenuItemLinePricing(dummyItem, null, [{ name: 'Free Champagne', pricePaise: 0 }]);
    }).toThrow('not valid');
  });

  it('correctly calculates subtotal with integer bounds', () => {
    const subtotal = calculateSubtotal([
      { pricePaise: 28000, quantity: 2 },
      { pricePaise: 9000, quantity: 1 }
    ]);
    expect(subtotal).toBe(65000);
  });
});
