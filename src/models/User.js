const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User schema
 * -----------
 * Minimal user model for authentication purposes. Passwords are stored as
 * bcrypt hashes.
 */
const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    profile: {
      bio: {
        type: String,
        maxlength: 500
      },
      avatar: {
        type: String,
        match: [/^https?:\/\/.+/, 'Avatar must be a valid URL']
      },
      timezone: {
        type: String,
        default: 'UTC'
      },
      learningGoals: [{
        goal: String,
        targetDate: Date,
        completed: { type: Boolean, default: false }
      }]
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      },
      emailNotifications: {
        type: Boolean,
        default: true
      },
      reviewReminders: {
        type: Boolean,
        default: true
      },
      dailyReviewTime: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
      },
      language: {
        type: String,
        default: 'en'
      }
    },
    stats: {
      totalCaptures: {
        type: Number,
        default: 0
      },
      totalReviews: {
        type: Number,
        default: 0
      },
      streak: {
        current: { type: Number, default: 0 },
        longest: { type: Number, default: 0 },
        lastActiveDate: Date
      },
      averageRetention: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'pro', 'team'],
        default: 'free'
      },
      validUntil: Date,
      captureLimit: {
        type: Number,
        default: 100
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: Date,
    loginCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
  }
);

// ------------------------
// METHODS
// ------------------------

/**
 * Compare a plaintext password with the stored hash.
 * @param {string} candidate
 * @returns {Promise<boolean>}
 */
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

/**
 * Update password with proper hashing
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
UserSchema.methods.updatePassword = async function (newPassword) {
  this.passwordHash = await bcrypt.hash(newPassword, 10);
  await this.save();
};

/**
 * Check if user has reached capture limit
 * @returns {boolean}
 */
UserSchema.methods.hasReachedCaptureLimit = function () {
  return this.stats.totalCaptures >= this.subscription.captureLimit;
};

/**
 * Update streak based on activity
 * @returns {void}
 */
UserSchema.methods.updateStreak = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastActive = this.stats.streak.lastActiveDate;
  if (!lastActive) {
    this.stats.streak.current = 1;
    this.stats.streak.longest = 1;
  } else {
    const lastActiveDate = new Date(lastActive);
    lastActiveDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      // Same day, no change
      return;
    } else if (daysDiff === 1) {
      // Consecutive day
      this.stats.streak.current += 1;
      this.stats.streak.longest = Math.max(this.stats.streak.current, this.stats.streak.longest);
    } else {
      // Streak broken
      this.stats.streak.current = 1;
    }
  }
  
  this.stats.streak.lastActiveDate = today;
};

/**
 * Get public profile data (excludes sensitive info)
 * @returns {Object}
 */
UserSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    profile: this.profile,
    preferences: this.preferences,
    stats: this.stats,
    subscription: {
      plan: this.subscription.plan,
      captureLimit: this.subscription.captureLimit
    },
    createdAt: this.createdAt
  };
};

// ------------------------
// HOOKS
// ------------------------

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  // This model expects `passwordHash` to already be hashed before save.
  // If you're saving a plaintext password, hash it **before** assigning to
  // `passwordHash`. This hook is a no-op and merely allows other fields to save.
  next();
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema); 