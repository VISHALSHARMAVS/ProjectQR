import { Router } from 'express';
import { Order, type OrderDoc } from '../models/Order.js';
import { Restaurant, type RestaurantDoc } from '../models/Restaurant.js';
import {
  CashfreeAdapter,
  DirectBankAcquirerAdapter,
  RazorpayAdapter,
  resolvePaymentAdapter,
  type PaymentProviderAdapter
} from '../services/paymentAdapters.js';
import { AppError } from '../utils/errors.js';
import { settleOrderRecord } from './orders.js';

export const webhooksRouter = Router();

function detectWebhookAdapter(
  body: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>
): PaymentProviderAdapter {
  if (headers['x-razorpay-signature'] || typeof body.event === 'string') {
    return new RazorpayAdapter();
  }
  if (headers['x-webhook-timestamp'] || (typeof body.type === 'string' && body.data && typeof body.data === 'object')) {
    return new CashfreeAdapter();
  }
  return new DirectBankAcquirerAdapter('custom');
}

// Universal Payment Webhook (supports Razorpay, Cashfree, or Direct Bank/UPI acquirer events)
webhooksRouter.post('/payment', async (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const initialAdapter = detectWebhookAdapter(body, headers);
  const parsed = initialAdapter.parseWebhookPayload(body);

  if (parsed.ignored) {
    return res.status(200).json({ status: 'ignored', reason: parsed.ignoreReason || 'ignored_event' });
  }

  const orderIdentifier = parsed.orderIdentifier?.trim();
  if (!orderIdentifier) {
    throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Could not identify order from webhook payload.');
  }

  // Find order by orderNumber, gatewayOrderId, or ID
  const order = await Order.findOne({
    $or: [
      { orderNumber: orderIdentifier },
      { gatewayOrderId: orderIdentifier },
      ...(orderIdentifier.match(/^[a-f\d]{24}$/i) ? [{ _id: orderIdentifier }] : [])
    ]
  }) as unknown as OrderDoc | null;

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', `Order ${orderIdentifier} not found for webhook settlement.`);
  }

  if (order.paymentStatus === 'PAID') {
    return res.json({ status: 'already_settled', orderNumber: order.orderNumber });
  }

  if (parsed.paidAmountPaise !== undefined && parsed.paidAmountPaise < order.totalPaise) {
    throw new AppError(400, 'UNDERPAID', `Received payment amount (${parsed.paidAmountPaise}) is less than order total (${order.totalPaise}).`);
  }

  // Enforce signature check when webhook secret is configured (fail closed)
  const restaurant = await Restaurant.findById(order.restaurantId) as unknown as RestaurantDoc | null;
  if (restaurant?.webhookSecret) {
    const adapter = resolvePaymentAdapter(restaurant);
    const rawPayload = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const valid = adapter.verifySignature(rawPayload, headers, restaurant.webhookSecret);
    if (!valid) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed.');
    }
  }

  const { paymentMethod, transactionReference, paymentId } = parsed;

  const result = await settleOrderRecord({
    orderId: order._id,
    restaurantId: order.restaurantId,
    paymentMethod,
    autoConfirmed: true,
    transactionReference: transactionReference || paymentId,
    gatewayPaymentId: paymentId
  });

  res.json({
    success: true,
    status: 'ok',
    settled: true,
    orderId: String(order._id),
    orderNumber: result.order.orderNumber,
    finalPaidPaise: result.order.finalPaidPaise
  });
});
