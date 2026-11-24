import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { Order, type OrderDoc } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { AppError } from '../utils/errors.js';
import { settleOrderRecord } from './orders.js';

export const webhooksRouter = Router();

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Universal Payment Webhook (supports Razorpay, Cashfree, or UPI soundbox events)
webhooksRouter.post('/payment', async (req, res) => {
  const body = req.body || {};
  const signature = (req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature']) as string | undefined;

  let orderIdentifier: string | undefined;
  let transactionReference: string | undefined;
  let paymentId: string | undefined;
  let paymentMethod: 'UPI' | 'CARD' | 'OTHER' = 'UPI';

  // 1. Razorpay standard webhook structure
  if (body.event === 'order.paid' || body.event === 'payment.captured') {
    const paymentEntity = body.payload?.payment?.entity || {};
    const orderEntity = body.payload?.order?.entity || {};
    orderIdentifier =
      orderEntity.receipt ||
      orderEntity.notes?.orderNumber ||
      orderEntity.notes?.orderId ||
      paymentEntity.notes?.orderNumber ||
      paymentEntity.notes?.orderId ||
      paymentEntity.order_id ||
      body.orderId ||
      body.orderNumber;
    transactionReference = paymentEntity.acquirer_data?.rrn || paymentEntity.acquirer_data?.upi_transaction_id || paymentEntity.id;
    paymentId = paymentEntity.id;
    if (paymentEntity.method === 'card') paymentMethod = 'CARD';
    else if (paymentEntity.method === 'upi') paymentMethod = 'UPI';
  } else {
    // 2. Universal / Custom Gateway / Soundbox payload
    orderIdentifier = body.orderNumber || body.orderId || body.receipt;
    transactionReference = body.transactionReference || body.utr || body.rrn || body.referenceId;
    paymentId = body.paymentId || body.id;
    if (body.paymentMethod === 'CARD') paymentMethod = 'CARD';
  }

  if (!orderIdentifier) {
    throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Could not identify order from webhook payload.');
  }

  // Find order by orderNumber or ID
  const order = await Order.findOne({
    $or: [
      { orderNumber: orderIdentifier },
      ...(orderIdentifier.match(/^[a-f\d]{24}$/i) ? [{ _id: orderIdentifier }] : [])
    ]
  }) as unknown as OrderDoc | null;

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', `Order ${orderIdentifier} not found for webhook settlement.`);
  }

  if (order.paymentStatus === 'PAID') {
    return res.json({ status: 'already_settled', orderNumber: order.orderNumber });
  }

  // Check restaurant webhook secret if configured
  const restaurant = await Restaurant.findById(order.restaurantId);
  if (restaurant?.webhookSecret && signature) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const valid = verifyWebhookSignature(rawBody, signature, restaurant.webhookSecret);
    if (!valid) throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed.');
  }

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
