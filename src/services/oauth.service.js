const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

const configureOAuth = () => {
  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/google/callback`,
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ 
        $or: [
          { email: profile.emails[0].value },
          { providerId: profile.id, provider: 'google' }
        ]
      });

      if (!user) {
        user = await User.create({
          email: profile.emails[0].value,
          name: profile.displayName,
          provider: 'google',
          providerId: profile.id,
          'profile.avatar': profile.photos[0]?.value,
          isEmailVerified: true
        });
      } else if (!user.providerId) {
        // Link existing account
        user.provider = 'google';
        user.providerId = profile.id;
        user.profile.avatar = profile.photos[0]?.value;
        await user.save();
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // GitHub OAuth Strategy
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/github/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;
      
      let user = await User.findOne({ 
        $or: [
          { email: email },
          { providerId: profile.id, provider: 'github' }
        ]
      });

      if (!user) {
        user = await User.create({
          email: email,
          name: profile.displayName || profile.username,
          provider: 'github',
          providerId: profile.id,
          'profile.avatar': profile.photos[0]?.value,
          isEmailVerified: true
        });
      } else if (!user.providerId) {
        user.provider = 'github';
        user.providerId = profile.id;
        user.profile.avatar = profile.photos[0]?.value;
        await user.save();
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Discord OAuth Strategy
  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/discord/callback`,
    scope: ['identify', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ 
        $or: [
          { email: profile.email },
          { providerId: profile.id, provider: 'discord' }
        ]
      });

      if (!user) {
        user = await User.create({
          email: profile.email,
          name: profile.username,
          provider: 'discord',
          providerId: profile.id,
          'profile.avatar': profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
          isEmailVerified: profile.verified
        });
      } else if (!user.providerId) {
        user.provider = 'discord';
        user.providerId = profile.id;
        user.profile.avatar = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null;
        await user.save();
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Serialize/deserialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

module.exports = { configureOAuth };