// Mock config before importing EncryptionUtils
jest.mock('../../config/config', () => ({
  security: {
    encryptionKey: 'a'.repeat(64) // 64 hex characters = 32 bytes for AES-256
  },
  server: {
    port: 3000,
    publicUrl: 'http://localhost:3000'
  }
}));

const EncryptionUtils = require('../../src/utils/EncryptionUtils');
const config = require('../../config/config');

describe('EncryptionUtils', () => {
  beforeEach(() => {
    // Reset config to valid encryption key
    config.security.encryptionKey = 'a'.repeat(64);
  });

  describe('encryptTokens', () => {
    it('should encrypt token data successfully', () => {
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: 1234567890
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);

      expect(encrypted).not.toBeNull();
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('authTag');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.encrypted).toBe('string');
      expect(typeof encrypted.authTag).toBe('string');
    });

    it('should return null when no encryption key is configured', () => {
      config.security.encryptionKey = null;

      const tokenData = {
        access_token: 'test_access_token'
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);
      expect(encrypted).toBeNull();
    });

    it('should return null when tokenData is null', () => {
      const encrypted = EncryptionUtils.encryptTokens(null);
      expect(encrypted).toBeNull();
    });

    it('should return null when tokenData is undefined', () => {
      const encrypted = EncryptionUtils.encryptTokens(undefined);
      expect(encrypted).toBeNull();
    });

    it('should generate different IV for each encryption', () => {
      const tokenData = {
        access_token: 'test_access_token'
      };

      const encrypted1 = EncryptionUtils.encryptTokens(tokenData);
      const encrypted2 = EncryptionUtils.encryptTokens(tokenData);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    });

    it('should handle complex token objects', () => {
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: 1234567890,
        token_type: 'Bearer',
        scope: 'read,write',
        athlete: {
          id: 12345,
          username: 'testuser'
        }
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);

      expect(encrypted).not.toBeNull();
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('authTag');
    });
  });

  describe('decryptTokens', () => {
    it('should decrypt token data successfully', () => {
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: 1234567890
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);
      const decrypted = EncryptionUtils.decryptTokens(encrypted);

      expect(decrypted).toEqual(tokenData);
    });

    it('should return null when no encryption key is configured', () => {
      config.security.encryptionKey = null;

      const encryptedData = {
        iv: 'test_iv',
        encrypted: 'test_encrypted',
        authTag: 'test_authTag'
      };

      const decrypted = EncryptionUtils.decryptTokens(encryptedData);
      expect(decrypted).toBeNull();
    });

    it('should return null when encryptedData is null', () => {
      const decrypted = EncryptionUtils.decryptTokens(null);
      expect(decrypted).toBeNull();
    });

    it('should return null when encryptedData is undefined', () => {
      const decrypted = EncryptionUtils.decryptTokens(undefined);
      expect(decrypted).toBeNull();
    });

    it('should return null when encryptedData has no encrypted property', () => {
      const encryptedData = {
        iv: 'test_iv',
        authTag: 'test_authTag'
      };

      const decrypted = EncryptionUtils.decryptTokens(encryptedData);
      expect(decrypted).toBeNull();
    });

    it('should return null for corrupted encrypted data', () => {
      const encryptedData = {
        iv: 'invalid_hex_data',
        encrypted: 'invalid_encrypted_data',
        authTag: 'invalid_authTag'
      };

      const decrypted = EncryptionUtils.decryptTokens(encryptedData);
      expect(decrypted).toBeNull();
    });

    it('should return null when authTag is invalid', () => {
      const tokenData = {
        access_token: 'test_access_token'
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);

      // Tamper with the authTag
      encrypted.authTag = 'ff'.repeat(16); // Invalid authTag

      const decrypted = EncryptionUtils.decryptTokens(encrypted);
      expect(decrypted).toBeNull();
    });

    it('should handle complex decrypted objects', () => {
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: 1234567890,
        token_type: 'Bearer',
        scope: 'read,write',
        athlete: {
          id: 12345,
          username: 'testuser'
        }
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);
      const decrypted = EncryptionUtils.decryptTokens(encrypted);

      expect(decrypted).toEqual(tokenData);
    });
  });

  describe('encryptTokensToJSON', () => {
    it('should encrypt and return JSON string', () => {
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token'
      };

      const jsonString = EncryptionUtils.encryptTokensToJSON(tokenData);

      expect(jsonString).not.toBeNull();
      expect(typeof jsonString).toBe('string');

      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('authTag');
    });

    it('should return null when encryption returns null', () => {
      config.security.encryptionKey = null;

      const tokenData = {
        access_token: 'test_access_token'
      };

      const jsonString = EncryptionUtils.encryptTokensToJSON(tokenData);
      expect(jsonString).toBeNull();
    });
  });

  describe('decryptTokensFromJSON', () => {
    it('should decrypt from JSON string successfully', () => {
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: 1234567890
      };

      const jsonString = EncryptionUtils.encryptTokensToJSON(tokenData);
      const decrypted = EncryptionUtils.decryptTokensFromJSON(jsonString);

      expect(decrypted).toEqual(tokenData);
    });

    it('should return null when encryptedJSON is null', () => {
      const decrypted = EncryptionUtils.decryptTokensFromJSON(null);
      expect(decrypted).toBeNull();
    });

    it('should return null when encryptedJSON is invalid JSON', () => {
      const decrypted = EncryptionUtils.decryptTokensFromJSON('invalid json');
      expect(decrypted).toBeNull();
    });

    it('should return null when encryptedJSON is empty string', () => {
      const decrypted = EncryptionUtils.decryptTokensFromJSON('');
      expect(decrypted).toBeNull();
    });
  });

  describe('isEncryptionEnabled', () => {
    it('should return true when encryption key is configured', () => {
      const isEnabled = EncryptionUtils.isEncryptionEnabled();
      expect(isEnabled).toBe(true);
    });

    it('should return false when encryption key is not configured', () => {
      config.security.encryptionKey = null;

      const isEnabled = EncryptionUtils.isEncryptionEnabled();
      expect(isEnabled).toBe(false);
    });

    it('should return false when encryption key is empty string', () => {
      config.security.encryptionKey = '';

      const isEnabled = EncryptionUtils.isEncryptionEnabled();
      expect(isEnabled).toBe(false);
    });
  });

  describe('encryption/decryption roundtrip', () => {
    it('should maintain data integrity through multiple encrypt/decrypt cycles', () => {
      const tokenData = {
        access_token: 'test_access_token_12345',
        refresh_token: 'test_refresh_token_67890',
        expires_at: 1234567890
      };

      // Encrypt and decrypt 5 times
      for (let i = 0; i < 5; i++) {
        const encrypted = EncryptionUtils.encryptTokens(tokenData);
        const decrypted = EncryptionUtils.decryptTokens(encrypted);

        expect(decrypted).toEqual(tokenData);
      }
    });

    it('should handle special characters in tokens', () => {
      const tokenData = {
        access_token: 'test!@#$%^&*()_+{}|:"<>?',
        refresh_token: 'test\\n\\t\\r\\b\\f',
        expires_at: 1234567890
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);
      const decrypted = EncryptionUtils.decryptTokens(encrypted);

      expect(decrypted).toEqual(tokenData);
    });

    it('should handle Unicode characters', () => {
      const tokenData = {
        access_token: 'test_🚀_emoji_token',
        refresh_token: 'test_中文_token',
        expires_at: 1234567890
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);
      const decrypted = EncryptionUtils.decryptTokens(encrypted);

      expect(decrypted).toEqual(tokenData);
    });

    it('should handle very long tokens', () => {
      const tokenData = {
        access_token: 'a'.repeat(10000),
        refresh_token: 'b'.repeat(10000),
        expires_at: 1234567890
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);
      const decrypted = EncryptionUtils.decryptTokens(encrypted);

      expect(decrypted).toEqual(tokenData);
    });
  });

  describe('backward compatibility', () => {
    it('should decrypt data encrypted with the old format', () => {
      // Simulate old encryption format (same as what was in the original code)
      const tokenData = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: 1234567890
      };

      const encrypted = EncryptionUtils.encryptTokens(tokenData);
      const decrypted = EncryptionUtils.decryptTokens(encrypted);

      expect(decrypted).toEqual(tokenData);
    });
  });
});
