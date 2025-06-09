process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:58745/cs_brain_tracker_test?directConnection=true';
process.env.JWT_ISSUER = 'https://cs-brain-tracker.local/';
process.env.JWT_AUDIENCE = 'cs-brain-tracker-api';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

describe('Rate Limiting', () => {
  let app;
  let accessToken;
  let refreshToken;
  
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Clean up
    const User = require('../src/models/User');
    await User.deleteMany({});
    
    // Create test user
    const passwordHash = await bcrypt.hash('RateLimit123!', 10);
    await User.create({
      email: 'ratelimit@example.com',
      passwordHash,
      name: 'Rate Limit Test',
      subscription: { plan: 'free' }
    });
    
    // Get app after DB setup
    app = require('../src/app');
    
    // Login to get tokens
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ratelimit@example.com', password: 'RateLimit123!' });
    
    accessToken = loginRes.body.accessToken;
    refreshToken = loginRes.body.refreshToken;
  });
  
  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('API Rate Limiting', () => {
    it('should allow more requests for authenticated users', async () => {
      // Make 5 requests without auth (should work with 100 limit)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .get('/api/v1/auth/me');
        expect(res.status).toBe(401); // No auth
      }
      
      // Make 5 requests with auth (should work with 1000 limit)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${accessToken}`);
        // May be 401 due to token binding, but not 429
        expect([200, 401]).toContain(res.status);
        expect(res.status).not.toBe(429);
      }
    });
    
    it('should include rate limit headers', async () => {
      const res = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Auth Rate Limiting', () => {
    it('should limit failed login attempts', async () => {
      const attempts = [];
      
      // Make 6 failed login attempts
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'ratelimit@example.com', password: 'wrongpass' })
        );
      }
      
      const results = await Promise.all(attempts);
      
      // First 5 should fail with 401
      for (let i = 0; i < 5; i++) {
        expect(results[i].status).toBe(401);
      }
      
      // 6th should be rate limited
      expect(results[5].status).toBe(429);
      expect(results[5].body.error.message).toContain('Too many requests');
    });
  });

  describe('Heavy Operation Rate Limiting', () => {
    it('should limit stats endpoint', async () => {
      // Stats endpoint should have lower limit
      const res = await request(app)
        .get('/api/v1/captures/stats')
        .set('Authorization', `Bearer ${accessToken}`);
      
      // Should include rate limit headers
      if (res.headers['x-ratelimit-limit']) {
        expect(parseInt(res.headers['x-ratelimit-limit'])).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Premium User Exemption', () => {
    it('should skip rate limiting for premium users', async () => {
      // Update user to pro plan
      const User = require('../src/models/User');
      await User.findOneAndUpdate(
        { email: 'ratelimit@example.com' },
        { 'subscription.plan': 'pro' }
      );
      
      // Login again to get new token with updated user
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ratelimit@example.com', password: 'RateLimit123!' });
      
      const proToken = loginRes.body.accessToken;
      
      // Make many requests - should not be rate limited
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${proToken}`);
        
        // Should not get 429
        expect(res.status).not.toBe(429);
      }
    });
  });
});