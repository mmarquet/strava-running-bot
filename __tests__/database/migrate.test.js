// Mock config to prevent environment variable requirements
jest.mock('../../config/config', () => ({
  database: {
    file: ':memory:'
  },
  strava: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
  },
  discord: {
    token: 'test-token',
    channelId: 'test-channel'
  },
  webhook: {
    verifyToken: 'test-verify-token'
  },
  encryption: {
    key: 'test-encryption-key'
  },
  server: {
    port: 3000
  }
}));

const migrate = require('../../src/database/migrate');
const databaseManager = require('../../src/database/DatabaseManager');

// Mock dependencies
jest.mock('../../src/database/DatabaseManager');
jest.mock('../../src/utils/Logger', () => ({
  database: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

const logger = require('../../src/utils/Logger');

describe('migrate', () => {
  let mockDatabaseManager;
  let processExitSpy;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock database manager
    mockDatabaseManager = {
      initialize: jest.fn().mockResolvedValue()
    };
    
    databaseManager.initialize = mockDatabaseManager.initialize;

    // Spy on process.exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  describe('migrate function', () => {
    it('should complete migration successfully', async () => {
      await migrate();

      expect(logger.database.info).toHaveBeenCalledWith('Starting database migration...');
      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(logger.database.info).toHaveBeenCalledWith('Database migration completed successfully');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle migration errors', async () => {
      const error = new Error('Migration failed');
      mockDatabaseManager.initialize.mockRejectedValue(error);

      await migrate();

      expect(logger.database.error).toHaveBeenCalledWith('Database migration failed', error);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should initialize database manager', async () => {
      await migrate();

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
    });

    it('should log migration start and completion', async () => {
      await migrate();

      expect(logger.database.info).toHaveBeenCalledWith('Starting database migration...');
      expect(logger.database.info).toHaveBeenCalledWith('Database migration completed successfully');
    });
  });

  describe('error scenarios', () => {
    it('should exit with code 1 on failure', async () => {
      const error = new Error('Database connection failed');
      mockDatabaseManager.initialize.mockRejectedValue(error);

      await migrate();

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(logger.database.error).toHaveBeenCalledWith('Database migration failed', error);
    });

    it('should exit with code 0 on success', async () => {
      await migrate();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('module behavior', () => {
    it('should export the migrate function', () => {
      expect(migrate).toBeInstanceOf(Function);
    });

    it('should handle initialization errors gracefully', async () => {
      const initError = new Error('Initialization error');
      mockDatabaseManager.initialize.mockRejectedValue(initError);

      await migrate();

      expect(logger.database.error).toHaveBeenCalledWith('Database migration failed', initError);
    });
  });
});