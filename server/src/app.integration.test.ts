import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import session from 'express-session';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { io as clientIo, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type TestAgent = ReturnType<typeof supertest.agent>;
type App = import('./app.js').ProjectQrApplication;

let mongo: MongoMemoryServer | undefined;
let app: App | undefined;
let ownerA: TestAgent;
let ownerB: TestAgent;
let customer: TestAgent;
let kitchenAgent: TestAgent;
let baseUrl: string;
let uploadDirectory: string | undefined;
const sockets: Socket[] = [];

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const header = response.headers['set-cookie'];
  const cookie = Array.isArray(header) ? header[0] : header;
  if (typeof cookie !== 'string') throw new Error('The test response did not set a session cookie.');
  return cookie.split(';')[0]!;
}

function waitForSocketEvent(socket: Socket, name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, onEvent);
      reject(new Error(`Timed out waiting for Socket.io event ${name}`));
    }, 8000);
    const onEvent = (payload: unknown): void => {
      clearTimeout(timer);
      socket.off('connect_error', onError);
      resolve(payload);
    };
    const onError = (error: Error): void => {
      clearTimeout(timer);
      socket.off(name, onEvent);
      reject(error);
    };
    socket.once(name, onEvent);
    socket.once('connect_error', onError);
  });
}

function authenticatedSocket(cookie: string): Socket {
  const socket = clientIo(baseUrl, { transports: ['websocket'], forceNew: true, autoConnect: false, extraHeaders: { Cookie: cookie } });
  sockets.push(socket);
  return socket;
}

