import { describe, expect, it } from 'vitest';
import { addCartLine, cartSubtotal, setCartQuantity, type CartLine } from './cart';

const item = { menuItemId: 'paneer', name: 'Paneer bowl', unitPricePaise: 36500 };

describe('cart calculations', () => {
  it('adds an item and increments an existing item', () => {
    const first = addCartLine([], item);
    expect(first[0]?.quantity).toBe(1);
    expect(addCartLine(first, item)[0]?.quantity).toBe(2);
  });

  it('removes an item at zero and calculates an integer paise total', () => {
    const lines: CartLine[] = [{ ...item, quantity: 2, notes: '' }];
    expect(cartSubtotal(lines)).toBe(73000);
    expect(setCartQuantity(lines, 'paneer', 0)).toEqual([]);
  });
});
