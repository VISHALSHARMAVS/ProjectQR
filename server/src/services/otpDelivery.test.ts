import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwilioSmsDelivery } from './otpDelivery.js';

describe('TwilioSmsDelivery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the OTP to the E.164 number using a configured sender', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const delivery = new TwilioSmsDelivery({
      accountSid: 'AC123',
      authToken: 'test-token',
      from: '+15005550006'
    });

    await delivery.send('+919876543210', '483920');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const form = init.body as URLSearchParams;
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe(`Basic ${Buffer.from('AC123:test-token').toString('base64')}`);
    expect(form.get('To')).toBe('+919876543210');
    expect(form.get('From')).toBe('+15005550006');
    expect(form.get('Body')).toContain('483920');
    expect(form.get('Body')).toContain('5 minutes');
  });

  it('uses a Messaging Service instead of a sender number when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const delivery = new TwilioSmsDelivery({
      accountSid: 'AC123',
      authToken: 'test-token',
      messagingServiceSid: 'MG123'
    });

    await delivery.send('+919876543210', '483920');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const form = init.body as URLSearchParams;
    expect(form.get('MessagingServiceSid')).toBe('MG123');
    expect(form.has('From')).toBe(false);
  });

  it('returns a safe application error when Twilio rejects the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"sensitive provider details"}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const delivery = new TwilioSmsDelivery({ accountSid: 'AC123', authToken: 'bad-token', from: '+15005550006' });

    await expect(delivery.send('+919876543210', '483920')).rejects.toMatchObject({
      status: 502,
      code: 'SMS_DELIVERY_FAILED',
      message: 'We could not send a verification code right now. Check the number and try again.'
    });
  });

  it('maps network errors to a safe retry message', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network details'));
    vi.stubGlobal('fetch', fetchMock);
    const delivery = new TwilioSmsDelivery({ accountSid: 'AC123', authToken: 'test-token', from: '+15005550006' });

    await expect(delivery.send('+919876543210', '483920')).rejects.toMatchObject({
      status: 502,
      code: 'SMS_DELIVERY_FAILED',
      message: 'SMS delivery is temporarily unavailable. Please try again shortly.'
    });
  });
});
