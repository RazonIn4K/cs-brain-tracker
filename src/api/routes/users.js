const router = require('express').Router();
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

/**
 * User management routes
 * All routes are protected by JWT authentication
 */

/**
 * GET /api/v1/users/profile
 * Get current user's profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    
    if (!user || !user.isActive) {
      return res.status(404).json({ 
        error: { message: 'User not found' } 
      });
    }
    
    res.json({
      success: true,
      data: user.toPublicJSON()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/users/profile
 * Update current user's profile
 */
router.put('/profile', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const {
      name,
      profile,
      preferences,
      timezone
    } = req.body;
    
    // Build update object with only allowed fields
    const updates = {};
    
    if (name !== undefined) {
      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ 
          error: { message: 'Name must be between 2 and 100 characters' } 
        });
      }
      updates.name = name;
    }
    
    if (profile !== undefined) {
      // Validate profile fields
      if (profile.bio && profile.bio.length > 500) {
        return res.status(400).json({ 
          error: { message: 'Bio must be 500 characters or less' } 
        });
      }
      if (profile.avatar && !/^https?:\/\/.+/.test(profile.avatar)) {
        return res.status(400).json({ 
          error: { message: 'Avatar must be a valid URL' } 
        });
      }
      updates.profile = { ...profile };
    }
    
    if (preferences !== undefined) {
      // Validate preferences
      if (preferences.theme && !['light', 'dark', 'auto'].includes(preferences.theme)) {
        return res.status(400).json({ 
          error: { message: 'Invalid theme option' } 
        });
      }
      if (preferences.dailyReviewTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(preferences.dailyReviewTime)) {
        return res.status(400).json({ 
          error: { message: 'Daily review time must be in HH:MM format' } 
        });
      }
      updates.preferences = { ...preferences };
    }
    
    if (timezone !== undefined) {
      updates['profile.timezone'] = timezone;
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found' } 
      });
    }
    
    res.json({
      success: true,
      data: user.toPublicJSON(),
      message: 'Profile updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/users/change-password
 * Change user's password
 */
router.post('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: { message: 'Current password and new password are required' } 
      });
    }
    
    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: { message: 'New password must be at least 8 characters long' } 
      });
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ 
        error: { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' } 
      });
    }
    
    // Get user with password
    const user = await User.findById(req.user.sub).select('+passwordHash');
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found' } 
      });
    }
    
    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ 
        error: { message: 'Current password is incorrect' } 
      });
    }
    
    // Update password
    await user.updatePassword(newPassword);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/users/stats
 * Get detailed user statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found' } 
      });
    }
    
    // Get additional stats from captures
    const LearningCapture = require('../../models/LearningCapture');
    
    const [
      capturesByType,
      recentActivity,
      topTags
    ] = await Promise.all([
      // Captures by type
      LearningCapture.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      
      // Recent activity (last 30 days)
      LearningCapture.aggregate([
        { 
          $match: { 
            userId: user._id,
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          } 
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
            avgCognitiveLoad: { $avg: '$cognitiveLoad' }
          }
        },
        { $sort: { _id: -1 } }
      ]),
      
      // Top tags
      LearningCapture.aggregate([
        { $match: { userId: user._id } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        user: {
          ...user.stats,
          memberSince: user.createdAt,
          subscription: user.subscription
        },
        captures: {
          byType: capturesByType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          total: user.stats.totalCaptures
        },
        activity: {
          recent: recentActivity,
          streak: user.stats.streak
        },
        topTags: topTags.map(t => ({ tag: t._id, count: t.count }))
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/users/account
 * Soft delete user account
 */
router.delete('/account', async (req, res, next) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        error: { message: 'Password is required to delete account' } 
      });
    }
    
    // Get user with password
    const user = await User.findById(req.user.sub).select('+passwordHash');
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found' } 
      });
    }
    
    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ 
        error: { message: 'Incorrect password' } 
      });
    }
    
    // Soft delete
    user.isActive = false;
    user.email = `deleted_${user._id}_${user.email}`;
    await user.save();
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/users/goals
 * Add a new learning goal
 */
router.post('/goals', async (req, res, next) => {
  try {
    const { goal, targetDate } = req.body;
    
    if (!goal || !targetDate) {
      return res.status(400).json({ 
        error: { message: 'Goal and target date are required' } 
      });
    }
    
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'User not found' } 
      });
    }
    
    // Add goal
    user.profile.learningGoals.push({
      goal,
      targetDate: new Date(targetDate),
      completed: false
    });
    
    await user.save();
    
    res.json({
      success: true,
      data: user.profile.learningGoals,
      message: 'Goal added successfully'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/users/goals/:goalId
 * Update a learning goal
 */
router.put('/goals/:goalId', async (req, res, next) => {
  try {
    const { goalId } = req.params;
    const { completed } = req.body;
    
    const user = await User.findOneAndUpdate(
      { 
        _id: req.user.sub,
        'profile.learningGoals._id': goalId 
      },
      { 
        $set: { 'profile.learningGoals.$.completed': completed } 
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ 
        error: { message: 'Goal not found' } 
      });
    }
    
    res.json({
      success: true,
      data: user.profile.learningGoals,
      message: 'Goal updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;