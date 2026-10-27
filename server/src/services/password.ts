import bcrypt from 'bcryptjs';

const cost = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, cost);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
