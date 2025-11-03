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
  getMemberCount: jest.fn(),
  deactivateMember: jest.fn(),
  reactivateMember: jest.fn(),
  removeMember: jest.fn(),
  updateTokens: jest.fn(),
  getStats: jest.fn(),
  close: jest.fn(),
  backup: jest.fn(),
  healthCheck: jest.fn()
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

  describe('token decryption error handling', () => {
    it('should return null when token decryption fails', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord123',
        tokens: { encrypted: 'bad_data', iv: 'iv', authTag: 'tag' }
      };

      // Mock decryption to throw error
      jest.spyOn(memberManager, '_decryptTokenData').mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await memberManager._getTokensFromDatabase(member);

      expect(result).toBeNull();
    });
  });

  describe('_getTokensFromJsonFallback', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should successfully retrieve tokens from JSON fallback', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord123'
      };

      const mockJsonData = {
        members: [{
          discordUserId: 'discord123',
          tokens: { encrypted: 'data', iv: 'iv', authTag: 'tag' }
        }]
      };

      const fs = require('node:fs').promises;
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockJsonData));

      jest.spyOn(memberManager, '_decryptTokenData').mockReturnValue({
        access_token: 'fallback_token'
      });

      const result = await memberManager._getTokensFromJsonFallback(member);

      expect(result).toEqual({ access_token: 'fallback_token' });
    });

    it('should return null when member not found in JSON', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord999'
      };

      const mockJsonData = {
        members: [{
          discordUserId: 'discord123',
          tokens: { encrypted: 'data', iv: 'iv', authTag: 'tag' }
        }]
      };

      const fs = require('node:fs').promises;
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockJsonData));

      const result = await memberManager._getTokensFromJsonFallback(member);

      expect(result).toBeNull();
    });

    it('should return null when member has no tokens in JSON', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord123'
      };

      const mockJsonData = {
        members: [{
          discordUserId: 'discord123'
        }]
      };

      const fs = require('node:fs').promises;
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockJsonData));

      const result = await memberManager._getTokensFromJsonFallback(member);

      expect(result).toBeNull();
    });

    it('should handle JSON file read errors', async () => {
      const member = {
        athleteId: 12345,
        discordUserId: 'discord123'
      };

      const fs = require('node:fs').promises;
      fs.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

      const result = await memberManager._getTokensFromJsonFallback(member);

      expect(result).toBeNull();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await memberManager.initialize();
    });

    describe('getStats', () => {
      it('should return formatted statistics', async () => {
        mockDatabaseManager.getStats.mockResolvedValue({
          members: {
            total: 50,
            active: 45,
            inactive: 5
          }
        });

        const result = await memberManager.getStats();

        expect(result).toEqual({
          total: 50,
          active: 45,
          inactive: 5,
          recentRegistrations: 0
        });
        expect(mockDatabaseManager.getStats).toHaveBeenCalled();
      });

      it('should handle missing stats gracefully', async () => {
        mockDatabaseManager.getStats.mockResolvedValue({
          members: {}
        });

        const result = await memberManager.getStats();

        expect(result.total).toBe(0);
        expect(result.active).toBe(0);
        expect(result.inactive).toBe(0);
      });
    });

    describe('close', () => {
      it('should close database connection', async () => {
        mockDatabaseManager.close.mockResolvedValue(true);

        const result = await memberManager.close();

        expect(mockDatabaseManager.close).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe('backup', () => {
      it('should backup database to specified path', async () => {
        const backupPath = '/tmp/backup.db';
        mockDatabaseManager.backup.mockResolvedValue(true);

        const result = await memberManager.backup(backupPath);

        expect(mockDatabaseManager.backup).toHaveBeenCalledWith(backupPath);
        expect(result).toBe(true);
      });
    });

    describe('healthCheck', () => {
      it('should perform health check', async () => {
        const healthStatus = { status: 'healthy', uptime: 12345 };
        mockDatabaseManager.healthCheck.mockResolvedValue(healthStatus);

        const result = await memberManager.healthCheck();

        expect(mockDatabaseManager.healthCheck).toHaveBeenCalled();
        expect(result).toEqual(healthStatus);
      });
    });
  });

  describe('legacy support methods', () => {
    it('should resolve saveMembersAsync', async () => {
      await expect(memberManager.saveMembersAsync()).resolves.toBeUndefined();
    });

    it('should resolve saveMembers', async () => {
      await expect(memberManager.saveMembers()).resolves.toBeUndefined();
    });

    it('should initialize on loadMembers', async () => {
      mockDatabaseManager.initialize.mockResolvedValue(undefined);

      await memberManager.loadMembers();

      expect(mockDatabaseManager.initialize).toHaveBeenCalled();
    });
  });

  describe('map-like interface', () => {
    beforeEach(async () => {
      await memberManager.initialize();
    });

    describe('discordToStrava', () => {
      it('should get athlete ID from discord user ID', async () => {
        const mockMember = { athleteId: 12345, discordUserId: 'discord123' };
        mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);

        const result = await memberManager.discordToStrava.get('discord123');

        expect(result).toBe('12345');
      });

      it('should return undefined for non-existent discord user', async () => {
        mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(null);

        const result = await memberManager.discordToStrava.get('discord999');

        expect(result).toBeUndefined();
      });

      it('should check if discord user exists', async () => {
        const mockMember = { athleteId: 12345, discordUserId: 'discord123' };
        mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);

        const result = await memberManager.discordToStrava.has('discord123');

        expect(result).toBe(true);
      });

      it('should return false for non-existent discord user', async () => {
        mockDatabaseManager.getMemberByDiscordId.mockResolvedValue(null);

        const result = await memberManager.discordToStrava.has('discord999');

        expect(result).toBe(false);
      });

      it('should handle set as no-op', () => {
        expect(() => memberManager.discordToStrava.set()).not.toThrow();
      });

      it('should handle delete as no-op', () => {
        expect(() => memberManager.discordToStrava.delete()).not.toThrow();
      });
    });

    describe('members', () => {
      it('should get member by athlete ID', async () => {
        const mockMember = { athleteId: 12345, discordUserId: 'discord123' };
        mockDatabaseManager.getMemberByAthleteId.mockResolvedValue(mockMember);

        const result = await memberManager.members.get(12345);

        expect(result).toEqual(mockMember);
      });

      it('should check if member exists', async () => {
        const mockMember = { athleteId: 12345, discordUserId: 'discord123' };
        mockDatabaseManager.getMemberByAthleteId.mockResolvedValue(mockMember);

        const result = await memberManager.members.has(12345);

        expect(result).toBe(true);
      });

      it('should return false for non-existent member', async () => {
        mockDatabaseManager.getMemberByAthleteId.mockResolvedValue(null);

        const result = await memberManager.members.has(99999);

        expect(result).toBe(false);
      });

      it('should get all members via values', async () => {
        const mockMembers = [
          { athleteId: 12345, discordUserId: 'discord123' },
          { athleteId: 67890, discordUserId: 'discord456' }
        ];
        mockDatabaseManager.getAllMembers.mockResolvedValue(mockMembers);

        const result = await memberManager.members.values();

        expect(result).toEqual(mockMembers);
      });

      it('should get member count via size', async () => {
        const mockMembers = new Array(42).fill({ athleteId: 123, discordUserId: 'discord' });
        mockDatabaseManager.getAllMembers.mockResolvedValue(mockMembers);

        const result = await memberManager.members.size();

        expect(result).toBe(42);
      });

      it('should handle set as no-op', () => {
        expect(() => memberManager.members.set()).not.toThrow();
      });

      it('should handle delete as no-op', () => {
        expect(() => memberManager.members.delete()).not.toThrow();
      });
    });
  });

  describe('legacy helper methods', () => {
    it('should verify map consistency', () => {
      const result = memberManager.verifyMapConsistency();

      expect(result).toEqual({
        isConsistent: true,
        errors: [],
        memberCount: 0,
        mappingCount: 0
      });
    });

    it('should return member as-is for encryptMemberData', () => {
      const member = { athleteId: 12345, name: 'Test' };
      const result = memberManager.encryptMemberData(member);

      expect(result).toEqual(member);
    });

    it('should return member as-is for decryptMemberData', () => {
      const member = { athleteId: 12345, name: 'Test' };
      const result = memberManager.decryptMemberData(member);

      expect(result).toEqual(member);
    });
  });
});
