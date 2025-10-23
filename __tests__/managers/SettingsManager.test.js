const SettingsManager = require('../../src/managers/SettingsManager');

// Mock dependencies
jest.mock('../../src/utils/Logger', () => ({
  database: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('SettingsManager', () => {
  let settingsManager;
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock database
    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          }),
          orderBy: jest.fn().mockResolvedValue([])
        })
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockResolvedValue()
        })
      }),
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({ changes: 1 })
      })
    };

    settingsManager = new SettingsManager(mockDb);
  });

  describe('constructor', () => {
    it('should create instance with database', () => {
      expect(settingsManager.db).toBe(mockDb);
    });
  });

  describe('getSetting', () => {
    it('should return setting value when found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ value: 'test-value' }])
          })
        })
      });

      const result = await settingsManager.getSetting('test-key');
      expect(result).toBe('test-value');
    });

    it('should return default value when not found', async () => {
      const result = await settingsManager.getSetting('missing-key', 'default');
      expect(result).toBe('default');
    });

    it('should handle errors and return default value', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('DB error'))
          })
        })
      });

      const result = await settingsManager.getSetting('test-key', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should return null when no default provided and not found', async () => {
      const result = await settingsManager.getSetting('missing-key');
      expect(result).toBeNull();
    });
  });

  describe('setSetting', () => {
    it('should set new setting successfully', async () => {
      const result = await settingsManager.setSetting('key', 'value', 'desc');
      expect(result).toBe(true);
    });

    it('should update existing setting with new description', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ key: 'key', value: 'old', description: 'old desc' }])
          })
        })
      });

      const result = await settingsManager.setSetting('key', 'new-value', 'new desc');
      expect(result).toBe(true);
    });

    it('should preserve existing description if not provided', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ key: 'key', value: 'old', description: 'keep this' }])
          })
        })
      });

      const result = await settingsManager.setSetting('key', 'new-value');
      expect(result).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should hide sensitive values in logs', async () => {
      const result = await settingsManager.setSetting('secret_token', 'sensitive-value', 'Secret');
      expect(result).toBe(true);
    });

    it('should handle errors and return false', async () => {
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockRejectedValue(new Error('DB error'))
        })
      });

      const result = await settingsManager.setSetting('key', 'value');
      expect(result).toBe(false);
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings as object', async () => {
      const mockSettings = [
        { key: 'key1', value: 'value1', description: 'desc1', updated_at: '2023-01-01' }
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(mockSettings)
        })
      });

      const result = await settingsManager.getAllSettings();
      expect(result).toEqual({
        key1: { value: 'value1', description: 'desc1', updatedAt: '2023-01-01' }
      });
    });

    it('should return empty object when no settings', async () => {
      const result = await settingsManager.getAllSettings();
      expect(result).toEqual({});
    });

    it('should handle errors and return empty object', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockRejectedValue(new Error('DB error'))
        })
      });

      const result = await settingsManager.getAllSettings();
      expect(result).toEqual({});
    });
  });

  describe('deleteSetting', () => {
    it('should delete setting successfully', async () => {
      const result = await settingsManager.deleteSetting('test-key');
      expect(result).toBe(true);
    });

    it('should return false when setting does not exist', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ changes: 0 })
      });

      const result = await settingsManager.deleteSetting('missing-key');
      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockRejectedValue(new Error('DB error'))
      });

      const result = await settingsManager.deleteSetting('test-key');
      expect(result).toBe(false);
    });
  });

  describe('getDiscordChannelId', () => {
    it('should return channel ID from database', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ value: 'channel-123' }])
          })
        })
      });

      const result = await settingsManager.getDiscordChannelId();
      expect(result).toBe('channel-123');
    });

    it('should fallback to environment variable when not in database', async () => {
      process.env.DISCORD_CHANNEL_ID = 'env-channel-456';
      
      const result = await settingsManager.getDiscordChannelId();
      expect(result).toBe('env-channel-456');
      
      delete process.env.DISCORD_CHANNEL_ID;
    });

    it('should return null when not found anywhere', async () => {
      delete process.env.DISCORD_CHANNEL_ID;
      
      const result = await settingsManager.getDiscordChannelId();
      expect(result).toBeNull();
    });
  });

  describe('setDiscordChannelId', () => {
    it('should set Discord channel ID with description', async () => {
      const result = await settingsManager.setDiscordChannelId('new-channel-789');
      expect(result).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
