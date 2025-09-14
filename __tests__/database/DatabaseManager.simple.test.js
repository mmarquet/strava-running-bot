const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Mock external dependencies but test the real DatabaseManager
jest.mock('../../src/utils/Logger', () => ({
  database: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  memberAction: jest.fn() // Add missing memberAction
}));

// Mock connection with a real database-like interface
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnValue(Promise.resolve([])), // Changed to return promise with array by default
  get: jest.fn(),
  all: jest.fn().mockReturnValue([]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  run: jest.fn().mockReturnValue({ changes: 1 })
};

jest.mock('../../src/database/connection', () => ({
  initialize: jest.fn().mockResolvedValue(mockDb),
  close: jest.fn().mockResolvedValue(),
  backup: jest.fn().mockResolvedValue(),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
}));

jest.mock('../../src/managers/SettingsManager');

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

const config = require('../../config/config');
const logger = require('../../src/utils/Logger');
const dbConnection = require('../../src/database/connection');
const SettingsManager = require('../../src/managers/SettingsManager');

// Import the real DatabaseManager to test
const DatabaseManager = require('../../src/database/DatabaseManager');

describe('DatabaseManager', () => {
  let testDataDir;
  let originalDbPath;
  let originalEncryptionKey;

  beforeEach(async () => {
    // Create temporary test directory
    testDataDir = path.join(os.tmpdir(), `db_test_${Date.now()}`);
    await fs.mkdir(testDataDir, { recursive: true });
    
    // Store and set test config
    originalDbPath = config.database?.path;
    originalEncryptionKey = config.database?.encryptionKey;
    
    config.database = {
      path: path.join(testDataDir, 'test.db'),
      encryptionKey: 'test-encryption-key-32-chars-long'
    };

    // Reset all mocks and state
    jest.clearAllMocks();
    dbConnection.initialize.mockResolvedValue(mockDb);
    
    // Reset DatabaseManager singleton state
    DatabaseManager.isInitialized = false;
    DatabaseManager.db = null;
    DatabaseManager.settingsManager = null;
  });

  afterEach(async () => {
    // Restore original config
    if (config.database) {
      config.database.path = originalDbPath;
      config.database.encryptionKey = originalEncryptionKey;
    }
    
    // Clean up test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const mockSettingsManager = { initialize: jest.fn() };
      SettingsManager.mockImplementation(() => mockSettingsManager);
      
      await DatabaseManager.initialize();
      
      expect(DatabaseManager.isInitialized).toBe(true);
      expect(DatabaseManager.db).toBeDefined();
      expect(dbConnection.initialize).toHaveBeenCalled();
      expect(logger.database.info).toHaveBeenCalledWith('DatabaseManager initialized successfully');
    });

    it('should not reinitialize if already initialized', async () => {
      const mockSettingsManager = { initialize: jest.fn() };
      SettingsManager.mockImplementation(() => mockSettingsManager);
      
      await DatabaseManager.initialize();
      const firstDb = DatabaseManager.db;
      
      await DatabaseManager.initialize();
      
      expect(DatabaseManager.db).toBe(firstDb);
      expect(dbConnection.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('member operations', () => {
    beforeEach(async () => {
      const mockSettingsManager = { initialize: jest.fn() };
      SettingsManager.mockImplementation(() => mockSettingsManager);
      
      // Mock the checkAndMigrateFromJson query that's called during initialize
      mockDb.get.mockResolvedValue(null); // No existing migration
      
      await DatabaseManager.initialize();
    });

    it('should register a new member successfully', async () => {
      const discordUserId = 'discord123';
      const athlete = { id: 12345, firstname: 'John', lastname: 'Doe' };
      const tokenData = { access_token: 'token', refresh_token: 'refresh' };
      
      const mockMember = {
        id: 1,
        athlete_id: parseInt(athlete.id),
        discord_id: discordUserId,
        athlete: JSON.stringify(athlete),
        is_active: 1,
        registeredAt: new Date()
      };
      
      // Mock the database operations for insert
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnThis()
      });
      
      // Mock getMemberByAthleteId calls - first returns null (no existing), then returns the new member
      mockDb.get
        .mockResolvedValueOnce(null) // getMemberByDiscordId - no existing
        .mockResolvedValueOnce(null) // getMemberByAthleteId - no existing  
        .mockResolvedValueOnce(mockMember); // getMemberByAthleteId - returns new member

      const result = await DatabaseManager.registerMember(discordUserId, athlete, tokenData);
      
      expect(result).toBeDefined();
      expect(result.athleteId).toBe(parseInt(athlete.id));
      expect(result.discordUserId).toBe(discordUserId);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should get member by athlete ID', async () => {
      const athleteId = 12345;
      const memberData = {
        id: 1,
        athlete_id: athleteId,
        athlete_firstname: 'John',
        athlete_lastname: 'Doe',
        discord_user_id: 'discord123',
        is_active: true
      };
      
      mockDb.get.mockResolvedValue(memberData);

      const result = await DatabaseManager.getMemberByAthleteId(athleteId);
      
      // The result goes through decryptMember which transforms the data
      expect(result).toBeDefined();
      expect(result.athleteId).toBe(athleteId);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should get all active members', async () => {
      const membersData = [
        { id: 1, athlete_id: 12345, is_active: true },
        { id: 2, athlete_id: 67890, is_active: true }
      ];
      
      // Mock the chained query - orderBy should return promise with data
      mockDb.orderBy.mockReturnValue(Promise.resolve(membersData));

      const result = await DatabaseManager.getAllMembers();
      
      // The result goes through decryptMember transformation, so expect an array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should update member tokens', async () => {
      const athleteId = 12345;
      const tokenData = { access_token: 'new_token', refresh_token: 'new_refresh' };
      
      // Mock returning some result to indicate success
      mockDb.returning.mockResolvedValue([{ athlete_id: athleteId }]);
      
      const result = await DatabaseManager.updateTokens(athleteId, tokenData);
      
      // updateTokens returns a boolean, not an object
      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should deactivate member', async () => {
      const athleteId = 12345;
      
      // Mock returning some result to indicate success
      mockDb.returning.mockResolvedValue([{ 
        athlete_id: athleteId, 
        updated_at: new Date() 
      }]);
      
      const result = await DatabaseManager.deactivateMember(athleteId);
      
      // deactivateMember returns a boolean, not an object
      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('statistics and utilities', () => {
    beforeEach(async () => {
      const mockSettingsManager = { initialize: jest.fn() };
      SettingsManager.mockImplementation(() => mockSettingsManager);
      
      // Mock the checkAndMigrateFromJson query that's called during initialize
      mockDb.get.mockResolvedValue(null); // No existing migration
      
      await DatabaseManager.initialize();
    });

    it('should return member statistics', async () => {
      // Each select() call creates a new chain, we need to mock each step
      const mockSelectChain1 = { from: jest.fn().mockResolvedValue([{ count: 10 }]) };
      const mockSelectChain2 = { from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ count: 8 }]) }) };
      const mockSelectChain3 = { from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ count: 2 }]) }) };
      const mockSelectChain4 = { from: jest.fn().mockResolvedValue([{ count: 5 }]) };
      const mockSelectChain5 = { from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ count: 2 }]) }) };

      mockDb.select
        .mockReturnValueOnce(mockSelectChain1)  // totalMembers
        .mockReturnValueOnce(mockSelectChain2)  // activeMembers 
        .mockReturnValueOnce(mockSelectChain3)  // inactiveMembers
        .mockReturnValueOnce(mockSelectChain4)  // totalRaces
        .mockReturnValueOnce(mockSelectChain5); // upcomingRaces

      const result = await DatabaseManager.getStats();
      
      expect(result).toEqual({
        members: {
          total: 10,
          active: 8,
          inactive: 2
        },
        races: {
          total: 5,
          upcoming: 2
        }
      });
    });

    it('should backup database', async () => {
      const backupPath = '/path/to/backup.db';
      
      await DatabaseManager.backup(backupPath);
      
      expect(dbConnection.backup).toHaveBeenCalledWith(backupPath);
    });

    it('should perform health check', async () => {
      const healthResult = { status: 'healthy' };
      dbConnection.healthCheck.mockResolvedValue(healthResult);
      
      const result = await DatabaseManager.healthCheck();
      
      expect(result).toEqual(healthResult);
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt data', () => {
      const testData = 'sensitive-data';
      
      const encrypted = DatabaseManager.encryptData(testData);
      const decrypted = DatabaseManager.decryptData(encrypted);
      
      expect(decrypted).toBe(testData);
    });
  });
});