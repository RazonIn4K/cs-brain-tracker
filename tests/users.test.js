// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:58745/cs_brain_tracker_test?directConnection=true';
process.env.JWT_ISSUER = 'https://cs-brain-tracker.local/';
process.env.JWT_AUDIENCE = 'cs-brain-tracker-api';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const express = require('express');
const User = require('../src/models/User');
const { generateTokens } = require('../src/middleware/auth');

// Import required middleware and routes
const fingerprint = require('express-fingerprint');
const { checkJwt, enforceTokenBinding } = require('../src/middleware/auth');
const userRoutes = require('../src/api/routes/users');

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(fingerprint());
  // Apply auth middleware with proper exclusions
  app.use((req, res, next) => {
    // Skip auth for test setup
    if (req.path === '/test/skip-auth') {
      return next();
    }
    checkJwt(req, res, (err) => {
      if (err) return next(err);
      // Skip token binding in tests due to fingerprint mismatch
      next();
    });
  });
  app.use('/api/v1/users', userRoutes);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ 
      error: { message: err.message } 
    });
  });
  return app;
}

describe('User Routes', () => {
  let app;
  let testUser;
  let accessToken;
  
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    app = createTestApp();
  });

  beforeEach(async () => {
    // Clean and create test user
    await User.deleteMany({});
    
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    testUser = await User.create({
      email: 'test@example.com',
      passwordHash,
      name: 'Test User',
      profile: {
        bio: 'Test bio',
        timezone: 'America/New_York'
      },
      preferences: {
        theme: 'dark',
        emailNotifications: true
      }
    });
    
    // Generate token for auth
    const tokens = await generateTokens(
      { id: testUser._id.toString() },
      'test-fingerprint'
    );
    accessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/v1/users/profile', () => {
    it('should return user profile', async () => {
      const res = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.name).toBe(testUser.name);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/v1/users/profile');
      
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/users/profile', () => {
    it('should update user profile', async () => {
      const updates = {
        name: 'Updated Name',
        profile: {
          bio: 'Updated bio',
          avatar: 'https://example.com/avatar.jpg'
        },
        preferences: {
          theme: 'light',
          emailNotifications: false
        }
      };
      
      const res = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updates);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updates.name);
      expect(res.body.data.profile.bio).toBe(updates.profile.bio);
      expect(res.body.data.preferences.theme).toBe(updates.preferences.theme);
    });

    it('should validate name length', async () => {
      const res = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'A' });
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('between 2 and 100 characters');
    });

    it('should validate avatar URL', async () => {
      const res = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ profile: { avatar: 'not-a-url' } });
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('valid URL');
    });

    it('should validate theme options', async () => {
      const res = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ preferences: { theme: 'invalid' } });
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid theme');
    });
  });

  describe('POST /api/v1/users/change-password', () => {
    it('should change password with valid current password', async () => {
      const res = await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'TestPass123!',
          newPassword: 'NewPass123!'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Verify new password works
      const user = await User.findById(testUser._id).select('+passwordHash');
      const isValid = await user.comparePassword('NewPass123!');
      expect(isValid).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      const res = await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPass123!'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('incorrect');
    });

    it('should validate password strength', async () => {
      const res = await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'TestPass123!',
          newPassword: 'weak'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('at least 8 characters');
    });

    it('should require uppercase, lowercase, and number', async () => {
      const res = await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'TestPass123!',
          newPassword: 'alllowercase'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('uppercase');
    });
  });

  describe('GET /api/v1/users/stats', () => {
    it('should return user statistics', async () => {
      // Update user stats
      testUser.stats.totalCaptures = 50;
      testUser.stats.totalReviews = 30;
      testUser.stats.streak.current = 5;
      await testUser.save();
      
      const res = await request(app)
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.totalCaptures).toBe(50);
      expect(res.body.data.user.totalReviews).toBe(30);
      expect(res.body.data.user.streak.current).toBe(5);
    });
  });

  describe('POST /api/v1/users/goals', () => {
    it('should add a learning goal', async () => {
      const goal = {
        goal: 'Complete JavaScript course',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };
      
      const res = await request(app)
        .post('/api/v1/users/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(goal);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].goal).toBe(goal.goal);
      expect(res.body.data[0].completed).toBe(false);
    });

    it('should require goal and target date', async () => {
      const res = await request(app)
        .post('/api/v1/users/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ goal: 'Test goal' });
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });
  });

  describe('DELETE /api/v1/users/account', () => {
    it('should soft delete account with correct password', async () => {
      const res = await request(app)
        .delete('/api/v1/users/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'TestPass123!' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Verify account is deactivated
      const user = await User.findById(testUser._id);
      expect(user.isActive).toBe(false);
      expect(user.email).toContain('deleted_');
    });

    it('should require password', async () => {
      const res = await request(app)
        .delete('/api/v1/users/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Password is required');
    });
  });
});