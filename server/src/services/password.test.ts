import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password security', () => {
  it('stores a one-way salted hash and verifies only the matching password', async () => {
    const hash = await hashPassword('a-long-test-password');
    expect(hash).not.toBe('a-long-test-password');
    expect(await verifyPassword('a-long-test-password', hash)).toBe(true);
    expect(await verifyPassword('a-different-password', hash)).toBe(false);
  });
});
