import { createHmac, timingSafeEqual } from 'node:crypto';
import type { OrderDoc } from '../models/Order.js';
import type { RestaurantDoc } from '../models/Restaurant.js';
import { AppError } from '../utils/errors.js';

export type PaymentGatewayName = 'direct_upi' | 'razorpay' | 'cashfree' | 'custom';

export interface PaymentIntentResult {
  mode: 'razorpay_checkout' | 'cashfree_checkout' | 'upi_intent';
  provider: PaymentGatewayName;
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  currency: 'INR';
  restaurantName: string;
  gatewayOrderId?: string;
  gatewayKeyId?: string;
  paymentSessionId?: string;
  upiUri?: string;
  upiId?: string;
  supportsAutoWebhook: boolean;
  supportsManualUtr: boolean;
}

export interface ParsedWebhookEvent {
  ignored: boolean;
  ignoreReason?: string;
  orderIdentifier?: string;
  transactionReference?: string;
  paymentId?: string;
  paymentMethod: 'UPI' | 'CARD' | 'OTHER';
  paidAmountPaise?: number;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentGatewayName;
  createPaymentIntent(order: OrderDoc, restaurant: RestaurantDoc): Promise<PaymentIntentResult>;
  verifySignature(rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>, secret: string): boolean;
  parseWebhookPayload(body: Record<string, unknown>): ParsedWebhookEvent;
}

function constantTimeEqual(expected: string, actual: string): boolean {
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(actual, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getHeader(headers: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const val = headers[key.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  return val;
}

function buildUpiUri(upiId: string, restaurantName: string, amountPaise: number, orderNumber: string): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: restaurantName,
    am: (amountPaise / 100).toFixed(2),
    tn: `Order ${orderNumber}`,
    cu: 'INR'
  });
  return `upi://pay?${params.toString()}`;
}

export class RazorpayAdapter implements PaymentProviderAdapter {
  readonly name = 'razorpay' as const;

