import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import session from 'express-session';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type TestAgent = ReturnType<typeof supertest.agent>;
type App = import('./app.js').ProjectQrApplication;

let mongo: MongoMemoryServer | undefined;
let app: App | undefined;
let ownerAgent: TestAgent;
let customerAgent: TestAgent;
let uploadDirectory: string | undefined;

describe('Auto-Confirm UPI Payments & Human Psychology Review System', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongo.getUri('projectqr-review-test');
    process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    process.env.SESSION_SECRET = 'review-system-test-session-secret-key-32chars';
    process.env.OTP_SECRET = 'review-system-test-otp-secret-key-32chars-min';
    process.env.OTP_MODE = 'mock';

    const baseTemp = os.tmpdir();
    uploadDirectory = await mkdtemp(path.join(baseTemp, 'projectqr-review-test-'));
    process.env.UPLOAD_DIR = uploadDirectory;

    const [{ connectDatabase }, { createApplication }] = await Promise.all([
      import('./config/database.js'),
      import('./app.js')
    ]);
    await connectDatabase();
    app = createApplication(new session.MemoryStore());
    app.httpServer.listen(0);
    await new Promise<void>((resolve, reject) => {
      app!.httpServer.once('listening', resolve);
      app!.httpServer.once('error', reject);
    });

    ownerAgent = supertest.agent(app.httpServer);
    customerAgent = supertest.agent(app.httpServer);
  }, 120_000);

  afterAll(async () => {
    if (app) await new Promise<void>((resolve) => app!.io.close(() => resolve()));
    await mongoose.disconnect();
    await mongo?.stop();
    if (uploadDirectory) {
      await rm(uploadDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('runs the complete automated UPI confirmation and behavioral review lifecycle', async () => {
    // 1. Owner registers restaurant
    const registerRes = await ownerAgent.post('/api/auth/register').send({
      restaurantName: 'The Royal Feast',
      ownerName: 'Chef Vikram',
      email: 'vikram@royalfeast.test',
      password: 'RoyalPassword123!'
    }).expect(201);
    expect(registerRes.body.user.role).toBe('owner');

    // 2. Configure Google Review URL & Auto-Confirm UPI Settings
    const settingsRes = await ownerAgent.patch('/api/restaurant/settings').send({
      upiId: 'royalfeast@okaxis',
      googleReviewUrl: 'https://g.page/r/royalfeast/review',
      autoConfirmPayments: true,
      enableDishReviews: true,
      webhookSecret: 'test_whsec_secret123'
    }).expect(200);
    expect(settingsRes.body.restaurant.upiId).toBe('royalfeast@okaxis');
    expect(settingsRes.body.restaurant.googleReviewUrl).toBe('https://g.page/r/royalfeast/review');
    expect(settingsRes.body.restaurant.autoConfirmPayments).toBe(true);

    // 3. Create category, dishes, and table
    const catRes = await ownerAgent.post('/api/categories').send({
      name: 'Curries & Breads',
      description: 'Fresh North Indian Specialties'
    }).expect(201);
    const categoryId = catRes.body.category.id || catRes.body.category._id;

    const dish1Res = await ownerAgent.post('/api/menu').send({
      categoryId,
      name: 'Paneer Butter Masala',
      description: 'Rich cottage cheese curry',
      pricePaise: 35000,
      dietary: 'VEG'
    }).expect(201);
    const dish1Id = dish1Res.body.item.id || dish1Res.body.item._id;

    const dish2Res = await ownerAgent.post('/api/menu').send({
      categoryId,
      name: 'Garlic Naan',
      description: 'Clay-oven baked bread',
      pricePaise: 8000,
      dietary: 'VEG'
    }).expect(201);
    const dish2Id = dish2Res.body.item.id || dish2Res.body.item._id;

    const tableRes = await ownerAgent.post('/api/tables').send({
      label: 'Table 7'
    }).expect(201);
    const tableId = tableRes.body.table.id || tableRes.body.table._id;

    const qrRes = await ownerAgent.post(`/api/tables/${tableId}/qr`).expect(200);
    const qrToken = qrRes.body.url.split('/order/')[1];
    expect(qrToken).toBeTruthy();

    // 4. Customer joins session via quick-join
    const joinRes = await customerAgent.post('/api/customer/quick-join').send({
      token: qrToken,
      name: 'Aditya'
    }).expect(200);
    expect(joinRes.body.customer.name).toBe('Aditya');
    expect(joinRes.body.restaurant.googleReviewUrl).toBe('https://g.page/r/royalfeast/review');
    expect(joinRes.body.restaurant.autoConfirmPayments).toBe(true);

    // 5. Customer places order #1
    const orderRes = await customerAgent.post('/api/customer/orders').send({
      token: qrToken,
      idempotencyKey: 'test-order-auto-confirm-1',
      items: [
        { menuItemId: dish1Id, quantity: 1 },
        { menuItemId: dish2Id, quantity: 2 }
      ]
    }).expect(201);
    const orderId = orderRes.body.order.id;
    expect(orderRes.body.order.paymentStatus).toBe('UNPAID');

    // 6. Test AUTO-CONFIRM UPI endpoint
    const autoConfirmRes = await customerAgent.post(`/api/customer/orders/${orderId}/auto-confirm?token=${qrToken}`)
      .send({ transactionReference: 'UPI-UTR-987654321012' })
      .expect(200);
    expect(autoConfirmRes.body.success).toBe(true);
    expect(autoConfirmRes.body.order.paymentStatus).toBe('PAID');
    expect(autoConfirmRes.body.order.paymentMethod).toBe('UPI');
    expect(autoConfirmRes.body.order.autoConfirmed).toBe(true);
    expect(autoConfirmRes.body.order.transactionReference).toBe('UPI-UTR-987654321012');

    // 7. Customer submits a 5-Star Delighted Review (Positive Sentiment)
    const review5StarRes = await customerAgent.post(`/api/customer/reviews?token=${qrToken}`)
      .send({
        orderId,
        rating: 5,
        dishRatings: [
          { menuItemId: dish1Id, dishName: 'Paneer Butter Masala', liked: true },
          { menuItemId: dish2Id, dishName: 'Garlic Naan', liked: true }
        ],
        comment: 'Best Paneer Butter Masala in town!'
      })
      .expect(201);
    expect(review5StarRes.body.success).toBe(true);
    expect(review5StarRes.body.review.rating).toBe(5);
    expect(review5StarRes.body.review.sentiment).toBe('POSITIVE');
    const review1Id = review5StarRes.body.review.id;

    // 8. Customer taps the 1-click Google Maps Review Booster
    const googleClickRes = await customerAgent.patch(`/api/customer/reviews/${review1Id}/google-click?token=${qrToken}`)
      .expect(200);
    expect(googleClickRes.body.success).toBe(true);
    expect(googleClickRes.body.googleReviewClicked).toBe(true);

    // 9. Customer places Order #2 (to test Webhook payment and unhappy review recovery)
    const order2Res = await customerAgent.post('/api/customer/orders').send({
      token: qrToken,
      idempotencyKey: 'test-order-auto-confirm-2',
      items: [
        { menuItemId: dish1Id, quantity: 1 }
      ]
    }).expect(201);
    const order2Id = order2Res.body.order.id;

    // Test Webhook Payment Settlement (Razorpay style signed webhook)
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_mock12345',
            order_id: order2Id,
            amount: order2Res.body.order.totalPaise,
            method: 'upi',
            vpa: 'aditya@okhdfcbank'
          }
        }
      }
    });
    const webhookSignature = createHmac('sha256', 'test_whsec_secret123').update(webhookPayload).digest('hex');
    const webhookRes = await supertest(app!.httpServer)
      .post('/api/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', webhookSignature)
      .send(webhookPayload)
      .expect(200);
    expect(webhookRes.body.success).toBe(true);
    expect(webhookRes.body.orderId).toBe(order2Id);

    // 10. Customer submits a 2-Star Unhappy Review with Diagnostic Root Causes (Table-side recovery)
    const review2StarRes = await customerAgent.post(`/api/customer/reviews?token=${qrToken}`)
      .send({
        orderId: order2Id,
        rating: 2,
        tags: ['FOOD_QUALITY', 'SLOW_SERVICE'],
        dishRatings: [
          { menuItemId: dish1Id, dishName: 'Paneer Butter Masala', liked: false }
        ],
        comment: 'Cottage cheese was hard and service was slow.'
      })
      .expect(201);
    expect(review2StarRes.body.review.rating).toBe(2);
    expect(review2StarRes.body.review.sentiment).toBe('NEGATIVE');
    expect(review2StarRes.body.review.tags).toContain('FOOD_QUALITY');
    expect(review2StarRes.body.review.tags).toContain('SLOW_SERVICE');
    const review2Id = review2StarRes.body.review.id;

    // 11. Manager views restaurant reviews dashboard
    const dashboardReviewsRes = await ownerAgent.get('/api/restaurant/reviews').expect(200);
    expect(dashboardReviewsRes.body.summary.totalReviews).toBe(2);
    expect(dashboardReviewsRes.body.summary.averageRating).toBe(3.5); // (5 + 2) / 2 = 3.5
    expect(dashboardReviewsRes.body.summary.googleClicks).toBe(1);
    expect(dashboardReviewsRes.body.summary.unresolvedComplaints).toBe(1);

    // Verify Dish Leaderboard diagnostics
    const leaderboard = dashboardReviewsRes.body.dishLeaderboard;
    expect(leaderboard.length).toBeGreaterThan(0);
    const garlicNaanStat = leaderboard.find((d: { dishName: string }) => d.dishName === 'Garlic Naan');
    expect(garlicNaanStat?.satisfactionRate).toBe(100);

    // 12. Manager executes table-side recovery on review2
    const resolveRes = await ownerAgent.patch(`/api/restaurant/reviews/${review2Id}/resolve`)
      .send({
        resolutionNote: 'Visited Table 7 in person, replaced dish with fresh batch, offered complimentary dessert. Guest left happy.'
      })
      .expect(200);
    expect(resolveRes.body.success).toBe(true);
    expect(resolveRes.body.review.resolved).toBe(true);
    expect(resolveRes.body.review.resolutionNote).toContain('complimentary dessert');

    // 13. Verify complaint count is now 0 after resolution
    const finalReviewsRes = await ownerAgent.get('/api/restaurant/reviews').expect(200);
    expect(finalReviewsRes.body.summary.unresolvedComplaints).toBe(0);
  }, 120_000);
});
