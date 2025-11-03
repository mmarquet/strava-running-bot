const DatabaseMemberManager = require('../../src/database/DatabaseMemberManager');

// Mock dependencies
jest.mock('../../src/database/DatabaseManager');
jest.mock('../../src/utils/Logger');
jest.mock('../../src/utils/EncryptionUtils');
jest.mock('../../config/config', () => ({
  security: {
    encryptionKey: 'test-encryption-key-32-characters'
  }
}));

const mockDatabaseManager = {
  initialize: jest.fn().mockResolvedValue(undefined),
  registerMember: jest.fn(),
  getMemberByAthleteId: jest.fn(),
  getMemberByDiscordId: jest.fn(),
  getAllMembers: jest.fn(),
  getAllMembersIncludingInactive: jest.fn(),
  getInactiveMembers: jest.fn(),
  deactivateMember: jest.fn(),
  reactivateMember: jest.fn(),
  removeMember: jest.fn(),
  updateTokens: jest.fn()
};

const logger = require('../../src/utils/Logger');
const EncryptionUtils = require('../../src/utils/EncryptionUtils');

describe('DatabaseMemberManager', () => {
  let memberManager;

  beforeEach(() => {
    jest.clearAllMocks();
    memberManager = new DatabaseMemberManager();
    memberManager.databaseManager = mockDatabaseManager;
  });

  describe('initialization', () => {
    it('should initialize database manager', async () => {
      await memberManager.initialize();

      expect(mockDatabaseManager.initialize).toHaveBeenCalledTimes(1);
      expect(memberManager.isInitialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await memberManager.initialize();
      await memberManager.initialize();

      expect(mockDatabaseManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerMember', () => {
    const mockAthlete = { id: 12345, username: 'test_athlete' };
    const mockTokenData = { access_token: 'token123', refresh_token: 'refresh123' };
    const mockDiscordUser = { id: 'discord123', username: 'testuser' };

    it('should register a new member', async () => {
      mockDatabaseManager.registerMember.mockResolvedValue({ athleteId: 12345 });

      const result = await memberManager.registerMember('discord123', mockAthlete, mockTokenData, mockDiscordUser);

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(mockDatabaseManager.registerMember).toHaveBeenCalledWith('discord123', mockAthlete, mockTokenData, mockDiscordUser);
      expect(result.athleteId).toBe(12345);
    });

    it('should register member without discord user data', async () => {
      mockDatabaseManager.registerMember.mockResolvedValue({ athleteId: 12345 });

      await memberManager.registerMember('discord123', mockAthlete, mockTokenData);

      expect(mockDatabaseManager.registerMember).toHaveBeenCalledWith('discord123', mockAthlete, mockTokenData, null);
    });
  });

  describe('getMemberByAthleteId', () => {
    it('should retrieve member by athlete ID', async () => {
      const mockMember = { athleteId: 12345, discordUserId: 'discord123' };
      mockDatabaseManager.getMemberByAthleteId.mockResolvedValue(mockMember);

      const result = await memberManager.getMemberByAthleteId(12345);

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(mockDatabaseManager.getMemberByAthleteId).toHaveBeenCalledWith(12345);
      expect(result).toEqual(mockMember);
    });

    it('should return null for non-existent member', async () => {
      mockDatabaseManager.getMemberByAthleteId.mockResolvedValue(null);

      const result = await memberManager.getMemberByAthleteId(99999);

      expect(result).toBeNull();
    });
  });

  describe('getMemberByDiscordId', () => {
    it('should retrieve member by Discord ID', async () => {
      const mockMember = { athleteId: 12345, discordUserId: 'discord123' };
      mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);

      const result = await memberManager.getMemberByDiscordId('discord123');

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(mockDatabaseManager.getMemberByDiscordId).toHaveBeenCalledWith('discord123');
      expect(result).toEqual(mockMember);
    });

    it('should return null for non-existent Discord ID', async () => {
      mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(null);

      const result = await memberManager.getMemberByDiscordId('unknown');

      expect(result).toBeNull();
    });
  });

  describe('getAllMembers', () => {
    it('should return all active members', async () => {
      const mockMembers = [
        { athleteId: 1, isActive: true },
        { athleteId: 2, isActive: true }
      ];
      mockDatabaseManager.getAllMembers.mockResolvedValue(mockMembers);

      const result = await memberManager.getAllMembers();

      expect(mockDatabaseManager.getAllMembers).toHaveBeenCalled();
      expect(result).toEqual(mockMembers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no members', async () => {
      mockDatabaseManager.getAllMembers.mockResolvedValue([]);

      const result = await memberManager.getAllMembers();

      expect(result).toEqual([]);
    });
  });

  describe('getAllMembersIncludingInactive', () => {
    it('should return all members including inactive', async () => {
      const mockMembers = [
        { athleteId: 1, isActive: true },
        { athleteId: 2, isActive: false }
      ];
      mockDatabaseManager.getAllMembersIncludingInactive.mockResolvedValue(mockMembers);

      const result = await memberManager.getAllMembersIncludingInactive();

      expect(mockDatabaseManager.getAllMembersIncludingInactive).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('getInactiveMembers', () => {
    it('should return only inactive members', async () => {
      const mockInactiveMembers = [
        { athleteId: 2, isActive: false },
        { athleteId: 3, isActive: false }
      ];
      mockDatabaseManager.getInactiveMembers.mockResolvedValue(mockInactiveMembers);

      const result = await memberManager.getInactiveMembers();

      expect(mockDatabaseManager.getInactiveMembers).toHaveBeenCalled();
      expect(result).toEqual(mockInactiveMembers);
    });
  });

  describe('getMemberCount', () => {
    it('should return count of active members', async () => {
      const mockMembers = [{ athleteId: 1 }, { athleteId: 2 }, { athleteId: 3 }];
      mockDatabaseManager.getAllMembers.mockResolvedValue(mockMembers);

      const result = await memberManager.getMemberCount();

      expect(result).toBe(3);
    });

    it('should return 0 when no members', async () => {
      mockDatabaseManager.getAllMembers.mockResolvedValue([]);

      const result = await memberManager.getMemberCount();

      expect(result).toBe(0);
    });
  });

  describe('deactivateMember', () => {
    it('should deactivate a member', async () => {
      mockDatabaseManager.deactivateMember.mockResolvedValue(true);

      const result = await memberManager.deactivateMember(12345);

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(mockDatabaseManager.deactivateMember).toHaveBeenCalledWith(12345);
      expect(result).toBe(true);
    });

    it('should return false for non-existent member', async () => {
      mockDatabaseManager.deactivateMember.mockResolvedValue(false);

      const result = await memberManager.deactivateMember(99999);

      expect(result).toBe(false);
    });
  });

  describe('reactivateMember', () => {
    it('should reactivate a member', async () => {
      mockDatabaseManager.reactivateMember.mockResolvedValue(true);

      const result = await memberManager.reactivateMember(12345);

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(mockDatabaseManager.reactivateMember).toHaveBeenCalledWith(12345);
      expect(result).toBe(true);
    });

    it('should return false for non-existent member', async () => {
      mockDatabaseManager.reactivateMember.mockResolvedValue(false);

      const result = await memberManager.reactivateMember(99999);

      expect(result).toBe(false);
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      mockDatabaseManager.removeMember.mockResolvedValue(true);

      const result = await memberManager.removeMember(12345);

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(mockDatabaseManager.removeMember).toHaveBeenCalledWith(12345);
      expect(result).toBe(true);
    });

    it('should return null for non-existent member', async () => {
      mockDatabaseManager.removeMember.mockResolvedValue(null);

      const result = await memberManager.removeMember(99999);

      expect(result).toBeNull();
    });
  });

  describe('removeMemberByDiscordId', () => {
    it('should remove member by Discord ID', async () => {
      const mockMember = { athleteId: 12345, discordUserId: 'discord123' };
      mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      mockDatabaseManager.removeMember.mockResolvedValue(true);

      const result = await memberManager.removeMemberByDiscordId('discord123');

      expect(mockDatabaseManager.getMemberByDiscordId).toHaveBeenCalledWith('discord123');
      expect(mockDatabaseManager.removeMember).toHaveBeenCalledWith(12345);
      expect(result).toBe(true);
    });

    it('should return null when Discord ID not found', async () => {
      mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(null);

      const result = await memberManager.removeMemberByDiscordId('unknown');

      expect(result).toBeNull();
      expect(mockDatabaseManager.removeMember).not.toHaveBeenCalled();
    });
  });

  describe('updateTokens', () => {
    it('should update member tokens', async () => {
      const mockTokenData = { access_token: 'new_token', refresh_token: 'new_refresh' };
      mockDatabaseManager.updateTokens.mockResolvedValue(true);

      const result = await memberManager.updateTokens(12345, mockTokenData);

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
      expect(mockDatabaseManager.updateTokens).toHaveBeenCalledWith(12345, mockTokenData);
      expect(result).toBe(true);
    });
  });

  describe('_decryptTokenData', () => {
    it('should decrypt token data successfully', () => {
      const mockEncrypted = { encrypted: 'encrypted_data', iv: 'iv_data', authTag: 'tag' };
      const mockDecrypted = { access_token: 'token123', refresh_token: 'refresh123', expires_at: Date.now() / 1000 + 3600 };

      EncryptionUtils.decryptTokens.mockReturnValue(mockDecrypted);

      const result = memberManager._decryptTokenData(mockEncrypted, 12345);

      expect(EncryptionUtils.decryptTokens).toHaveBeenCalledWith(mockEncrypted);
      expect(result).toEqual(mockDecrypted);
    });

    it('should return null when no encryption key configured', () => {
      // Temporarily remove encryption key
      const config = require('../../config/config');
      const originalKey = config.security.encryptionKey;
      config.security.encryptionKey = null;

      const result = memberManager._decryptTokenData({ encrypted: 'data' }, 12345);

      expect(result).toBeNull();
      expect(logger.database.warn).toHaveBeenCalled();

      // Restore
      config.security.encryptionKey = originalKey;
    });
  });

  describe('_getTokensFromDatabase', () => {
    it('should return null when member has no tokens', async () => {
      const member = { athleteId: 12345, tokens: null };

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBeNull();
    });

    it('should return null when tokens not encrypted', async () => {
      const member = { athleteId: 12345, tokens: {} };

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBeNull();
    });

    it('should return valid access token when not expired', async () => {
      const futureExpiry = Date.now() / 1000 + 3600; // 1 hour from now
      const member = {
        athleteId: 12345,
        tokens: { encrypted: 'data', iv: 'iv', authTag: 'tag' }
      };
      const mockDecrypted = {
        access_token: 'valid_token',
        refresh_token: 'refresh',
        expires_at: futureExpiry
      };

      EncryptionUtils.decryptTokens.mockReturnValue(mockDecrypted);

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBe('valid_token');
      expect(logger.database.info).toHaveBeenCalledWith(
        'Successfully retrieved valid access token from database',
        expect.any(Object)
      );
    });

    it('should return null when decryption returns null', async () => {
      const member = {
        athleteId: 12345,
        tokens: { encrypted: 'data' }
      };

      EncryptionUtils.decryptTokens.mockReturnValue(null);

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBeNull();
    });

    it('should auto-refresh expired token', async () => {
      const pastExpiry = Date.now() / 1000 - 3600; // Expired 1 hour ago
      const member = {
        athleteId: 12345,
        tokens: { encrypted: 'data', iv: 'iv', authTag: 'tag' }
      };
      const mockExpiredToken = {
        access_token: 'expired_token',
        refresh_token: 'refresh123',
        expires_at: pastExpiry
      };
      const mockNewTokens = {
        access_token: 'new_token',
        refresh_token: 'new_refresh',
        expires_at: Date.now() / 1000 + 3600
      };

      EncryptionUtils.decryptTokens.mockReturnValue(mockExpiredToken);

      // Mock Strava API
      const mockStravaAPI = {
        refreshAccessToken: jest.fn().mockResolvedValue(mockNewTokens)
      };
      jest.doMock('../../src/strava/api', () => {
        return jest.fn(() => mockStravaAPI);
      });

      mockDatabaseManager.updateTokens.mockResolvedValue(true);

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBe('new_token');
      expect(mockDatabaseManager.updateTokens).toHaveBeenCalledWith(12345, mockNewTokens);
    });

    it('should return null when token expired and no refresh token', async () => {
      const pastExpiry = Date.now() / 1000 - 3600;
      const member = {
        athleteId: 12345,
        tokens: { encrypted: 'data' }
      };
      const mockExpiredToken = {
        access_token: 'expired',
        expires_at: pastExpiry
        // No refresh_token
      };

      EncryptionUtils.decryptTokens.mockReturnValue(mockExpiredToken);

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBeNull();
      expect(logger.database.warn).toHaveBeenCalled();
    });

    it('should handle decryption errors gracefully', async () => {
      const member = {
        athleteId: 12345,
        tokens: { encrypted: 'bad_data' }
      };

      EncryptionUtils.decryptTokens.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBeNull();
      expect(logger.database.error).toHaveBeenCalledWith(
        'Could not decrypt tokens from database',
        expect.any(Object)
      );
    });
  });

  describe('getValidAccessToken', () => {
    it('should return token from database when available', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord123',
        tokens: { encrypted: 'data', iv: 'iv', authTag: 'tag' }
      };
      const mockToken = {
        access_token: 'db_token',
        expires_at: Date.now() / 1000 + 3600
      };

      EncryptionUtils.decryptTokens.mockReturnValue(mockToken);

      const result = await memberManager.getValidAccessToken(member);

      expect(result).toBe('db_token');
    });

    it('should try JSON fallback when database token fails', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord123',
        tokens: null
      };

      // Mock file system for JSON fallback
      jest.spyOn(memberManager, '_getTokensFromJsonFallback').mockResolvedValue('json_token');

      const result = await memberManager.getValidAccessToken(member);

      expect(result).toBe('json_token');
      expect(logger.database.info).toHaveBeenCalledWith(
        'No valid tokens in database, trying JSON fallback',
        expect.any(Object)
      );
    });

    it('should return null when both database and JSON fail', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord123',
        tokens: null
      };

      jest.spyOn(memberManager, '_getTokensFromJsonFallback').mockResolvedValue(null);

      const result = await memberManager.getValidAccessToken(member);

      expect(result).toBeNull();
    });
  });
});
