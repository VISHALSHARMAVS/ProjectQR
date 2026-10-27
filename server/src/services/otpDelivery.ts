import { AppError } from '../utils/errors.js';

export interface OtpDelivery {
  send(phone: string, code: string): Promise<void>;
}

export interface TwilioSmsConfiguration {
  accountSid: string;
  authToken: string;
  from?: string;
  messagingServiceSid?: string;
}

export class DevelopmentOtpDelivery implements OtpDelivery {
  async send(phone: string, code: string): Promise<void> {
    console.info(`[DEV MOCK OTP] ending ${phone.slice(-4)}: ${code}`);
  }
}

export class UnconfiguredSmsDelivery implements OtpDelivery {
  async send(_phone: string, _code: string): Promise<void> {
    throw new AppError(503, 'SMS_NOT_CONFIGURED', 'SMS delivery is not configured. Connect an SMS provider before enabling OTP_MODE=sms.');
  }
}

export class TwilioSmsDelivery implements OtpDelivery {
  constructor(private readonly config: TwilioSmsConfiguration) {}

  async send(phone: string, code: string): Promise<void> {
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
        console.error(`[SMS] Twilio rejected a message with HTTP ${response.status}.`);
        throw new AppError(502, 'SMS_DELIVERY_FAILED', 'We could not send a verification code right now. Check the number and try again.');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[SMS] Twilio request failed or timed out.');
      throw new AppError(502, 'SMS_DELIVERY_FAILED', 'SMS delivery is temporarily unavailable. Please try again shortly.');
    }
  }
}
