import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().transform((value) => new URL(value).origin).default('http://localhost:5173'),
  PUBLIC_APP_URL: z.url().transform((value) => new URL(value).origin).default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1)
    .refine((uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://; put the URI after the single MONGODB_URI= assignment in the root .env file.'
    })
    .refine((uri) => {
      const schemeEnd = uri.indexOf('://');
      if (schemeEnd < 0) return true;
      const authority = uri.slice(schemeEnd + 3).split(/[/?#]/, 1)[0] ?? '';
      return (authority.match(/@/g)?.length ?? 0) <= 1;
    }, {
      message: 'URL-encode @ characters inside MongoDB credentials as %40; keep only the final @ before the cluster hostname unencoded.'
    })
    .default('mongodb://127.0.0.1:27017/projectqr'),
  SESSION_SECRET: z.string().min(32).default('local-dev-session-secret-change-before-deploy'),
  OTP_SECRET: z.string().min(32).default('local-dev-otp-secret-change-before-deploy'),
  OTP_MODE: z.enum(['mock', 'sms']).default('mock'),
  UPLOAD_DIR: z.string().default('./uploads'),
  COOKIE_SECURE: z.enum(['true', 'false']).optional()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.OTP_MODE === 'mock') {
  throw new Error('OTP_MODE=mock is only allowed in development or test. Configure an SMS provider for production.');
}
if (parsed.data.NODE_ENV === 'production') {
  const requiredSecrets = ['SESSION_SECRET', 'OTP_SECRET'] as const;
  for (const key of requiredSecrets) {
    if (!process.env[key] || process.env[key]!.length < 32 || process.env[key]!.includes('change-before-deploy')) {
      throw new Error(`${key} must be set to a private value of at least 32 characters in production.`);
    }
  }
  if (!process.env.MONGODB_URI || !process.env.CLIENT_ORIGIN || !process.env.PUBLIC_APP_URL) {
    throw new Error('MONGODB_URI, CLIENT_ORIGIN and PUBLIC_APP_URL must be explicitly configured in production.');
  }
  const publicOrigin = new URL(parsed.data.PUBLIC_APP_URL);
  const clientOrigin = new URL(parsed.data.CLIENT_ORIGIN);
  if (publicOrigin.protocol !== 'https:' || clientOrigin.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(publicOrigin.hostname) || ['localhost', '127.0.0.1'].includes(clientOrigin.hostname)) {
    throw new Error('CLIENT_ORIGIN and PUBLIC_APP_URL must use the deployed HTTPS origin in production.');
  }
}

export const env = {
  ...parsed.data,
  cookieSecure: parsed.data.COOKIE_SECURE === 'true' || parsed.data.NODE_ENV === 'production',
  uploadPath: parsed.data.UPLOAD_DIR
};