  async createPaymentIntent(order: OrderDoc, restaurant: RestaurantDoc): Promise<PaymentIntentResult> {
    const keyId = restaurant.gatewayKeyId?.trim();
    const keySecret = restaurant.gatewayKeySecret?.trim();
    if (!keyId || !keySecret) {
      throw new AppError(400, 'GATEWAY_NOT_CONFIGURED', 'Razorpay API keys are not configured for this restaurant.');
    }

    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify({
        amount: order.totalPaise,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: {
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          restaurantId: String(order.restaurantId)
        }
      })
    });

    const data = (await response.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
    if (!response.ok || !data.id) {
      throw new AppError(502, 'GATEWAY_ERROR', data.error?.description || 'Could not initialize Razorpay checkout order.');
    }

    return {
      mode: 'razorpay_checkout',
      provider: 'razorpay',
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amountPaise: order.totalPaise,
      currency: 'INR',
      restaurantName: restaurant.name,
      gatewayOrderId: data.id,
      gatewayKeyId: keyId,
      supportsAutoWebhook: true,
      supportsManualUtr: false
    };
  }

  verifySignature(rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>, secret: string): boolean {
    const signature = getHeader(headers, 'x-razorpay-signature') || getHeader(headers, 'x-webhook-signature');
    if (!signature) return false;
    const expected = createHmac('sha256', secret).update(rawPayload).digest('hex');
    return constantTimeEqual(expected, signature);
  }

  parseWebhookPayload(body: Record<string, unknown>): ParsedWebhookEvent {
    const event = typeof body.event === 'string' ? body.event : '';
    if (event && event !== 'order.paid' && event !== 'payment.captured') {
      return { ignored: true, ignoreReason: event, paymentMethod: 'UPI' };
    }
    const payload = (body.payload as Record<string, unknown> | undefined) ?? {};
    const paymentEntity = ((payload.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined) ?? {};
    const orderEntity = ((payload.order as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined) ?? {};
    const orderNotes = (orderEntity.notes as Record<string, unknown> | undefined) ?? {};
    const paymentNotes = (paymentEntity.notes as Record<string, unknown> | undefined) ?? {};
    const acquirer = (paymentEntity.acquirer_data as Record<string, unknown> | undefined) ?? {};

    const orderIdentifier =
      (orderEntity.receipt as string | undefined) ||
      (orderNotes.orderNumber as string | undefined) ||
      (orderNotes.orderId as string | undefined) ||
      (paymentNotes.orderNumber as string | undefined) ||
      (paymentNotes.orderId as string | undefined) ||
      (paymentEntity.order_id as string | undefined) ||
      (body.orderId as string | undefined) ||
      (body.orderNumber as string | undefined);

    const transactionReference =
      (acquirer.rrn as string | undefined) ||
      (acquirer.upi_transaction_id as string | undefined) ||
      (paymentEntity.id as string | undefined);

    const paymentId = paymentEntity.id as string | undefined;
    const paidAmountPaise = typeof paymentEntity.amount === 'number' ? paymentEntity.amount : undefined;
    const method = paymentEntity.method === 'card' ? 'CARD' : 'UPI';

    return {
      ignored: false,
      orderIdentifier,
      transactionReference,
      paymentId,
      paymentMethod: method,
      paidAmountPaise
    };
  }
}

export class CashfreeAdapter implements PaymentProviderAdapter {
  readonly name = 'cashfree' as const;

  async createPaymentIntent(order: OrderDoc, restaurant: RestaurantDoc): Promise<PaymentIntentResult> {
    const clientId = restaurant.gatewayKeyId?.trim();
    const clientSecret = restaurant.gatewayKeySecret?.trim();
    if (!clientId || !clientSecret) {
      throw new AppError(400, 'GATEWAY_NOT_CONFIGURED', 'Cashfree API credentials are not configured for this restaurant.');
    }

    const isSandbox = clientId.toUpperCase().startsWith('TEST');
    const endpoint = isSandbox ? 'https://sandbox.cashfree.com/pg/orders' : 'https://api.cashfree.com/pg/orders';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': '2023-08-01'
      },
      body: JSON.stringify({
        order_id: order.orderNumber,
        order_amount: Number((order.totalPaise / 100).toFixed(2)),
        order_currency: 'INR',
        customer_details: {
          customer_id: String(order.customerId || order._id),
          customer_phone: '9999999999'
        },
        order_meta: {
          order_id: String(order._id)
        }
      })
    });

    const data = (await response.json().catch(() => ({}))) as {
      cf_order_id?: string | number;
      payment_session_id?: string;
      message?: string;
    };
    if (!response.ok || !data.payment_session_id) {
      throw new AppError(502, 'GATEWAY_ERROR', data.message || 'Could not initialize Cashfree checkout session.');
    }

    return {
      mode: 'cashfree_checkout',
      provider: 'cashfree',
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amountPaise: order.totalPaise,
      currency: 'INR',
      restaurantName: restaurant.name,
      gatewayOrderId: data.cf_order_id ? String(data.cf_order_id) : order.orderNumber,
      paymentSessionId: data.payment_session_id,
      supportsAutoWebhook: true,
      supportsManualUtr: false
    };
  }

  verifySignature(rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>, secret: string): boolean {
    const signature = getHeader(headers, 'x-webhook-signature');
    if (!signature) return false;
    const timestamp = getHeader(headers, 'x-webhook-timestamp');
    if (timestamp) {
      const signed = `${timestamp}${typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf8')}`;
      const expectedBase64 = createHmac('sha256', secret).update(signed).digest('base64');
      if (constantTimeEqual(expectedBase64, signature)) return true;
    }
    const expectedHex = createHmac('sha256', secret).update(rawPayload).digest('hex');
    return constantTimeEqual(expectedHex, signature);
  }

  parseWebhookPayload(body: Record<string, unknown>): ParsedWebhookEvent {
    const type = typeof body.type === 'string' ? body.type : '';
    if (type && type !== 'PAYMENT_SUCCESS_WEBHOOK') {
      return { ignored: true, ignoreReason: type, paymentMethod: 'UPI' };
    }
    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    const orderData = (data.order as Record<string, unknown> | undefined) ?? {};
    const paymentData = (data.payment as Record<string, unknown> | undefined) ?? {};

    const orderIdentifier =
      (orderData.order_id as string | undefined) ||
      (body.orderNumber as string | undefined) ||
      (body.orderId as string | undefined);

    const paymentId = paymentData.cf_payment_id ? String(paymentData.cf_payment_id) : undefined;
    const transactionReference = (paymentData.bank_reference as string | undefined) || paymentId;
    const paidAmountPaise =
      typeof paymentData.payment_amount === 'number'
        ? Math.round(paymentData.payment_amount * 100)
        : undefined;
    const paymentMethod = paymentData.payment_group === 'credit_card' || paymentData.payment_group === 'debit_card' ? 'CARD' : 'UPI';

    return {
      ignored: false,
      orderIdentifier,
      transactionReference,
      paymentId,
      paymentMethod,
      paidAmountPaise
    };
  }
}

