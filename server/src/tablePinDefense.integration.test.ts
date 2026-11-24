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
let aliceHostAgent: TestAgent;
let bobFriendAgent: TestAgent;
let charlieSoloAgent: TestAgent;
let uploadDirectory: string | undefined;

describe('4-digit Table PIN & Separate Bill Defense', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongo.getUri('projectqr-pin-test');
    process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    process.env.SESSION_SECRET = 'pin-defense-test-session-secret-key-32chars';
    process.env.OTP_SECRET = 'pin-defense-test-otp-secret-key-32chars-min';
    process.env.OTP_MODE = 'mock';

    const baseTemp = os.tmpdir();
    uploadDirectory = await mkdtemp(path.join(baseTemp, 'projectqr-pin-test-'));
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
    aliceHostAgent = supertest.agent(app.httpServer);
    bobFriendAgent = supertest.agent(app.httpServer);
    charlieSoloAgent = supertest.agent(app.httpServer);
  }, 120_000);

  afterAll(async () => {
    if (app) await new Promise<void>((resolve) => app!.io.close(() => resolve()));
    await mongoose.disconnect();
    await mongo?.stop();
    if (uploadDirectory) {
      await rm(uploadDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('generates PIN for host, blocks friends without PIN, admits friends with PIN, isolates solo stranger on separate bill, and resets on vacate', async () => {
    // 1. Owner registers restaurant & sets up a table & menu item
    await ownerAgent.post('/api/auth/register').send({
      restaurantName: 'The Spicy Bistro',
      ownerName: 'Owner Chef',
      email: 'chef@spicybistro.test',
      password: 'BistroPassword123!'
    }).expect(201);

    const categoryRes = await ownerAgent.post('/api/categories').send({
      name: 'Mains',
      description: 'Hearty meals'
    }).expect(201);
    const categoryId = categoryRes.body.category._id;

    const dishRes = await ownerAgent.post('/api/menu').send({
      categoryId,
      name: 'Butter Paneer',
      pricePaise: 35000,
      description: 'Rich gravy cottage cheese',
      available: true
    }).expect(201);
    const dishId = dishRes.body.item._id;

    const tableRes = await ownerAgent.post('/api/tables').send({ label: 'Table 4' }).expect(201);
    const tableId = tableRes.body.table.id;

    const qrRes = (await ownerAgent.post(`/api/tables/${tableId}/qr`).expect(200)).body as { url: string };
    const tableToken = new URL(qrRes.url).pathname.split('/').pop()!;

    // 2. Fresh empty table: hasActiveParty should be false
    const initialLanding = await aliceHostAgent.get(`/api/public/tables/${tableToken}`).expect(200);
    expect(initialLanding.body.table.hasActiveParty).toBe(false);

    // 3. First diner (Alice) joins as Table Host
    const aliceJoin = await aliceHostAgent.post('/api/customer/quick-join').send({
      token: tableToken,
      name: 'Alice'
    }).expect(200);

    const alicePin = aliceJoin.body.table.pin;
    expect(alicePin).toMatch(/^\d{4}$/); // 4-digit PIN generated
    expect(aliceJoin.body.tab.isHost).toBe(true);
    expect(aliceJoin.body.tab.isSeparateTab).toBe(false);

    // Alice session check
    const aliceSession = await aliceHostAgent.get('/api/customer/session').query({ token: tableToken }).expect(200);
    expect(aliceSession.body.table.pin).toBe(alicePin);
    expect(aliceSession.body.tab.isHost).toBe(true);

    // 4. Now public endpoint confirms active party seated
    const activeLanding = await bobFriendAgent.get(`/api/public/tables/${tableToken}`).expect(200);
    expect(activeLanding.body.table.hasActiveParty).toBe(true);

    // 5. Second diner (Bob) tries to join table party without PIN -> Rejected
    const bobNoPin = await bobFriendAgent.post('/api/customer/quick-join').send({
      token: tableToken,
      name: 'Bob'
    }).expect(403);
    expect(bobNoPin.body.error.code).toBe('INVALID_TABLE_PIN');

    // 6. Bob tries with wrong PIN -> Rejected
    const bobWrongPin = await bobFriendAgent.post('/api/customer/quick-join').send({
      token: tableToken,
      name: 'Bob',
      pin: '0000'
    }).expect(403);
    expect(bobWrongPin.body.error.code).toBe('INVALID_TABLE_PIN');

    // 7. Bob joins with Alice's 4-digit PIN -> Admitted to shared cart
    const bobSuccess = await bobFriendAgent.post('/api/customer/quick-join').send({
      token: tableToken,
      name: 'Bob',
      pin: alicePin
    }).expect(200);
    expect(bobSuccess.body.tab.isSeparateTab).toBe(false);
    expect(bobSuccess.body.table.pin).toBe(alicePin);

    // Bob adds an item to the shared table cart
    await bobFriendAgent.post('/api/customer/cart/items').send({
      token: tableToken,
      menuItemId: dishId,
      quantity: 1
    }).expect(200);

    // Alice sees Bob's item in the shared table cart
    const aliceCart = await aliceHostAgent.get('/api/customer/cart').query({ token: tableToken }).expect(200);
    expect(aliceCart.body.items).toHaveLength(1);
    expect(aliceCart.body.items[0].addedByName).toBe('Bob');

    // 8. Third diner (Stranger Charlie): rush evening, takes open seat on Table 4, chooses "Separate Bill"
    const charlieJoin = await charlieSoloAgent.post('/api/customer/quick-join').send({
      token: tableToken,
      name: 'Charlie',
      separateTab: true
    }).expect(200);

    expect(charlieJoin.body.tab.isSeparateTab).toBe(true);
    expect(charlieJoin.body.tab.isHost).toBe(false);
    expect(charlieJoin.body.table.pin).toBeNull(); // Stranger does not see host's PIN

    // Charlie's cart is empty and completely independent from Alice & Bob's cart
    const charlieCartInitial = await charlieSoloAgent.get('/api/customer/cart').query({ token: tableToken }).expect(200);
    expect(charlieCartInitial.body.items).toHaveLength(0);

    // Charlie adds an item to his own separate tab cart
    await charlieSoloAgent.post('/api/customer/cart/items').send({
      token: tableToken,
      menuItemId: dishId,
      quantity: 2
    }).expect(200);

    // Verify Alice's cart is untouched (still 1 item)
    const aliceCartAfterCharlie = await aliceHostAgent.get('/api/customer/cart').query({ token: tableToken }).expect(200);
    expect(aliceCartAfterCharlie.body.items).toHaveLength(1);
    expect(aliceCartAfterCharlie.body.items[0].quantity).toBe(1);

    // Charlie places his separate order
    const charlieOrderRes = await charlieSoloAgent.post('/api/customer/orders').send({
      token: tableToken,
      idempotencyKey: 'charlie-order-key-1',
      items: [{ menuItemId: dishId, quantity: 2 }]
    }).expect(201);
    expect(charlieOrderRes.body.order.tabLabel).toContain('Separate Bill (Charlie)');

    // Charlie's order list contains his order
    const charlieOrders = await charlieSoloAgent.get('/api/customer/orders').query({ token: tableToken }).expect(200);
    expect(charlieOrders.body.orders).toHaveLength(1);
    expect(charlieOrders.body.orders[0].id).toBe(charlieOrderRes.body.order.id);

    // Alice's order list does NOT contain Charlie's order
    const aliceOrders = await aliceHostAgent.get('/api/customer/orders').query({ token: tableToken }).expect(200);
    expect(aliceOrders.body.orders).toHaveLength(0);

    // 9. Table vacate: Staff marks table vacated / clean
    await ownerAgent.post(`/api/tables/${tableId}/vacate`).expect(200);

    // Customer sessions are now revoked
    await aliceHostAgent.get('/api/customer/session').query({ token: tableToken }).expect(401);
    await charlieSoloAgent.get('/api/customer/session').query({ token: tableToken }).expect(401);

    // Table PIN is reset: next customer finds table free of active party
    const resetLanding = await supertest(app!.httpServer).get(`/api/public/tables/${tableToken}`).expect(200);
    expect(resetLanding.body.table.hasActiveParty).toBe(false);
  }, 120_000);
});
