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
  security: {
    encryptionKey: 'test-encryption-key-32-bytes!!'
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

    it('should return original data when no encryption key', () => {
      const originalKey = config.database.encryptionKey;
      config.database.encryptionKey = null;
      
      const testData = 'test-data';
      const encrypted = DatabaseManager.encryptData(testData);
      
      // When no encryption key, data is JSON stringified
      expect(encrypted).toBe(JSON.stringify(testData));
      
      config.database.encryptionKey = originalKey;
    });
  });

  describe('ensureInitialized', () => {
    it('should not reinitialize if already initialized', async () => {
      DatabaseManager.isInitialized = true;
      await DatabaseManager.ensureInitialized();
      // Should not call initialize again
      expect(DatabaseManager.isInitialized).toBe(true);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      const dbConnection = require('../../src/database/connection');
      await DatabaseManager.close();
      expect(dbConnection.close).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      // Mock the count queries
      const mockCountChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn()
          .mockResolvedValueOnce({ count: 5 })  // total members
          .mockResolvedValueOnce({ count: 3 })  // total races
          .mockResolvedValueOnce({ count: 2 })  // upcoming races
      };

      mockDb.select.mockReturnValue(mockCountChain);

      const stats = await DatabaseManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.members).toBeDefined();
      expect(stats.races).toBeDefined();
    });
  });

  describe('decryptMember', () => {
    it('should decrypt member data when tokens exist', () => {
      const encryptedMember = {
        athlete_id: 12345,
        discord_user_id: 'discord123',
        athlete: JSON.stringify({ id: 12345, firstname: 'John' }),
        is_active: 1,
        encrypted_tokens: JSON.stringify({ access: 'token' }),
        discord_username: 'user',
        discord_display_name: 'User Name'
      };

      const result = DatabaseManager.decryptMember(encryptedMember);

      expect(result).toBeDefined();
      expect(result.athleteId).toBe(12345);
      expect(result.discordUserId).toBe('discord123');
      expect(result.isActive).toBe(true);
      expect(result.tokens).toBeDefined();
    });

    it('should handle member without tokens', () => {
      const member = {
        athlete_id: 12345,
        discord_user_id: 'discord123',
        athlete: JSON.stringify({ id: 12345, firstname: 'John' }),
        is_active: 1
      };

      const result = DatabaseManager.decryptMember(member);

      expect(result).toBeDefined();
      expect(result.athleteId).toBe(12345);
      expect(result.discordUserId).toBe('discord123');
      expect(result.tokens).toBeNull();
    });
  });

  describe('encryptTokens and decryptTokens', () => {
    it('should encrypt and decrypt tokens with encryption key', () => {
      // Ensure encryption key is set - must be 32 bytes as hex (64 hex characters)
      const originalKey = config.security.encryptionKey;
      config.security.encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes

      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: 1234567890
      };

      const encrypted = DatabaseManager.encryptTokens(tokens);
      expect(encrypted).toBeInstanceOf(Buffer);

      const decrypted = DatabaseManager.decryptTokens(encrypted);
      expect(decrypted.accessToken).toBe(tokens.accessToken);
      expect(decrypted.refreshToken).toBe(tokens.refreshToken);
      expect(decrypted.expiresAt).toBe(tokens.expiresAt);

      config.security.encryptionKey = originalKey;
    });

    it('should handle tokens with no encryption key', () => {
      const originalKey = config.security.encryptionKey;
      config.security.encryptionKey = null;

      const tokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: 123
      };

      const encrypted = DatabaseManager.encryptTokens(tokens);
      expect(encrypted).toBeNull();

      config.security.encryptionKey = originalKey;
    });
  });

  describe('getMemberByDiscordId', () => {
    it('should return member when found', async () => {
      const mockMember = {
        athlete_id: 12345,
        discord_user_id: 'discord123',
        athlete: JSON.stringify({ id: 12345, firstname: 'John' }),
        is_active: 1
      };

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockMember)
      };

      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.getMemberByDiscordId('discord123');

      expect(result).toBeDefined();
      expect(result.athleteId).toBe(12345);
      expect(result.discordUserId).toBe('discord123');
    });

    it('should return null when member not found', async () => {
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(null)
      };

      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.getMemberByDiscordId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('reactivateMember', () => {
    it('should reactivate a member successfully', async () => {
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ athlete_id: 12345, is_active: 1 }])
      };

      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await DatabaseManager.reactivateMember(12345);

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return false when member not found', async () => {
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([])
      };

      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await DatabaseManager.reactivateMember(99999);

      expect(result).toBe(false);
    });
  });

  describe('addRace', () => {
    beforeEach(() => {
      // Skip initialization for these tests
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
    });

    it('should add a race for an active member', async () => {
      const mockMember = {
        athlete_id: 12345,
        is_active: 1
      };

      const mockRace = {
        id: 1,
        member_athlete_id: 12345,
        name: 'Boston Marathon',
        race_date: '2025-04-21',
        status: 'registered'
      };

      // Mock getMemberByAthleteId
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockMember)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      // Mock insert
      const mockInsertChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockRace])
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      const raceData = {
        name: 'Boston Marathon',
        raceDate: '2025-04-21',
        distance: '42.2km'
      };

      const result = await DatabaseManager.addRace(12345, raceData);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw error if member not found', async () => {
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(null)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const raceData = { name: 'Test Race', raceDate: '2025-04-21' };

      await expect(
        DatabaseManager.addRace(99999, raceData)
      ).rejects.toThrow('Member not found or inactive');
    });

    it('should throw error if member is inactive', async () => {
      const mockMember = {
        athlete_id: 12345,
        is_active: 0
      };

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockMember)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const raceData = { name: 'Test Race', raceDate: '2025-04-21' };

      await expect(
        DatabaseManager.addRace(12345, raceData)
      ).rejects.toThrow('Member not found or inactive');
    });
  });

  describe('updateRace', () => {
    beforeEach(() => {
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
    });

    it('should update a race successfully', async () => {
      const updates = { distance: '42.195km' };
      const updatedRace = { id: 1, distance: '42.195km' };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedRace])
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await DatabaseManager.updateRace(1, updates);

      expect(result).toBeDefined();
      expect(result.distance).toBe('42.195km');
    });

    it('should return null if race not found', async () => {
      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([])
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await DatabaseManager.updateRace(999, { distance: '10km' });

      expect(result).toBeNull();
    });
  });

  describe('removeRace', () => {
    beforeEach(() => {
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
    });

    it('should remove a race successfully', async () => {
      const mockRace = { id: 1, name: 'Test Race' };

      // Mock the select to get the race
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockRace)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      // Mock the delete
      const mockDeleteChain = {
        where: jest.fn().mockResolvedValue()
      };
      mockDb.delete.mockReturnValue(mockDeleteChain);

      const result = await DatabaseManager.removeRace(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should return null if race not found', async () => {
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(null)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.removeRace(999);

      expect(result).toBeNull();
    });
  });

  describe('getMemberRaces', () => {
    beforeEach(() => {
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
    });

    it('should return all races for a member', async () => {
      const mockRaces = [
        { id: 1, name: 'Race 1', race_date: '2025-04-21' },
        { id: 2, name: 'Race 2', race_date: '2025-05-15' }
      ];

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockRaces)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.getMemberRaces(12345);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should filter by status when provided', async () => {
      const mockRaces = [{ id: 1, status: 'registered' }];

      const mockWhereChain = jest.fn().mockReturnThis();
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: mockWhereChain,
        orderBy: jest.fn().mockResolvedValue(mockRaces)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.getMemberRaces(12345, { status: 'registered' });

      expect(result.length).toBe(1);
      expect(mockWhereChain).toHaveBeenCalled();
    });
  });

  describe('getUpcomingRaces', () => {
    beforeEach(() => {
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
    });

    it('should return upcoming races within days ahead', async () => {
      const mockRaces = [
        { id: 1, race_date: '2025-11-01', status: 'registered' }
      ];

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockRaces)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.getUpcomingRaces(30);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should use default 30 days if not specified', async () => {
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([])
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      await DatabaseManager.getUpcomingRaces();

      expect(mockSelectChain.from).toHaveBeenCalled();
    });
  });

  describe('getAllRaces', () => {
    beforeEach(() => {
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
    });

    it('should return all races ordered by date', async () => {
      const mockRaces = [
        { id: 1, race_date: '2025-12-01' },
        { id: 2, race_date: '2025-11-01' }
      ];

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockRaces)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.getAllRaces();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should filter by status when provided', async () => {
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([])
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      await DatabaseManager.getAllRaces({ status: 'completed' });

      expect(mockSelectChain.where).toHaveBeenCalled();
    });
  });

  describe('getRacesByDateRange', () => {
    beforeEach(() => {
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
    });

    it('should return races within date range', async () => {
      const mockRaces = [
        { id: 1, race_date: '2025-04-15' }
      ];

      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockRaces)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.getRacesByDateRange('2025-04-01', '2025-04-30');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by status when provided in options', async () => {
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([])
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      await DatabaseManager.getRacesByDateRange('2025-04-01', '2025-04-30', { status: 'registered' });

      expect(mockSelectChain.where).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    beforeEach(() => {
      DatabaseManager.isInitialized = true;
      DatabaseManager.db = mockDb;
      
      // Mock transaction to return a function that executes the callback
      mockDb.transaction = jest.fn((callback) => {
        return async () => await callback();
      });
    });

    it('should remove member with transaction', async () => {
      const mockDbMember = {
        athlete_id: 12345,
        discord_user_id: '999',
        athlete: JSON.stringify({ firstname: 'Test' }),
        is_active: false,
        encrypted_tokens: null,
        discord_username: undefined,
        discord_display_name: undefined,
        discord_discriminator: '0',
        discord_avatar: undefined,
        registered_at: undefined,
        updated_at: undefined
      };

      // Mock getMemberByAthleteId to return the decrypted format
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockDbMember)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      // Mock deletes for races and member
      const mockDeleteChain = {
        where: jest.fn().mockResolvedValue()
      };
      mockDb.delete.mockReturnValue(mockDeleteChain);

      const result = await DatabaseManager.removeMember(12345);

      // The result should be the decrypted member format
      expect(result).toEqual({
        discordUserId: '999',
        athlete: { firstname: 'Test' },
        athleteId: 12345,
        isActive: false,
        registeredAt: undefined,
        lastTokenRefresh: undefined,
        discordUser: {
          username: undefined,
          displayName: undefined,
          discriminator: '0',
          avatar: undefined
        },
        tokens: null
      });
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should return null if member not found', async () => {
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(null)
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      const result = await DatabaseManager.removeMember(99999);

      expect(result).toBe(null);
    });
  });

  describe('initializeSettings', () => {
    it('should initialize settings manager', async () => {
      DatabaseManager.db = mockDb;
      
      await DatabaseManager.initializeSettings();

      expect(DatabaseManager.settingsManager).toBeDefined();
    });
  });

  // Note: JSON migration methods (migrateFromJson, migrateSingleMember) are complex
  // and depend on file system operations. These are better tested with integration tests.
});
