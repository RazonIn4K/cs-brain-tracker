// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:58745/cs_brain_tracker_test?directConnection=true';
process.env.JWT_ISSUER = 'https://cs-brain-tracker.local/';
process.env.JWT_AUDIENCE = 'cs-brain-tracker-api';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const express = require('express');
const fingerprint = require('express-fingerprint');
const { checkJwt, enforceTokenBinding } = require('../src/middleware/auth');
const authRoutes = require('../src/api/routes/auth');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/refreshToken');

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(fingerprint());
  app.use(checkJwt);
  app.use(enforceTokenBinding);
  app.use('/api/v1/auth', authRoutes);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ 
      error: { message: err.message } 
    });
  });
  return app;
}

describe('Auth Edge Cases', () => {
  let app;
  const TEST_EMAIL = 'edgecase@example.com';
  const TEST_PASSWORD = 'EdgeCase123!';

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
    
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await User.create({ 
      email: TEST_EMAIL, 
      passwordHash,
      name: 'Edge Case User'
    });
    
    app = createTestApp();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Login Edge Cases', () => {
    it('should reject login with missing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: TEST_PASSWORD });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: TEST_EMAIL });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'notanemail', password: TEST_PASSWORD });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject login with empty credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});
      
      expect(res.statusCode).toBe(400);
    });

    it('should reject login for non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'AnyPassword123' });
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Token Validation Edge Cases', () => {
    let validToken;
    let validRefreshToken;

    beforeAll(async () => {
      // Get valid tokens
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      
      validToken = loginRes.body.accessToken;
      validRefreshToken = loginRes.body.refreshToken;
    });

    it('should reject expired access token', async () => {
      // Create an expired token
      const privateKey = fs.readFileSync(path.join(__dirname, '..', 'keys', 'private.pem'), 'utf8');
      const expiredToken = jwt.sign(
        { sub: '123', fp: 'test' },
        privateKey,
        { 
          algorithm: 'RS256',
          expiresIn: '-1h', // Already expired
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE
        }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(res.statusCode).toBe(401);
    });

    it('should reject token with wrong issuer', async () => {
      const privateKey = fs.readFileSync(path.join(__dirname, '..', 'keys', 'private.pem'), 'utf8');
      const wrongIssuerToken = jwt.sign(
        { sub: '123', fp: 'test' },
        privateKey,
        { 
          algorithm: 'RS256',
          expiresIn: '15m',
          issuer: 'wrong-issuer',
          audience: process.env.JWT_AUDIENCE
        }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${wrongIssuerToken}`);
      
      expect(res.statusCode).toBe(401);
    });

    it('should reject token with wrong audience', async () => {
      const privateKey = fs.readFileSync(path.join(__dirname, '..', 'keys', 'private.pem'), 'utf8');
      const wrongAudienceToken = jwt.sign(
        { sub: '123', fp: 'test' },
        privateKey,
        { 
          algorithm: 'RS256',
          expiresIn: '15m',
          issuer: process.env.JWT_ISSUER,
          audience: 'wrong-audience'
        }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${wrongAudienceToken}`);
      
      expect(res.statusCode).toBe(401);
    });

    it('should reject malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'NotBearer ' + validToken);
      
      expect(res.statusCode).toBe(401);
    });

    it('should reject token signed with wrong algorithm', async () => {
      // Try to use HS256 instead of RS256
      const maliciousToken = jwt.sign(
        { sub: '123', fp: 'test' },
        'secret',
        { 
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE
        }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${maliciousToken}`);
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Refresh Token Edge Cases', () => {
    it('should reject refresh with missing token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});
      
      expect(res.statusCode).toBe(400);
    });

    it('should reject refresh with invalid token format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-valid-token' });
      
      expect(res.statusCode).toBe(400);
    });

    it('should reject refresh with non-existent token', async () => {
      const fakeToken = 'a'.repeat(64); // Valid format but doesn't exist
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: fakeToken });
      
      expect(res.statusCode).toBe(400);
    });

    it('should prevent refresh token reuse after logout', async () => {
      // Login to get tokens
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      
      const refreshToken = loginRes.body.refreshToken;
      
      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });
      
      // Try to use the refresh token after logout
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Request Body Validation', () => {
    it('should handle non-JSON request body', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('not json');
      
      expect(res.statusCode).toBe(400);
    });

    it('should handle oversized request body', async () => {
      const hugeString = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: TEST_EMAIL, password: hugeString });
      
      expect([400, 413]).toContain(res.statusCode);
    });

    it('should sanitize SQL injection attempts', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ 
          email: "admin' OR '1'='1", 
          password: TEST_PASSWORD 
        });
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous login attempts', async () => {
      const promises = Array(5).fill(null).map(() => 
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(res => {
        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeDefined();
      });
      
      // All tokens should be different
      const tokens = results.map(r => r.body.accessToken);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(5);
    });
  });
});