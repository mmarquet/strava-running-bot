const crypto = require('node:crypto');
const config = require('../../config/config');
const { ENCRYPTION } = require('../constants');
const logger = require('./Logger');

/**
 * Encryption utility for secure token storage using AES-256-GCM
 *
 * This utility provides centralized encryption and decryption methods
 * for sensitive data (primarily Strava OAuth tokens).
 *
 * Format: Returns object { iv, encrypted, authTag } with all values as hex strings
 * Algorithm: AES-256-GCM (Galois/Counter Mode) for authenticated encryption
 */
class EncryptionUtils {
  /**
   * Encrypt token data for secure storage
   *
   * @param {Object} tokenData - Token data to encrypt (will be JSON.stringify'd)
   * @returns {Object|null} Encrypted data object {iv, encrypted, authTag} or null if no encryption key
   *
   * @example
   * const encrypted = EncryptionUtils.encryptTokens({
   *   access_token: 'abc123',
   *   refresh_token: 'def456',
   *   expires_at: 1234567890
   * });
   * // Returns: { iv: 'hex...', encrypted: 'hex...', authTag: 'hex...' }
   */
  static encryptTokens(tokenData) {
    if (!tokenData) {
      return null;
    }

    if (!config.security.encryptionKey) {
      logger.database?.warn('No encryption key configured, tokens will not be encrypted');
      return null;
    }

    try {
      const algorithm = ENCRYPTION.ALGORITHM;
      const key = Buffer.from(config.security.encryptionKey, 'hex');
      const iv = crypto.randomBytes(ENCRYPTION.IV_LENGTH);

      const cipher = crypto.createCipheriv(algorithm, key, iv);

      const sensitiveData = JSON.stringify(tokenData);
      let encrypted = cipher.update(sensitiveData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        iv: iv.toString('hex'),
        encrypted: encrypted,
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      logger.database?.error('Failed to encrypt tokens', { error: error.message });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt token data from secure storage
   *
   * @param {Object} encryptedData - Encrypted data object with {iv, encrypted, authTag}
   * @returns {Object|null} Decrypted token data or null if decryption fails
   *
   * @example
   * const tokens = EncryptionUtils.decryptTokens({
   *   iv: 'hex...',
   *   encrypted: 'hex...',
   *   authTag: 'hex...'
   * });
   * // Returns: { access_token: 'abc123', refresh_token: 'def456', expires_at: 1234567890 }
   */
  static decryptTokens(encryptedData) {
    if (!encryptedData || !encryptedData.encrypted) {
      return null;
    }

    if (!config.security.encryptionKey) {
      logger.database?.warn('No encryption key available for decryption');
      return null;
    }

    try {
      const algorithm = ENCRYPTION.ALGORITHM;
      const key = Buffer.from(config.security.encryptionKey, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      logger.database?.error('Failed to decrypt tokens', { error: error.message });
      return null;
    }
  }

  /**
   * Encrypt tokens and return as JSON string for database storage
   *
   * @param {Object} tokenData - Token data to encrypt
   * @returns {string|null} JSON string of encrypted data or null
   */
  static encryptTokensToJSON(tokenData) {
    const encrypted = this.encryptTokens(tokenData);
    return encrypted ? JSON.stringify(encrypted) : null;
  }

  /**
   * Decrypt tokens from JSON string format (as stored in database)
   *
   * @param {string} encryptedJSON - JSON string containing encrypted data
   * @returns {Object|null} Decrypted token data or null
   */
  static decryptTokensFromJSON(encryptedJSON) {
    if (!encryptedJSON) {
      return null;
    }

    try {
      const encryptedData = JSON.parse(encryptedJSON);
      return this.decryptTokens(encryptedData);
    } catch (error) {
      logger.database?.error('Failed to parse encrypted JSON', { error: error.message });
      return null;
    }
  }

  /**
   * Check if encryption is enabled (encryption key is configured)
   *
   * @returns {boolean} True if encryption key is available
   */
  static isEncryptionEnabled() {
    return !!config.security.encryptionKey;
  }
}

module.exports = EncryptionUtils;
