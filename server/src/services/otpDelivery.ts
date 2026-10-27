import { AppError } from '../utils/errors.js';

export interface OtpDelivery {
  send(phone: string, code?: string): Promise<void>;
  verify?(phone: string, code: string): Promise<boolean>;
}

export interface TwilioSmsConfiguration {
  accountSid: string;
  authToken: string;
  from?: string;
  messagingServiceSid?: string;
}

export interface TwilioVerifyConfiguration {
  accountSid: string;
  authToken: string;
  serviceSid: string;
}

async function getTwilioErrorCode(response: Response): Promise<string | undefined> {
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('code' in payload)) return undefined;

    const code = (payload as { code?: unknown }).code;
    if (typeof code === 'number' && Number.isInteger(code) && code >= 0) return String(code);
    if (typeof code === 'string' && /^\d{3,6}$/.test(code)) return code;
  } catch {
    return undefined;
  }

  return undefined;
}

export class DevelopmentOtpDelivery implements OtpDelivery {
  async send(phone: string, code?: string): Promise<void> {
    if (code) console.info(`[DEV MOCK OTP] ending ${phone.slice(-4)}: ${code}`);
  }
}

export class UnconfiguredSmsDelivery implements OtpDelivery {
  async send(_phone: string, _code?: string): Promise<void> {
    throw new AppError(503, 'SMS_NOT_CONFIGURED', 'SMS delivery is not configured. Connect an SMS provider before enabling OTP_MODE=sms.');
  }
}

export class TwilioSmsDelivery implements OtpDelivery {
  constructor(private readonly config: TwilioSmsConfiguration) {}

  async send(phone: string, code?: string): Promise<void> {
    if (!code) throw new AppError(503, 'SMS_NOT_CONFIGURED', 'A locally generated code is required for Twilio Messaging.');
    const body = new URLSearchParams({
      To: phone,
      Body: `ProjectQR verification code: ${code}. Valid for 5 minutes. Do not share it.`
    });
    if (this.config.messagingServiceSid) body.set('MessagingServiceSid', this.config.messagingServiceSid);
    else if (this.config.from) body.set('From', this.config.from);
    else throw new AppError(503, 'SMS_NOT_CONFIGURED', 'Twilio needs a sender number or Messaging Service SID.');

    const authorization = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${authorization}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body,
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) {
        const errorCode = await getTwilioErrorCode(response);
        const codeDetail = errorCode ? ` (Twilio error ${errorCode})` : '';
        console.error(`[SMS] Twilio rejected a message with HTTP ${response.status}${codeDetail}.`);
        throw new AppError(502, 'SMS_DELIVERY_FAILED', 'We could not send a verification code right now. Check the number and try again.');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[SMS] Twilio request failed or timed out.');
      throw new AppError(502, 'SMS_DELIVERY_FAILED', 'SMS delivery is temporarily unavailable. Please try again shortly.');
    }
  }
}

type TwilioVerifyResponse = { status?: string };

export class TwilioVerifyDelivery implements OtpDelivery {
  constructor(private readonly config: TwilioVerifyConfiguration) {}

  async send(phone: string): Promise<void> {
    await this.request('Verifications', new URLSearchParams({ To: phone, Channel: 'sms' }), 'send');
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const result = await this.request('VerificationCheck', new URLSearchParams({ To: phone, Code: code }), 'check');
    return result.status === 'approved';
  }

  private async request(path: 'Verifications' | 'VerificationCheck', body: URLSearchParams, operation: 'send' | 'check'): Promise<TwilioVerifyResponse> {
    const authorization = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
    try {
      const response = await fetch(`https://verify.twilio.com/v2/Services/${this.config.serviceSid}/${path}`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${authorization}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body,
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) {
        const errorCode = await getTwilioErrorCode(response);
        const codeDetail = errorCode ? ` (Twilio error ${errorCode})` : '';
        console.error(`[OTP] Twilio Verify rejected a ${operation} request with HTTP ${response.status}${codeDetail}.`);
        if (operation === 'check' && (errorCode === '20404' || errorCode === '60202')) return { status: 'expired' };
        throw new AppError(502, 'OTP_PROVIDER_FAILED', 'Phone verification is temporarily unavailable. Please try again shortly.');
      }

      return await response.json() as TwilioVerifyResponse;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error(`[OTP] Twilio Verify ${operation} request failed or timed out.`);
      throw new AppError(502, 'OTP_PROVIDER_FAILED', 'Phone verification is temporarily unavailable. Please try again shortly.');
    }
  }
}
