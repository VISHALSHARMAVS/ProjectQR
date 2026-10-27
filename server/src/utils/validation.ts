import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const labelSchema = z.string().trim().min(1).max(40);

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `+${digits}`;
}

export const phoneSchema = z.string().trim().min(8).max(25).transform(normalizePhone).refine((value): value is string => value !== null, 'Enter a valid phone number');
