import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import session from 'express-session';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ioClient } from 'socket.io-client';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from './middleware/errorHandler.js';

type TestAgent = ReturnType<typeof supertest.agent>;
type App = import('./app.js').ProjectQrApplication;

let mongo: MongoMemoryServer | undefined;
let app: App | undefined;
let port = 0;
let uploadDirectory: string | undefined;

describe('Mesa Production Reliability & QA Remediation Regression Suite', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongo.getUri('projectqr-reliability-test');
    process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    process.env.SESSION_SECRET = 'reliability-test-session-secret-key-32c';
    process.env.OTP_SECRET = 'reliability-test-otp-secret-key-32c-min';
    process.env.OTP_MODE = 'mock';

    uploadDirectory = await mkdtemp(path.join(os.tmpdir(), 'projectqr-rel-test-'));
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
    const addr = app.httpServer.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  }, 120_000);

  afterAll(async () => {
    if (app) await new Promise<void>((resolve) => app!.io.close(() => resolve()));
    await mongoose.disconnect();
    await mongo?.stop();
    if (uploadDirectory) {
      await rm(uploadDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('delegates to next(error) in errorHandler when res.headersSent is true and hides stack traces on 500', () => {
    let delegatedError: unknown = null;
    const mockResHeadersSent = {
      headersSent: true,
      status: () => { throw new Error('Should not call res.status after headersSent'); }
    } as unknown as import('express').Response;
    const err = new Error('Stream aborted');
    errorHandler(err, { method: 'GET', path: '/test' } as import('express').Request, mockResHeadersSent, (e?: unknown) => {
      delegatedError = e;
    });
    expect(delegatedError).toBe(err);

    let capturedStatus = 0;
    let capturedBody: unknown = null;
    const mockResFresh = {
      headersSent: false,
      status: (code: number) => {
        capturedStatus = code;
        return {
          json: (body: unknown) => {
            capturedBody = body;
          }
        };
      }
    } as unknown as import('express').Response;
    errorHandler(new Error('Sensitive DB detail'), { method: 'GET', path: '/test' } as import('express').Request, mockResFresh, () => undefined);
    expect(capturedStatus).toBe(500);
    expect(capturedBody).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  });

  it('enforces Table Capacity (MESA-QA-001) atomically under concurrency and releases seats on logout/vacate', async () => {
    const owner: TestAgent = supertest.agent(app!.httpServer);
    await owner.post('/api/auth/register').send({
      restaurantName: 'Capacity Test Bistro',
      ownerName: 'Owner Cap',
      email: 'cap-owner@test.com',
      password: 'Password12345!'
    }).expect(201);

    // Create table with capacity 3
    const createTable = await owner.post('/api/tables').send({ label: 'Table 1', capacity: 3 }).expect(201);
    expect(createTable.body.table.capacity).toBe(3);
    const tableId = createTable.body.table.id as string;

    const qrRes = await owner.post(`/api/tables/${tableId}/qr`).expect(200);
    const qrToken = new URL(qrRes.body.url as string).pathname.split('/').pop()!;

    // First guest joins as host
    const g1: TestAgent = supertest.agent(app!.httpServer);
    const j1 = await g1.post('/api/customer/quick-join').send({ token: qrToken, name: 'Guest One' }).expect(200);
    const pin = j1.body.table.pin as string;
    expect(pin).toMatch(/^\d{4}$/);

    // 5 concurrent guests try to join a capacity-3 table (2 seats remaining)
    const contenders = Array.from({ length: 5 }, (_, idx) => {
      const agent = supertest.agent(app!.httpServer);
      return agent.post('/api/customer/quick-join').send({
        token: qrToken,
        name: `Concurrent Guest ${idx + 2}`,
        pin
      }).then((res) => ({ status: res.status, code: res.body?.error?.code, agent }));
    });
    const results = await Promise.all(contenders);
    const successes = results.filter((r) => r.status === 200);
    const fullRejects = results.filter((r) => r.status === 409 && r.code === 'TABLE_FULL');

    expect(successes.length).toBe(2);
    expect(fullRejects.length).toBe(3);

    // Public table info reflects 3/3 occupancy
    const infoFull = await supertest(app!.httpServer).get(`/api/public/tables/${qrToken}`).expect(200);
    expect(infoFull.body.table.capacity).toBe(3);
    expect(infoFull.body.table.activeGuestsCount).toBe(3);

    // One guest logs out -> 1 seat becomes available
    await g1.post('/api/customer/logout').expect(204);
    const gNew: TestAgent = supertest.agent(app!.httpServer);
    await gNew.post('/api/customer/quick-join').send({ token: qrToken, name: 'Replacement Guest', pin }).expect(200);

    // Vacating table releases all seats & resets PIN
    await owner.post(`/api/tables/${tableId}/vacate`).expect(200);
    const infoVacant = await supertest(app!.httpServer).get(`/api/public/tables/${qrToken}`).expect(200);
    expect(infoVacant.body.table.activeGuestsCount).toBe(0);
    expect(infoVacant.body.table.hasActiveParty).toBe(false);
  });

  it('handles 12 concurrent separate-tab cart/items additions without 409 (MESA-QA-003)', async () => {
    const owner: TestAgent = supertest.agent(app!.httpServer);
    await owner.post('/api/auth/register').send({
      restaurantName: 'Cart Concurrency Cafe',
      ownerName: 'Owner Cart',
      email: 'cart-owner@test.com',
      password: 'Password12345!'
    }).expect(201);

    const catRes = await owner.post('/api/categories').send({ name: 'Mains', displayOrder: 1 }).expect(201);
    const itemRes = await owner.post('/api/menu').send({
      categoryId: catRes.body.category._id,
      name: 'Masala Dosa',
      description: 'Crispy dosa',
      pricePaise: 18000,
      dietary: 'VEG',
      available: true
    }).expect(201);
    const menuItemId = itemRes.body.item._id as string;

    const tblRes = await owner.post('/api/tables').send({ label: 'Table 1' }).expect(201);
    const qrRes = await owner.post(`/api/tables/${tblRes.body.table.id}/qr`).expect(200);
    const qrToken = new URL(qrRes.body.url as string).pathname.split('/').pop()!;

    // Host establishes active party
    const host: TestAgent = supertest.agent(app!.httpServer);
    await host.post('/api/customer/quick-join').send({ token: qrToken, name: 'Host Diner' }).expect(200);

    // 12 guests join with separateTab: true and concurrently add items to their own carts
    const separateGuests = await Promise.all(
      Array.from({ length: 12 }, async (_, idx) => {
        const agent = supertest.agent(app!.httpServer);
        const join = await agent.post('/api/customer/quick-join').send({
          token: qrToken,
          name: `Solo Diner ${idx + 1}`,
          separateTab: true
        }).expect(200);
        expect(join.body.tab.isSeparateTab).toBe(true);
        return { agent, idx };
      })
    );

    const cartResults = await Promise.all(
      separateGuests.map(({ agent, idx }) =>
        agent.post('/api/customer/cart/items').send({
          token: qrToken,
          menuItemId,
          quantity: idx + 1
        })
      )
    );

    for (let i = 0; i < cartResults.length; i++) {
      expect(cartResults[i]!.status).toBe(200);
      expect(cartResults[i]!.body.items).toHaveLength(1);
      expect(cartResults[i]!.body.items[0].quantity).toBe(i + 1);
    }

    // Verify isolation: host cart is still empty
    const hostCart = await host.get(`/api/customer/cart?token=${qrToken}`).expect(200);
    expect(hostCart.body.items).toEqual([]);
  });

  it('enforces Cashier Day Close permissions (MESA-QA-002), Floor Map natural sort (MESA-QA-005), unbiased reviews, and XSS sanitization', async () => {
    const owner: TestAgent = supertest.agent(app!.httpServer);
    await owner.post('/api/auth/register').send({
      restaurantName: 'RBAC & Sort Kitchen',
      ownerName: 'Owner RBAC',
      email: 'rbac-owner@test.com',
      password: 'Password12345!'
    }).expect(201);

    await owner.patch('/api/restaurant/settings').send({
      googleReviewUrl: 'https://maps.google.com/?cid=12345'
    }).expect(200);

    // Create Table 1, Table 2, Table 10 out of order to verify natural sorting
    await owner.post('/api/tables').send({ label: 'Table 10' }).expect(201);
    await owner.post('/api/tables').send({ label: 'Table 2' }).expect(201);
    const t1 = await owner.post('/api/tables').send({ label: 'Table 1' }).expect(201);

    const floorRes = await owner.get('/api/tables/live-status').expect(200);
    expect(floorRes.body.tables.map((t: { label: string }) => t.label)).toEqual(['Table 1', 'Table 2', 'Table 10']);

    // Create Cashier (canCloseRegister: true, canViewFinancials: false) and Waiter
    await owner.post('/api/restaurant/staff').send({
      name: 'Cashier Priya',
      email: 'cashier-priya@test.com',
      password: 'Password123!',
      role: 'cashier',
      permissions: {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: true,
        canPunchOrders: true,
        canManageReviews: false,
        canCloseRegister: true
      }
    }).expect(201);

    await owner.post('/api/restaurant/staff').send({
      name: 'Waiter Vikram',
      email: 'waiter-vikram@test.com',
      password: 'Password123!',
      role: 'waiter'
    }).expect(201);

    const cashier: TestAgent = supertest.agent(app!.httpServer);
    await cashier.post('/api/auth/login').send({ email: 'cashier-priya@test.com', password: 'Password123!' }).expect(200);
    await cashier.get('/api/restaurant/day-close').expect(200);
    const cashierDash = await cashier.get('/api/restaurant/dashboard').expect(200);
    expect(cashierDash.body.metrics.financialsHidden).toBe(true);
    await cashier.get('/api/restaurant/staff').expect(403);

    const waiter: TestAgent = supertest.agent(app!.httpServer);
    await waiter.post('/api/auth/login').send({ email: 'waiter-vikram@test.com', password: 'Password123!' }).expect(200);
    await waiter.get('/api/restaurant/day-close').expect(403);
    await waiter.get('/api/restaurant/reviews').expect(403);
    await waiter.post('/api/tables').send({ label: 'Table 99' }).expect(403);

    // Customer XSS sanitization & unbiased review experience
    const qrRes = await owner.post(`/api/tables/${t1.body.table.id}/qr`).expect(200);
    const qrToken = new URL(qrRes.body.url as string).pathname.split('/').pop()!;
    const diner: TestAgent = supertest.agent(app!.httpServer);
    const join = await diner.post('/api/customer/quick-join').send({
      token: qrToken,
      name: '<script>alert(1)</script>Rohan'
    }).expect(200);
    expect(join.body.customer.name).toBe('alert(1)Rohan');

    // 1-star review still receives googleReviewUrl (unbiased, no review gating) and sanitizes comment
    const rev = await diner.post('/api/customer/reviews').send({
      token: qrToken,
      rating: 1,
      comment: '<img src=x onerror=alert(1)>Cold food'
    }).expect(201);
    expect(rev.body.googleReviewUrl).toBe('https://maps.google.com/?cid=12345');
    expect(rev.body.review.comment).toBe('Cold food');
  });

  it('rejects unauthenticated Socket.IO connections and accepts authenticated sessions', async () => {
    const unauthSocket = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      autoConnect: true
    });
    const unauthError = await new Promise<string>((resolve) => {
      unauthSocket.once('connect_error', (err) => resolve(err.message));
    });
    unauthSocket.close();
    expect(unauthError).toMatch(/Authentication required/i);
  });
});
