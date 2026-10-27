import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const optionalEnvString = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional()
);

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
  OTP_MODE: z.enum(['mock', 'sms', 'verify']).default('mock'),
  TWILIO_ACCOUNT_SID: optionalEnvString,
  TWILIO_AUTH_TOKEN: optionalEnvString,
  TWILIO_FROM: optionalEnvString,
  TWILIO_MESSAGING_SERVICE_SID: optionalEnvString,
  TWILIO_VERIFY_SERVICE_SID: optionalEnvString,
  UPLOAD_DIR: z.string().default('./uploads'),
  COOKIE_SECURE: z.enum(['true', 'false']).optional()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const hasAnyTwilioSetting = [
  parsed.data.TWILIO_ACCOUNT_SID,
  parsed.data.TWILIO_AUTH_TOKEN,
  parsed.data.TWILIO_FROM,
  parsed.data.TWILIO_MESSAGING_SERVICE_SID,
  parsed.data.TWILIO_VERIFY_SERVICE_SID
].some(Boolean);
const hasExactlyOneTwilioSender = Boolean(parsed.data.TWILIO_FROM) !== Boolean(parsed.data.TWILIO_MESSAGING_SERVICE_SID);
const hasTwilioCredentials = Boolean(parsed.data.TWILIO_ACCOUNT_SID && parsed.data.TWILIO_AUTH_TOKEN);
const invalidTwilioConfiguration = hasAnyTwilioSetting && (
  !hasTwilioCredentials ||
  (parsed.data.OTP_MODE === 'sms' && !hasExactlyOneTwilioSender) ||
  (parsed.data.OTP_MODE === 'verify' && !parsed.data.TWILIO_VERIFY_SERVICE_SID)
);
if (invalidTwilioConfiguration || (parsed.data.OTP_MODE === 'verify' && !hasTwilioCredentials)) {
  console.error('Invalid server configuration:', {
    TWILIO: [parsed.data.OTP_MODE === 'verify'
      ? 'OTP_MODE=verify requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID.'
      : 'Set Account SID and Auth Token, and set exactly one of TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID when OTP_MODE=sms.']
  });
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
  twilioSmsConfigured: Boolean(parsed.data.TWILIO_ACCOUNT_SID && parsed.data.TWILIO_AUTH_TOKEN && hasExactlyOneTwilioSender),
  twilioVerifyConfigured: Boolean(parsed.data.TWILIO_ACCOUNT_SID && parsed.data.TWILIO_AUTH_TOKEN && parsed.data.TWILIO_VERIFY_SERVICE_SID),
  cookieSecure: parsed.data.COOKIE_SECURE === 'true' || parsed.data.NODE_ENV === 'production',
  uploadPath: parsed.data.UPLOAD_DIR
};
