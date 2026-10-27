import { AppError } from '../utils/errors.js';

export interface OtpDelivery {
  send(phone: string, code: string): Promise<void>;
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
