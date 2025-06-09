const express = require('express');
const bcrypt = require('bcryptjs');
const { generateTokens, rotateRefreshToken } = require('../../middleware/auth');
const RefreshToken = require('../../models/refreshToken');
const User = require('../../models/User');
const router = express.Router();

/**
 * POST /api/v1/auth/login
 * body: { email, password }
 * Returns: { accessToken, refreshToken }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: { message: 'Email and password are required' } 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: { message: 'Invalid email format' } 
      });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update login stats
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const fingerprint = req.fingerprint || req.body.fingerprint || 'unknown';
    const tokens = await generateTokens({ id: user._id.toString() }, fingerprint);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/refresh
 * body: { refreshToken }
 * Returns new token pair and invalidates old refresh token.
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    // Validate input
    if (!refreshToken) {
      return res.status(400).json({ 
        error: { message: 'Refresh token is required' } 
      });
    }
    
    // Validate token format (64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(refreshToken)) {
      return res.status(400).json({ 
        error: { message: 'Invalid refresh token format' } 
      });
    }
    const fingerprint = req.fingerprint || 'unknown';
    const tokens = await rotateRefreshToken(refreshToken, fingerprint);
    res.json(tokens);
  } catch (err) {
    if (err.message && (err.message.includes('Invalid refresh token') || err.message.includes('expired'))) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/auth/logout
 * body: { refreshToken }
 * Invalidates the given refresh token.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken required' });
    }
    const tokenHash = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
    await RefreshToken.findOneAndUpdate({ tokenHash }, { consumed: true });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/logout
 * body: { refreshToken }
 * Invalidates the refresh token
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ 
        error: { message: 'Refresh token is required' } 
      });
    }
    
    const RefreshToken = require('../../models/refreshToken');
    const crypto = require('crypto');
    
    // Hash the token to find it in database
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    // Mark the token as consumed
    const result = await RefreshToken.findOneAndUpdate(
      { tokenHash, consumed: false },
      { consumed: true },
      { new: true }
    );
    
    if (!result) {
      return res.status(400).json({ 
        error: { message: 'Invalid or already consumed token' } 
      });
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// Protected route example
router.get('/me', async (req, res) => {
  // The checkJwt middleware is already applied globally in app.js
  // so req.user should be available here
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  res.json({ userId: req.user.sub, fingerprint: req.user.fp });
});

module.exports = router; 