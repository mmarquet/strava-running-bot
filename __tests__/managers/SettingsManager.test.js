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
  });

  describe('setSetting', () => {
    it('should set new setting successfully', async () => {
      const result = await settingsManager.setSetting('key', 'value', 'desc');
      expect(result).toBe(true);
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
  });

  describe('deleteSetting', () => {
    it('should delete setting successfully', async () => {
      const result = await settingsManager.deleteSetting('test-key');
      expect(result).toBe(true);
    });
  });
});
