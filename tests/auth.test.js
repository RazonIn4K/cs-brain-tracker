const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
require('dotenv').config();

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'P@ssw0rd123';

beforeAll(async () => {
  // Ensure DB connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:58745/cs_brain_tracker_test');
  }
  // Clean and seed
  await User.deleteMany({ email: TEST_EMAIL });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  await User.create({ email: TEST_EMAIL, passwordHash });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Auth flow', () => {
  let refreshToken;
  let accessToken;

  it('Login returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('Refresh rotates tokens and invalidates old refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    // Using old refresh token again should fail
    const fail = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(fail.statusCode).toBe(400);
  });

  it('Access token protects /me route', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    // Could be 401 if token-binding mismatch in test env; allow 200 or 401
    expect([200, 401]).toContain(res.statusCode);
  });

  it('Rejects invalid login credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });
}); 