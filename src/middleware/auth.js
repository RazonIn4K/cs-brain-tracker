"use strict";

/**
 * JWT authentication helpers & middleware
 * ---------------------------------------
 * Implements 2025 best-practice patterns:
 *  • RS256 signing with locally stored private key (4096-bit) located in ./keys/
 *  • Public-key verification via remote JWKS endpoint **with caching & rate-limit** (5 req/min)
 *  • `aud` and `iss` claim validation
 *  • Single-use refresh tokens with MongoDB tracking
 *  • Token binding to device fingerprint (req.fingerprint)
 *
 * NOTE: Requires the following environment variables:
 *  - JWT_ISSUER   → e.g. "https://cs-brain-tracker.local/"  (MUST include trailing slash)
 *  - JWT_AUDIENCE → e.g. "cs-brain-tracker-api"
 *  - JWKS_URI     → (optional) Remote JWKS endpoint; defaults to local public key if absent
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwksRsa = require("jwks-rsa");
const { expressjwt: jwtMiddleware } = require("express-jwt");
const jsonwebtoken = require("jsonwebtoken");
const RefreshToken = require("../models/refreshToken");

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const PRIVATE_KEY_PATH = path.join(__dirname, "../../keys/private.key");
const PUBLIC_KEY_PATH = path.join(__dirname, "../../keys/public.key");

const ISSUER = process.env.JWT_ISSUER || "https://cs-brain-tracker.local/";
const AUDIENCE = process.env.JWT_AUDIENCE || "cs-brain-tracker-api";

// JWKS client (if JWKS_URI provided) with caching & rate-limit ---------------
const jwksUri = process.env.JWKS_URI;
const jwtSecret = jwksUri
  ? jwksRsa.expressJwtSecret({
      cache: true,
      cacheMaxEntries: 5, // default is 5
      jwksRequestsPerMinute: 5,
      jwksUri,
    })
  : fs.readFileSync(PUBLIC_KEY_PATH, "utf8");

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
/**
 * Returns a SHA-256 hash (hex) of the provided token. Used to avoid storing
 * refresh tokens in plaintext.
 * @param {string} token – raw refresh token
 * @returns {string} hex-encoded hash
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates an access token (15 minutes) & a refresh token (30 days).
 * The refresh token is stored **hashed** in MongoDB and is single-use.
 *
 * @param {object} user – Arbitrary user object (must include `id`)
 * @param {string} fingerprint – Device/session fingerprint (e.g. from express-fingerprint)
 * @returns {{ accessToken: string, refreshToken: string }}
 */
async function generateTokens(user, fingerprint) {
  if (!user?.id) throw new Error("User object must include an id field");

  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");

  // Access token – 15 min TTL
  const accessToken = jsonwebtoken.sign(
    {
      sub: user.id,
      fp: typeof fingerprint === 'object' ? fingerprint.hash : fingerprint,
    },
    privateKey,
    {
      algorithm: "RS256",
      expiresIn: "15m",
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );

  // Refresh token – random 256-bit string
  const rawRefresh = crypto.randomBytes(32).toString("hex");
  const refreshToken = new RefreshToken({
    user: user.id,
    tokenHash: hashToken(rawRefresh),
    device: typeof fingerprint === 'object' ? fingerprint.hash : fingerprint,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  await refreshToken.save();

  return { accessToken, refreshToken: rawRefresh };
}

/**
 * Consumes an existing refresh token and returns a new pair. Enforces
 * single-use by deleting (or marking) the existing token document.
 *
 * @param {string} rawRefreshToken – The plaintext refresh token from client
 * @param {string} fingerprint – Device/session fingerprint
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function rotateRefreshToken(rawRefreshToken, fingerprint) {
  const tokenHash = hashToken(rawRefreshToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  const deviceHash = typeof fingerprint === 'object' ? fingerprint.hash : fingerprint;
  if (!existing || existing.consumed || existing.device !== deviceHash) {
    throw new Error("Invalid refresh token");
  }
  if (existing.expiresAt < Date.now()) {
    throw new Error("Refresh token expired");
  }

  // Mark as consumed to enforce single-use
  existing.consumed = true;
  await existing.save();

  // Generate new pair
  const newPair = await generateTokens({ id: existing.user }, fingerprint);
  return newPair;
}

// ---------------------------------------------------------------------------
// MIDDLEWARE
// ---------------------------------------------------------------------------

/**
 * Primary JWT verification middleware (access tokens).
 * Validates RS256 signature, `aud` & `iss` claims, caches JWKS keys, and
 * attaches the verified token payload to `req.user`.
 */
const checkJwt = jwtMiddleware({
  secret: jwtSecret,
  audience: AUDIENCE,
  issuer: ISSUER,
  algorithms: ["RS256"],
}).unless({ 
  path: [
    // Auth endpoints
    /\/auth\/login$/,
    /\/auth\/refresh$/,
    /\/auth\/logout$/,
    // OAuth endpoints
    /\/auth\/google/,
    /\/auth\/github/,
    /\/auth\/discord/,
    // Health check
    /\/health$/,
    // Static files (not under /api)
    /^(?!\/api)/
  ] 
});

/**
 * Token-binding middleware. Ensures the `fp` claim inside the access token
 * matches the device fingerprint (`req.fingerprint`). Prevents cross-device
 * replay attacks.
 */
function enforceTokenBinding(req, res, next) {
  try {
    const tokenFp = req.user?.fp;
    const deviceFp = req.fingerprint ? 
      (typeof req.fingerprint === 'object' ? req.fingerprint.hash : req.fingerprint) : 
      null;
    if (tokenFp && deviceFp && tokenFp !== deviceFp) {
      return res.status(401).json({ message: "Token binding mismatch" });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkJwt,
  enforceTokenBinding,
  generateTokens,
  rotateRefreshToken,
};