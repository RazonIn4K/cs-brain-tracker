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
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const fingerprint = req.fingerprint || req.body.fingerprint || 'unknown';
    const tokens = await generateTokens({ id: user._id }, fingerprint);
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
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken required' });
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

// Protected route example
const { checkJwt, enforceTokenBinding } = require('../../middleware/auth');
router.get('/me', checkJwt, enforceTokenBinding, async (req, res) => {
  res.json({ userId: req.user.sub, fingerprint: req.user.fp });
});

module.exports = router; 