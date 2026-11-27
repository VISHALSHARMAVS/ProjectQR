import session from 'express-session';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication, type ProjectQrApplication } from './app.js';
import { AuthVerification, EmailQuota } from './models/AuthVerification.js';
import { User } from './models/User.js';

let mongod: MongoMemoryServer;
let application: ProjectQrApplication;
let app: ProjectQrApplication['app'];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  application = createApplication(new session.MemoryStore());
  app = application.app;
}, 60_000);

afterAll(async () => {
  await new Promise<void>((resolve) => application.io.close(() => resolve()));
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );
});

describe('Hardened Restaurant Auth, Email OTP, Staff Phone Login & Password Reset', () => {
  it('blocks disposable and typo emails without consuming daily email quota', async () => {
    await request(app)
      .post('/api/auth/register-request')
      .send({
        restaurantName: 'Spam Cafe',
        ownerName: 'Bot User',
        email: 'bot@mailinator.com',
        password: 'StrongPassword1'
      })
      .expect(400);

    await request(app)
      .post('/api/auth/register-request')
      .send({
        restaurantName: 'Typo Cafe',
        ownerName: 'Real User',
        email: 'owner@gmial.com',
        password: 'StrongPassword1'
      })
      .expect(400);

    const quota = await EmailQuota.findOne({});
    expect(quota).toBeNull();
  });

  it('completes 2-step email OTP registration, enforces 60s cooldown, and rejects bad OTP', async () => {
    const reqRes = await request(app)
      .post('/api/auth/register-request')
      .send({
        restaurantName: 'Spice House',
        ownerName: 'Aarav',
        email: 'aarav@spicehouse.in',
        password: 'StrongPassword1'
      })
      .expect(200);

    expect(reqRes.body.mockOtp).toMatch(/^\d{6}$/);

    // Immediate resend is blocked by 60s cooldown
    await request(app)
      .post('/api/auth/register-request')
      .send({
        restaurantName: 'Spice House',
        ownerName: 'Aarav',
        email: 'aarav@spicehouse.in',
        password: 'StrongPassword1'
      })
      .expect(429);

    // Wrong OTP fails
    await request(app)
      .post('/api/auth/register-verify')
      .send({
        email: 'aarav@spicehouse.in',
        code: '000000'
      })
      .expect(400);

    // Correct OTP creates restaurant + verified owner and signs in
    const agent = request.agent(app);
    const verifyRes = await agent
      .post('/api/auth/register-verify')
      .send({
        email: 'aarav@spicehouse.in',
        code: reqRes.body.mockOtp
      })
      .expect(201);

    expect(verifyRes.body.restaurant.name).toBe('Spice House');
    expect(verifyRes.body.user.email).toBe('aarav@spicehouse.in');
    await agent.get('/api/auth/me').expect(200);
  });

  it('allows owner to create phone-only staff, supports phone login, and enforces brute-force lockout', async () => {
    const ownerAgent = request.agent(app);
    const reg = await request(app)
      .post('/api/auth/register-request')
      .send({
        restaurantName: 'Tandoor Palace',
        ownerName: 'Vikram',
        email: 'vikram@tandoor.in',
        password: 'StrongPassword1'
      })
      .expect(200);

    await ownerAgent
      .post('/api/auth/register-verify')
      .send({ email: 'vikram@tandoor.in', code: reg.body.mockOtp })
      .expect(201);

    // Owner creates phone-only waiter (no verification required)
    const staffRes = await ownerAgent
      .post('/api/restaurant/staff')
      .send({
        name: 'Rohan Waiter',
        phone: '9876543210',
        password: 'WaiterPass123',
        role: 'waiter'
      })
      .expect(201);

    expect(staffRes.body.user.phone).toBe('+919876543210');

    // Waiter logs in using mobile number
    const waiterAgent = request.agent(app);
    await waiterAgent
      .post('/api/auth/login')
      .send({ identifier: '9876543210', password: 'WaiterPass123' })
      .expect(200);
    await waiterAgent.get('/api/auth/me').expect(200);

    // 5 failed attempts trigger account lockout
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ identifier: '9876543210', password: 'WrongPassword' })
        .expect(401);
    }

    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '9876543210', password: 'WaiterPass123' })
      .expect(429);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('invalidates existing sessions on forgot-password reset and change-password', async () => {
    const sessionA = request.agent(app);
    const sessionB = request.agent(app);

    const reg = await request(app)
      .post('/api/auth/register-request')
      .send({
        restaurantName: 'Curry Leaf',
        ownerName: 'Meera',
        email: 'meera@curryleaf.in',
        password: 'StrongPassword1'
      })
      .expect(200);

    await sessionA
      .post('/api/auth/register-verify')
      .send({ email: 'meera@curryleaf.in', code: reg.body.mockOtp })
      .expect(201);

    await sessionB
      .post('/api/auth/login')
      .send({ identifier: 'meera@curryleaf.in', password: 'StrongPassword1' })
      .expect(200);

    // Change password in sessionA -> sessionA stays valid, sessionB is invalidated
    await sessionA
      .post('/api/auth/change-password')
      .send({ currentPassword: 'StrongPassword1', newPassword: 'NewPassword2' })
      .expect(200);

    await sessionA.get('/api/auth/me').expect(200);
    await sessionB.get('/api/auth/me').expect(401);

    // Forgot password anti-enumeration for unknown user
    const unknownForgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: 'nobody@curryleaf.in' })
      .expect(200);
    expect(unknownForgot.body.mockOtp).toBeUndefined();

    // Forgot password for real user -> reset password -> invalidates sessionA too
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: 'meera@curryleaf.in' })
      .expect(200);
    expect(forgotRes.body.mockOtp).toMatch(/^\d{6}$/);

    await request(app)
      .post('/api/auth/reset-password')
      .send({
        identifier: 'meera@curryleaf.in',
        code: forgotRes.body.mockOtp,
        newPassword: 'ResetPassword3'
      })
      .expect(200);

    await sessionA.get('/api/auth/me').expect(401);

    const user = await User.findOne({ email: 'meera@curryleaf.in' });
    expect(user?.tokenVersion).toBe(2);
    expect(await AuthVerification.countDocuments({ purpose: 'RESET_PASSWORD' })).toBe(0);
  });
});
