import { describe, expect, it } from 'vitest';
import { normalizePhone } from './validation.js';

describe('phone number normalization', () => {
  it('normalizes Indian ten digit input to E.164', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
  });

  it('keeps an explicit international country code', () => {
    expect(normalizePhone('+1 (415) 555-0132')).toBe('+14155550132');
  });

  it('rejects phone input outside supported lengths', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('9'.repeat(18))).toBeNull();
  });
});
