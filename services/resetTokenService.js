/**
 * Reset Token Service
 *
 * Creates and reads the token carried by a password reset link. The token is
 * an encrypted, tamper-proof (AES-256-GCM) record of who the link is for,
 * when it expires and when the user's password was last changed. Comparing
 * that last value with the directory makes a link useless once it has been
 * used, without having to store anything.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getKey() {
  if (!process.env.TOKEN_SECRET) {
    throw new Error('TOKEN_SECRET is not configured');
  }
  // Derive a key that is only ever used for reset links
  return Buffer.from(crypto.hkdfSync('sha256', process.env.TOKEN_SECRET, '', 'reset-password-link', 32));
}

/**
 * Create the token for a reset link
 * @param {Object} user - Target of the link
 * @param {string} user.userId - Directory ID of the user
 * @param {string} user.email - Address shown on the new password form
 * @param {string|null} user.passwordChangedAt - lastPasswordChangeDateTime of the user
 * @returns {string} URL-safe token
 */
function createResetToken({ userId, email, passwordChangedAt }) {
  const payload = JSON.stringify({
    userId,
    email,
    passwordChangedAt,
    expires: Date.now() + TOKEN_TTL_MS,
  });

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

/**
 * Read a token created by createResetToken
 * @param {string} token - Token from the link
 * @returns {Object|null} Its payload, or null if the token is malformed or was altered
 */
function readResetToken(token) {
  const key = getKey();

  try {
    const data = Buffer.from(token, 'base64url');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const payload = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(payload.toString('utf8'));
  } catch (error) {
    return null;
  }
}

module.exports = { createResetToken, readResetToken };
