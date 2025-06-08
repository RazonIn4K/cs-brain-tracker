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
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: String,
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