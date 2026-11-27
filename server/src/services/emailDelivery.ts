import { resolveMx } from 'node:dns/promises';
import { env } from '../config/env.js';
import { EmailQuota } from '../models/AuthVerification.js';
import { AppError } from '../utils/errors.js';

const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'dispostable.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'sharklasers.com',
  'spam4.me',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmail.net',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net'
]);

const TYPO_DOMAIN_SUGGESTIONS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com'
};

export async function validateRegistrationEmail(rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1) {
    throw new AppError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  }
  const domain = email.slice(atIndex + 1);

  const typoSuggestion = TYPO_DOMAIN_SUGGESTIONS[domain];
  if (typoSuggestion) {
    throw new AppError(400, 'EMAIL_TYPO', `Did you mean @${typoSuggestion}? Please check your email address.`);
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw new AppError(400, 'DISPOSABLE_EMAIL', 'Temporary or disposable email addresses are not allowed. Please use your business or personal email.');
  }

  // Verify the domain has MX records in live/Resend mode so typos/fake domains never waste email quota
  if (env.NODE_ENV !== 'test' && env.EMAIL_MODE === 'resend') {
    try {
      const mxRecords = await resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        throw new AppError(400, 'UNREACHABLE_EMAIL_DOMAIN', 'This email domain cannot receive emails. Please check for typos.');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(400, 'UNREACHABLE_EMAIL_DOMAIN', 'Could not verify that email domain. Please check for typos.');
    }
  }

  return email;
}

export async function verifyTurnstileIfConfigured(token: string | undefined, remoteIp: string | undefined): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (!token || !token.trim()) {
    throw new AppError(400, 'BOT_CHECK_REQUIRED', 'Please complete the security check before continuing.');
  }
  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token.trim(),
    ...(remoteIp ? { remoteip: remoteIp } : {})
  });
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });
  const data = (await resp.json().catch(() => ({}))) as { success?: boolean };
  if (!resp.ok || !data.success) {
    throw new AppError(400, 'BOT_CHECK_FAILED', 'Security verification failed. Please refresh and try again.');
  }
}

export async function consumeDailyEmailQuota(): Promise<void> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // Ensure today's quota document exists
  await EmailQuota.updateOne(
    { dateKey },
    { $setOnInsert: { dateKey, sentCount: 0, expiresAt } },
    { upsert: true }
  );
  const updated = await EmailQuota.findOneAndUpdate(
    { dateKey, sentCount: { $lt: env.EMAIL_DAILY_LIMIT } },
    { $inc: { sentCount: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw new AppError(429, 'EMAIL_QUOTA_EXCEEDED', 'Daily verification email limit reached. Please try again tomorrow.');
  }
}

export interface EmailOtpInput {
  to: string;
  code: string;
  purpose: 'REGISTER' | 'RESET_PASSWORD';
  restaurantName?: string;
}

export interface EmailDelivery {
  sendOtp(input: EmailOtpInput): Promise<{ mockOtp?: string }>;
}

export class MockEmailDelivery implements EmailDelivery {
  async sendOtp(input: EmailOtpInput): Promise<{ mockOtp?: string }> {
    if (env.NODE_ENV === 'development') {
      console.info(`[DEV MOCK EMAIL OTP] (${input.purpose}) to ${input.to}: ${input.code}`);
    }
    return env.NODE_ENV === 'production' ? {} : { mockOtp: input.code };
  }
}

export class ResendEmailDelivery implements EmailDelivery {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async sendOtp(input: EmailOtpInput): Promise<{ mockOtp?: string }> {
    const isRegister = input.purpose === 'REGISTER';
    const subject = isRegister
      ? `${input.code} is your Mesa verification code`
      : `${input.code} is your Mesa password reset code`;
    const heading = isRegister
      ? `Verify your restaurant${input.restaurantName ? ` (${input.restaurantName})` : ''}`
      : 'Reset your Mesa password';
    const bodyText = isRegister
      ? `Use this 6-digit code to verify your email and finish creating your restaurant workspace: ${input.code}. It expires in 10 minutes.`
      : `Use this 6-digit code to reset your Mesa password: ${input.code}. It expires in 10 minutes. If you did not request this, you can safely ignore this email.`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18201b;">
        <h2 style="margin: 0 0 12px; color: #315b43;">${heading}</h2>
        <p style="margin: 0 0 20px; line-height: 1.5; font-size: 14px;">${bodyText}</p>
        <div style="background: #f4f7f5; border: 1px solid #d7e2db; border-radius: 10px; padding: 16px; text-align: center; letter-spacing: 8px; font-size: 28px; font-weight: 800; color: #315b43;">
          ${input.code}
        </div>
        <p style="margin: 18px 0 0; font-size: 12px; color: #64748b;">Never share this code with anyone. Mesa staff will never ask for your verification code.</p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject,
        html,
        text: bodyText
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[ResendEmailDelivery] Failed to send email:', response.status, errText);
      throw new AppError(502, 'EMAIL_DELIVERY_FAILED', 'Could not send verification email right now. Please try again in a moment.');
    }

    return {};
  }
}

export function createEmailDelivery(): EmailDelivery {
  if (env.EMAIL_MODE === 'resend' && env.resendConfigured) {
    return new ResendEmailDelivery(env.RESEND_API_KEY!, env.EMAIL_FROM!);
  }
  return new MockEmailDelivery();
}