describe('restaurant-to-kitchen ordering workflow', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    uploadDirectory = await mkdtemp(path.join(os.tmpdir(), 'projectqr-upload-test-'));
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongo.getUri('projectqr-integration');
    process.env.OTP_MODE = 'mock';
    process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    process.env.SESSION_SECRET = 'integration-session-secret-32-characters-long';
    process.env.OTP_SECRET = 'integration-otp-secret-32-characters-long';
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
    const address = app.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    ownerA = supertest.agent(app.httpServer);
    ownerB = supertest.agent(app.httpServer);
    customer = supertest.agent(app.httpServer);
    kitchenAgent = supertest.agent(app.httpServer);
  }, 240_000);

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    if (app) await new Promise<void>((resolve) => app!.io.close(() => resolve()));
    await mongoose.disconnect();
    await mongo?.stop();
    if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
  }, 30_000);

  it('registers tenants, keeps their data separate, verifies a table customer, prices and tracks orders safely', async () => {
    const registerA = await ownerA.post('/api/auth/register').send({ restaurantName: 'Green Fork', ownerName: 'Asha Rao', email: 'asha@greenfork.test', password: 'green-fork-test-password' }).expect(201);
    const registerB = await ownerB.post('/api/auth/register').send({ restaurantName: 'Blue Spoon', ownerName: 'Dev Shah', email: 'dev@bluespoon.test', password: 'blue-spoon-test-password' }).expect(201);
    const restaurantA = registerA.body.restaurant as { id: string; name: string };
    const restaurantB = registerB.body.restaurant as { id: string; name: string };
    await ownerA.get('/api/auth/me').expect(200);
    await ownerA.post('/api/auth/register').send({ restaurantName: 'Duplicate', ownerName: 'Asha Rao', email: 'asha@greenfork.test', password: 'another-test-password' }).expect(409);
    const kitchenUser = (await ownerA.post('/api/restaurant/staff').send({ name: 'Nia Cook', email: 'nia@greenfork.test', password: 'kitchen-test-password', role: 'kitchen' }).expect(201)).body.user as { id: string; role: string };
    expect(kitchenUser.role).toBe('kitchen');
    const staffAList = await ownerA.get('/api/restaurant/staff').expect(200);
    expect(staffAList.body.users).toHaveLength(2);
    const staffBList = await ownerB.get('/api/restaurant/staff').expect(200);
    expect(staffBList.body.users).toHaveLength(1);
    await ownerB.patch(`/api/restaurant/staff/${kitchenUser.id}`).send({ active: false }).expect(404);
    await kitchenAgent.post('/api/auth/login').send({ email: 'nia@greenfork.test', password: 'kitchen-test-password' }).expect(200);
    await kitchenAgent.get('/api/categories').expect(403);

    const { User } = await import('./models/User.js');
    const userRecord = await User.findOne({ email: 'asha@greenfork.test' }).select('+passwordHash');
    expect(userRecord?.passwordHash).not.toBe('green-fork-test-password');
    const login = await supertest(app!.httpServer).post('/api/auth/login').send({ email: 'asha@greenfork.test', password: 'green-fork-test-password' }).expect(200);
    expect(login.body.restaurant.id).toBe(restaurantA.id);
    const staffSocketA = authenticatedSocket(cookieFrom(login));
    const loginB = await supertest(app!.httpServer).post('/api/auth/login').send({ email: 'dev@bluespoon.test', password: 'blue-spoon-test-password' }).expect(200);
    const staffSocketB = authenticatedSocket(cookieFrom(loginB));
    const staffAReady = waitForSocketEvent(staffSocketA, 'connection:ready');
    const staffBReady = waitForSocketEvent(staffSocketB, 'connection:ready');
    staffSocketA.connect();
    staffSocketB.connect();
    await Promise.all([staffAReady, staffBReady]);
    const unauthorized = clientIo(baseUrl, { transports: ['websocket'], forceNew: true, autoConnect: false });
    sockets.push(unauthorized);
    const deniedPromise = waitForSocketEvent(unauthorized, 'connect_error');
    unauthorized.connect();
    const denied = await deniedPromise as Error;
    expect(denied.message).toMatch(/authentication/i);

    const categoryA = (await ownerA.post('/api/categories').send({ name: 'Small plates' }).expect(201)).body.category as { _id: string };
    const categoryB = (await ownerB.post('/api/categories').send({ name: 'Pasta' }).expect(201)).body.category as { _id: string };
    const itemA = (await ownerA.post('/api/menu').send({ categoryId: categoryA._id, name: 'Paneer bowl', pricePaise: 1450 }).expect(201)).body.item as { _id: string; name: string };
    const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk9sAAAAASUVORK5CYII=', 'base64');
    const uploaded = await ownerA.post(`/api/menu/${itemA._id}/image`).attach('image', imageBytes, { filename: 'one-pixel.png', contentType: 'image/png' }).expect(200);
    expect(uploaded.body.item.imageUrl).toMatch(/^\/uploads\/[a-f\d-]+\.png$/i);
    const storedImage = await supertest(app!.httpServer).get(uploaded.body.item.imageUrl).expect(200);
    expect(storedImage.headers['content-type']).toMatch(/image\/png/);
    const itemB = (await ownerB.post('/api/menu').send({ categoryId: categoryB._id, name: 'Tomato pasta', pricePaise: 1200 }).expect(201)).body.item as { _id: string };
    await ownerA.patch(`/api/categories/${categoryB._id}`).send({ name: 'Stolen category' }).expect(404);
    const ownCategories = await ownerA.get('/api/categories').expect(200);
    expect(ownCategories.body.categories.map((entry: { _id: string }) => entry._id)).toEqual([categoryA._id]);

    const tableA = (await ownerA.post('/api/tables').send({ label: '1' }).expect(201)).body.table as { id: string; label: string };
    const tableB = (await ownerB.post('/api/tables').send({ label: '1' }).expect(201)).body.table as { id: string };
    await ownerA.post(`/api/tables/${tableB.id}/qr`).expect(404);
    const qrA = (await ownerA.post(`/api/tables/${tableA.id}/qr`).expect(200)).body as { url: string };
    const tokenA = new URL(qrA.url).pathname.split('/').pop()!;
    const qrB = (await ownerB.post(`/api/tables/${tableB.id}/qr`).expect(200)).body as { url: string };
    const tokenB = new URL(qrB.url).pathname.split('/').pop()!;
    const qrLanding = await supertest(app!.httpServer).get(`/api/public/tables/${tokenA}`).expect(200);
    expect(qrLanding.body.restaurant.name).toBe(restaurantA.name);
    expect(qrLanding.body.table.label).toBe('1');

    const requestOtp = await customer.post('/api/customer/request-otp').send({ token: tokenA, name: 'Mira', phone: '98765 43210' }).expect(202);
    expect(requestOtp.body.mockOtp).toMatch(/^\d{6}$/);
    const wrongOtp = requestOtp.body.mockOtp === '000000' ? '000001' : '000000';
    await customer.post('/api/customer/verify-otp').send({ token: tokenA, name: 'Mira', phone: '98765 43210', code: wrongOtp }).expect(400);
    const verified = await customer.post('/api/customer/verify-otp').send({ token: tokenA, name: 'Mira', phone: '98765 43210', code: requestOtp.body.mockOtp }).expect(200);
    expect(verified.body.sessionId).toBeTruthy();
    const customerSocket = authenticatedSocket(cookieFrom(verified));
    const customerReady = waitForSocketEvent(customerSocket, 'connection:ready');
    customerSocket.connect();
    await customerReady;
    await customer.get('/api/customer/session').query({ token: tokenA }).expect(200);
    await customer.get('/api/customer/session').query({ token: tokenB }).expect(403);
    const menu = await customer.get('/api/customer/menu').query({ token: tokenA }).expect(200);
    expect(menu.body.items.map((entry: { _id: string }) => entry._id)).toEqual([itemA._id]);

    const baseOrder = { token: tokenA, idempotencyKey: 'order-key-00000001', items: [{ menuItemId: itemA._id, quantity: 2, notes: 'Less spicy', expectedUnitPricePaise: 1450 }], notes: 'Birthday lunch' };
    await customer.post('/api/customer/orders').send({ ...baseOrder, items: [{ menuItemId: itemB._id, quantity: 1, notes: '', expectedUnitPricePaise: 1200 }] }).expect(409);
    await customer.post('/api/customer/orders').send({ ...baseOrder, items: [{ ...baseOrder.items[0], expectedUnitPricePaise: 1000 }] }).expect(409);
    const newOrderEvent = waitForSocketEvent(staffSocketA, 'order:new');
    const placed = await customer.post('/api/customer/orders').send(baseOrder).expect(201);
    const order = placed.body.order as { id: string; status: string; totalPaise: number; items: { name: string; unitPricePaise: number }[] };
    expect(order.totalPaise).toBe(2900);
    expect(order.items[0]?.unitPricePaise).toBe(1450);
    const eventPayload = await newOrderEvent as Record<string, unknown>;
    expect(eventPayload.orderNumber).toBe(placed.body.order.orderNumber);
    expect(eventPayload).not.toHaveProperty('customer');
    expect(eventPayload).not.toHaveProperty('phone');
    const roomA = app!.io.sockets.adapter.rooms.get(`restaurant:${restaurantA.id}`);
    const roomB = app!.io.sockets.adapter.rooms.get(`restaurant:${restaurantB.id}`);
    expect(roomA?.has(staffSocketA.id!)).toBe(true);
    expect(roomB?.has(staffSocketB.id!)).toBe(true);
    expect(roomA?.has(staffSocketB.id!)).toBeFalsy();
    expect(roomB?.has(staffSocketA.id!)).toBeFalsy();
    const duplicate = await customer.post('/api/customer/orders').send(baseOrder).expect(200);
    expect(duplicate.body.order.id).toBe(order.id);

    await kitchenAgent.get('/api/restaurant/orders').expect(200);
    await kitchenAgent.patch(`/api/restaurant/orders/${order.id}/status`).send({ status: 'PREPARING' }).expect(409);
    await ownerB.patch(`/api/restaurant/orders/${order.id}/status`).send({ status: 'ACCEPTED' }).expect(404);
    await ownerA.patch(`/api/menu/${itemA._id}`).send({ pricePaise: 9999 }).expect(200);
    const savedOrder = await customer.get(`/api/customer/orders/${order.id}`).query({ token: tokenA }).expect(200);
    expect(savedOrder.body.order.totalPaise).toBe(2900);
    expect(savedOrder.body.order.items[0].unitPricePaise).toBe(1450);

    const statusEvent = waitForSocketEvent(customerSocket, 'order:status');
    await kitchenAgent.patch(`/api/restaurant/orders/${order.id}/status`).send({ status: 'ACCEPTED' }).expect(200);
    expect((await statusEvent as { status: string }).status).toBe('ACCEPTED');
    await kitchenAgent.patch(`/api/restaurant/orders/${order.id}/status`).send({ status: 'PREPARING' }).expect(200);
    await kitchenAgent.patch(`/api/restaurant/orders/${order.id}/status`).send({ status: 'READY' }).expect(200);
    await kitchenAgent.patch(`/api/restaurant/orders/${order.id}/status`).send({ status: 'DELIVERED' }).expect(200);
    const customerStatus = await customer.get(`/api/customer/orders/${order.id}`).query({ token: tokenA }).expect(200);
    expect(customerStatus.body.order.status).toBe('DELIVERED');

    const rejectedBody = { ...baseOrder, idempotencyKey: 'order-key-00000002', items: [{ ...baseOrder.items[0], expectedUnitPricePaise: 9999 }] };
    const rejectedOrder = (await customer.post('/api/customer/orders').send(rejectedBody).expect(201)).body.order as { id: string };
    await ownerA.patch(`/api/restaurant/orders/${rejectedOrder.id}/status`).send({ status: 'REJECTED', rejectionReason: 'The kitchen is closing.' }).expect(200);
    const rejection = await customer.get(`/api/customer/orders/${rejectedOrder.id}`).query({ token: tokenA }).expect(200);
    expect(rejection.body.order.status).toBe('REJECTED');
    expect(rejection.body.order.rejectionReason).toBe('The kitchen is closing.');

    await ownerA.delete(`/api/tables/${tableA.id}`).expect(204);
    await supertest(app!.httpServer).get(`/api/public/tables/${tokenA}`).expect(404);
    await customer.get(`/api/customer/orders/${order.id}`).query({ token: tokenA }).expect(200);
    await customer.post('/api/customer/orders').send({ ...baseOrder, idempotencyKey: 'order-key-00000003' }).expect(403);
    const { CustomerSession } = await import('./models/CustomerSession.js');
    await CustomerSession.updateOne({ _id: verified.body.sessionId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await customer.get('/api/customer/session').query({ token: tokenA }).expect(401);
  }, 90_000);
});
