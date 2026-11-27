import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CashfreeAdapter,
  DirectBankAcquirerAdapter,
  RazorpayAdapter,
  resolvePaymentAdapter
} from './paymentAdapters.js';

describe('paymentAdapters (Strategy + Adapter pattern)', () => {
  it('resolves the expected adapter strategy from restaurant.paymentGateway', () => {
    expect(resolvePaymentAdapter({ paymentGateway: 'razorpay' })).toBeInstanceOf(RazorpayAdapter);
    expect(resolvePaymentAdapter({ paymentGateway: 'cashfree' })).toBeInstanceOf(CashfreeAdapter);

    const custom = resolvePaymentAdapter({ paymentGateway: 'custom' });
    expect(custom).toBeInstanceOf(DirectBankAcquirerAdapter);
    expect(custom.name).toBe('custom');

    const direct = resolvePaymentAdapter({ paymentGateway: 'direct_upi' });
    expect(direct).toBeInstanceOf(DirectBankAcquirerAdapter);
    expect(direct.name).toBe('direct_upi');
  });

  it('creates a valid UPI intent for DirectBankAcquirerAdapter', async () => {
    const adapter = new DirectBankAcquirerAdapter('direct_upi');
    const order = {
      _id: '507f1f77bcf86cd799439011',
      orderNumber: 'ORD-1042',
      totalPaise: 45000
    } as unknown as import('../models/Order.js').OrderDoc;
    const restaurant = {
      name: 'Spice Garden',
      upiId: 'spice@okicici',
      webhookSecret: 'whsec_123'
    } as unknown as import('../models/Restaurant.js').RestaurantDoc;

    const intent = await adapter.createPaymentIntent(order, restaurant);
    expect(intent.mode).toBe('upi_intent');
    expect(intent.provider).toBe('direct_upi');
    expect(intent.upiId).toBe('spice@okicici');
    expect(intent.upiUri).toContain('upi://pay?');
    expect(intent.upiUri).toContain('am=450.00');
    expect(intent.supportsAutoWebhook).toBe(true);
    expect(intent.supportsManualUtr).toBe(true);
  });

  it('verifies Razorpay HMAC signature and parses order.paid payload', () => {
    const adapter = new RazorpayAdapter();
    const secret = 'rzp_wh_secret_test';
    const payload = JSON.stringify({
      event: 'order.paid',
      payload: {
        order: { entity: { id: 'order_rzp_1', receipt: 'ORD-2001' } },
        payment: {
          entity: {
            id: 'pay_rzp_1',
            amount: 55000,
            method: 'upi',
            acquirer_data: { rrn: '412345678901' }
          }
        }
      }
    });
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    expect(adapter.verifySignature(payload, { 'x-razorpay-signature': signature }, secret)).toBe(true);
    expect(adapter.verifySignature(payload, { 'x-razorpay-signature': 'bad_sig' }, secret)).toBe(false);

    const parsed = adapter.parseWebhookPayload(JSON.parse(payload));
    expect(parsed).toEqual({
      ignored: false,
      orderIdentifier: 'ORD-2001',
      transactionReference: '412345678901',
      paymentId: 'pay_rzp_1',
      paymentMethod: 'UPI',
      paidAmountPaise: 55000
    });
  });

  it('verifies Cashfree timestamp+body HMAC signature and parses PAYMENT_SUCCESS_WEBHOOK', () => {
    const adapter = new CashfreeAdapter();
    const secret = 'cf_secret_test';
    const timestamp = '1700000000';
    const payload = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: 'ORD-3001' },
        payment: {
          cf_payment_id: 987654,
          bank_reference: 'UTR99887766',
          payment_amount: 320.5,
          payment_group: 'upi'
        }
      }
    });
    const signature = createHmac('sha256', secret).update(`${timestamp}${payload}`).digest('base64');

    expect(
      adapter.verifySignature(
        payload,
        { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature },
        secret
      )
    ).toBe(true);

    const parsed = adapter.parseWebhookPayload(JSON.parse(payload));
    expect(parsed).toEqual({
      ignored: false,
      orderIdentifier: 'ORD-3001',
      transactionReference: 'UTR99887766',
      paymentId: '987654',
      paymentMethod: 'UPI',
      paidAmountPaise: 32050
    });
  });
});
