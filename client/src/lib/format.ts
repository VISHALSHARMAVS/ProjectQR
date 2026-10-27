export const money = (paise: number): string => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

export function paiseFromRupees(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(value)) return null;
  const paise = Math.round(Number(value) * 100);
  return Number.isSafeInteger(paise) ? paise : null;
}

export function elapsedSince(date: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}