export class DirectBankAcquirerAdapter implements PaymentProviderAdapter {
  readonly name: 'custom' | 'direct_upi';

  constructor(name: 'custom' | 'direct_upi' = 'custom') {
    this.name = name;
  }

  async createPaymentIntent(order: OrderDoc, restaurant: RestaurantDoc): Promise<PaymentIntentResult> {
    const upiId = restaurant.upiId?.trim() || '';
    if (!upiId) {
      throw new AppError(400, 'UPI_NOT_CONFIGURED', 'Restaurant UPI ID is not configured.');
    }
    return {
      mode: 'upi_intent',
      provider: this.name,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amountPaise: order.totalPaise,
      currency: 'INR',
      restaurantName: restaurant.name,
      upiId,
      upiUri: buildUpiUri(upiId, restaurant.name, order.totalPaise, order.orderNumber),
      supportsAutoWebhook: Boolean(restaurant.webhookSecret),
      supportsManualUtr: true
    };
  }

  verifySignature(rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>, secret: string): boolean {
    const signature =
      getHeader(headers, 'x-razorpay-signature') ||
      getHeader(headers, 'x-webhook-signature') ||
      getHeader(headers, 'x-mesa-signature');
    if (!signature) return false;
    const expected = createHmac('sha256', secret).update(rawPayload).digest('hex');
    return constantTimeEqual(expected, signature);
  }

  parseWebhookPayload(body: Record<string, unknown>): ParsedWebhookEvent {
    const status = typeof body.status === 'string' ? body.status.toUpperCase() : '';
    const isSuccess = status === 'SUCCESS' || status === 'PAID' || body.success === true || !body.status;
    if (!isSuccess) {
      return { ignored: true, ignoreReason: status || 'not_success', paymentMethod: 'UPI' };
    }
    const orderIdentifier =
      (body.orderNumber as string | undefined) ||
      (body.orderId as string | undefined) ||
      (body.receipt as string | undefined);
    const transactionReference =
      (body.transactionReference as string | undefined) ||
      (body.utr as string | undefined) ||
      (body.rrn as string | undefined) ||
      (body.referenceId as string | undefined);
    const paymentId = (body.paymentId as string | undefined) || (body.id as string | undefined);
    let paidAmountPaise: number | undefined;
    if (typeof body.amountPaise === 'number') paidAmountPaise = body.amountPaise;
    else if (typeof body.amount === 'number') paidAmountPaise = Math.round(body.amount * 100);
    const paymentMethod = body.paymentMethod === 'CARD' ? 'CARD' : 'UPI';

    return {
      ignored: false,
      orderIdentifier,
      transactionReference,
      paymentId,
      paymentMethod,
      paidAmountPaise
    };
  }
}

export function resolvePaymentAdapter(restaurant: Pick<RestaurantDoc, 'paymentGateway' | 'gatewayKeyId' | 'gatewayKeySecret'>): PaymentProviderAdapter {
  const gateway = restaurant.paymentGateway || 'direct_upi';
  if (gateway === 'razorpay') return new RazorpayAdapter();
  if (gateway === 'cashfree') return new CashfreeAdapter();
  if (gateway === 'custom') return new DirectBankAcquirerAdapter('custom');
  return new DirectBankAcquirerAdapter('direct_upi');
}
