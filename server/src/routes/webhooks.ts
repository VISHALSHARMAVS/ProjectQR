import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { Order, type OrderDoc } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { AppError } from '../utils/errors.js';
import { settleOrderRecord } from './orders.js';

export const webhooksRouter = Router();

function verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
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
  let paidAmountPaise: number | undefined;

  // 1. Razorpay standard webhook structure
  if (body.event) {
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
      if (typeof paymentEntity.amount === 'number') paidAmountPaise = paymentEntity.amount;
      if (paymentEntity.method === 'card') paymentMethod = 'CARD';
      else if (paymentEntity.method === 'upi') paymentMethod = 'UPI';
    } else {
      // Ignored event (e.g. payment.failed, refund)
      return res.status(200).json({ status: 'ignored', event: body.event });
    }
  } else {
    // 2. Universal / Custom Gateway / Soundbox payload
    const isSuccess = body.status === 'SUCCESS' || body.status === 'PAID' || body.success === true || !body.status;
    if (!isSuccess) {
      return res.status(200).json({ status: 'ignored', message: 'Payment status not successful.' });
    }
    orderIdentifier = body.orderNumber || body.orderId || body.receipt;
    transactionReference = body.transactionReference || body.utr || body.rrn || body.referenceId;
    paymentId = body.paymentId || body.id;
    if (typeof body.amountPaise === 'number') paidAmountPaise = body.amountPaise;
    else if (typeof body.amount === 'number') paidAmountPaise = Math.round(body.amount * 100);
    if (body.paymentMethod === 'CARD') paymentMethod = 'CARD';
  }

  if (typeof orderIdentifier !== 'string' || !orderIdentifier.trim()) {
    throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Could not identify order from webhook payload.');
  }
  orderIdentifier = orderIdentifier.trim();

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

  // Validate amount if sent by gateway
  if (paidAmountPaise !== undefined && paidAmountPaise < order.totalPaise) {
    throw new AppError(400, 'UNDERPAID', `Received payment amount (${paidAmountPaise}) is less than order total (${order.totalPaise}).`);
  }

  // Enforce signature check when webhook secret is configured (fail closed)
  const restaurant = await Restaurant.findById(order.restaurantId);
  if (restaurant?.webhookSecret) {
    if (!signature) {
      throw new AppError(401, 'MISSING_SIGNATURE', 'Webhook signature header is required.');
    }
    const rawPayload = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const valid = verifyWebhookSignature(rawPayload, signature, restaurant.webhookSecret);
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
