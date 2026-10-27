export interface CartLine {
  menuItemId: string;
  name: string;
  unitPricePaise: number;
  quantity: number;
  notes: string;
}

export function addCartLine(lines: CartLine[], item: Omit<CartLine, 'quantity' | 'notes'>): CartLine[] {
  const existing = lines.find((line) => line.menuItemId === item.menuItemId);
  if (existing) return lines.map((line) => line.menuItemId === item.menuItemId ? { ...line, quantity: Math.min(50, line.quantity + 1) } : line);
  return [...lines, { ...item, quantity: 1, notes: '' }];
}

export function setCartQuantity(lines: CartLine[], menuItemId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((line) => line.menuItemId !== menuItemId);
  return lines.map((line) => line.menuItemId === menuItemId ? { ...line, quantity: Math.min(50, Math.floor(quantity)) } : line);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.unitPricePaise * line.quantity, 0);
}

export function readCart(key: string): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is CartLine => Boolean(
      line && typeof line === 'object' &&
      typeof line.menuItemId === 'string' && typeof line.name === 'string' &&
      Number.isSafeInteger(line.unitPricePaise) && line.unitPricePaise >= 0 &&
      Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 50 && typeof line.notes === 'string'
    ));
  } catch {
    return [];
  }
}
