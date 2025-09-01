const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const MemberManager = require('../../src/managers/MemberManager');
const StravaAPI = require('../../src/strava/api');
const config = require('../../config/config');
const logger = require('../../src/utils/Logger');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

jest.mock('../../src/strava/api');
jest.mock('../../config/config', () => ({
  security: {
    encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  }
}));
jest.mock('../../src/utils/Logger', () => ({
  member: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  },
  memberAction: jest.fn()
}));

describe('MemberManager', () => {
  let memberManager;
  let mockStravaAPI;

  const mockMember = {
    discordUserId: '123456789',
    discordUser: {
      username: 'testuser',
      displayName: 'Test User',
      discriminator: '1234',
      avatar: 'avatar_hash',
      avatarURL: 'https://cdn.discordapp.com/avatars/123456789/avatar_hash.png'
    },
    athlete: {
      id: 12345,
      firstname: 'John',
      lastname: 'Doe',
      profile: 'https://example.com/profile.jpg',
      profile_medium: 'https://example.com/profile_medium.jpg',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      sex: 'M',
      premium: true,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    tokens: {
      access_token: 'test_access_token',
      refresh_token: 'test_refresh_token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'Bearer'
    },
    registeredAt: '2024-01-01T00:00:00Z',
    lastTokenRefresh: '2024-01-01T00:00:00Z',
    isActive: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    memberManager = new MemberManager();
    mockStravaAPI = new StravaAPI();
    memberManager.stravaAPI = mockStravaAPI;

    // Mock successful file operations by default
    fs.access.mockResolvedValue();
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
  });

  describe('constructor', () => {
    it('should initialize with empty maps and correct data file path', () => {
      const manager = new MemberManager();
      
      expect(manager.members).toBeInstanceOf(Map);
      expect(manager.discordToStrava).toBeInstanceOf(Map);
      expect(manager.members.size).toBe(0);
      expect(manager.discordToStrava.size).toBe(0);
      expect(manager.dataFile).toMatch(/data\/members\.json$/);
      expect(manager.stravaAPI).toBeInstanceOf(StravaAPI);
    });
  });

  describe('loadMembers', () => {
    it('should load and decrypt members from file', async () => {
      const encryptedMember = memberManager.encryptMemberData(mockMember);
      const fileData = {
        version: '1.0',
        savedAt: '2024-01-01T00:00:00Z',
        members: [encryptedMember]
      };

      fs.readFile.mockResolvedValue(JSON.stringify(fileData));

      await memberManager.loadMembers();

      expect(fs.readFile).toHaveBeenCalledWith(memberManager.dataFile, 'utf8');
      expect(memberManager.members.size).toBe(1);
      expect(memberManager.discordToStrava.size).toBe(1);
      expect(memberManager.members.get('12345')).toMatchObject({
        discordUserId: mockMember.discordUserId,
        athlete: expect.objectContaining({ id: 12345 })
      });
      expect(logger.member.info).toHaveBeenCalledWith('Members loaded from storage', {
        count: 1,
        memberIds: ['12345'],
        discordMappings: 1,
        inconsistenciesFixed: 0
      });
    });

    it('should handle missing file gracefully', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);
      
      // Spy on the ensureDataDirectory method
      jest.spyOn(memberManager, 'ensureDataDirectory').mockResolvedValue();

      await memberManager.loadMembers();

      expect(logger.member.info).toHaveBeenCalledWith('No existing member data found, starting fresh');
      expect(memberManager.ensureDataDirectory).toHaveBeenCalled();
      expect(memberManager.members.size).toBe(0);
    });

    it('should handle file read errors', async () => {
      const error = new Error('Permission denied');
      fs.readFile.mockRejectedValue(error);

      await expect(memberManager.loadMembers()).rejects.toThrow('Permission denied');

      expect(logger.member.error).toHaveBeenCalledWith('Error loading members', error);
    });

    it('should handle corrupt JSON data', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      await expect(memberManager.loadMembers()).rejects.toThrow();

      expect(logger.member.error).toHaveBeenCalled();
    });
  });

  describe('saveMembers', () => {
    beforeEach(() => {
      memberManager.members.set('12345', mockMember);
    });

    it('should encrypt and save members to file', async () => {
      // Mock the methods that are called
      jest.spyOn(memberManager, 'ensureDataDirectory').mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      
      await memberManager.saveMembers();

      expect(memberManager.ensureDataDirectory).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        memberManager.dataFile,
        expect.stringContaining('"version": "1.0"')
      );

      const writeCall = fs.writeFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      
      expect(savedData.version).toBe('1.0');
      expect(savedData.members).toHaveLength(1);
      expect(savedData.members[0].tokens.encrypted).toBeDefined();
      expect(logger.member.debug).toHaveBeenCalledWith('Members saved to storage', {
        count: 1,
        filePath: memberManager.dataFile
      });
    });

    it('should handle file write errors', async () => {
      const error = new Error('Disk full');
      fs.writeFile.mockRejectedValue(error);

      await memberManager.saveMembers();

      expect(logger.member.error).toHaveBeenCalledWith('Error saving members', error);
    });
  });

  describe('saveMembersAsync', () => {
    beforeEach(() => {
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should save members asynchronously without blocking', async () => {
      memberManager.saveMembersAsync();
      
      expect(memberManager.saveMembers).not.toHaveBeenCalled();
      
      jest.runOnlyPendingTimers();
      await Promise.resolve(); // Allow async operations to complete
      
      expect(memberManager.saveMembers).toHaveBeenCalled();
    });

    it('should handle async save errors gracefully', async () => {
      const error = new Error('Save failed');
      jest.spyOn(memberManager, 'saveMembers').mockRejectedValue(error);

      memberManager.saveMembersAsync();
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect(logger.member.error).toHaveBeenCalledWith('Error in async save', error);
    });
  });

  describe('ensureDataDirectory', () => {
    it('should not create directory if it exists', async () => {
      fs.access.mockResolvedValue();

      await memberManager.ensureDataDirectory();

      expect(fs.access).toHaveBeenCalled();
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      fs.access.mockRejectedValue(new Error('Directory not found'));

      await memberManager.ensureDataDirectory();

      expect(fs.access).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(/data$/),
        { recursive: true }
      );
    });
  });

  describe('registerMember', () => {
    beforeEach(() => {
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();
    });

    it('should register new member successfully', async () => {
      const result = await memberManager.registerMember(
        mockMember.discordUserId,
        mockMember.athlete,
        mockMember.tokens,
        mockMember.discordUser
      );

      expect(memberManager.members.size).toBe(1);
      expect(memberManager.discordToStrava.size).toBe(1);
      expect(memberManager.members.get('12345')).toMatchObject({
        discordUserId: mockMember.discordUserId,
        athlete: expect.objectContaining(mockMember.athlete),
        tokens: expect.objectContaining(mockMember.tokens),
        isActive: true
      });
      expect(result.registeredAt).toBeDefined();
      expect(memberManager.saveMembers).toHaveBeenCalled();
      expect(logger.memberAction).toHaveBeenCalledWith(
        'REGISTERED',
        'John Doe',
        mockMember.discordUserId,
        '12345',
        expect.any(Object)
      );
    });

    it('should register member without Discord user data', async () => {
      await memberManager.registerMember(
        mockMember.discordUserId,
        mockMember.athlete,
        mockMember.tokens,
        null
      );

      const member = memberManager.members.get('12345');
      expect(member.discordUser).toBeNull();
      expect(member.discordUserId).toBe(mockMember.discordUserId);
    });
  });

  describe('getMemberByAthleteId', () => {
    beforeEach(() => {
      memberManager.members.set('12345', mockMember);
    });

    it('should return member by athlete ID', async () => {
      const member = await memberManager.getMemberByAthleteId(12345);
      expect(member).toEqual(mockMember);
    });

    it('should handle string athlete ID', async () => {
      const member = await memberManager.getMemberByAthleteId('12345');
      expect(member).toEqual(mockMember);
    });

    it('should return undefined for non-existent member', async () => {
      const member = await memberManager.getMemberByAthleteId(99999);
      expect(member).toBeUndefined();
    });
  });

  describe('getMemberByDiscordId', () => {
    beforeEach(() => {
      memberManager.members.set('12345', mockMember);
      memberManager.discordToStrava.set(mockMember.discordUserId, '12345');
    });

    it('should return member by Discord ID', async () => {
      const member = await memberManager.getMemberByDiscordId(mockMember.discordUserId);
      expect(member).toEqual(mockMember);
    });

    it('should return null for non-existent Discord ID', async () => {
      const member = await memberManager.getMemberByDiscordId('999999999');
      expect(member).toBeNull();
    });
  });

  describe('getAllMembers', () => {
    beforeEach(() => {
      const activeMember = { ...mockMember, isActive: true };
      const inactiveMember = { ...mockMember, athlete: { ...mockMember.athlete, id: 67890 }, isActive: false };
      
      memberManager.members.set('12345', activeMember);
      memberManager.members.set('67890', inactiveMember);
    });

    it('should return only active members', async () => {
      const members = await memberManager.getAllMembers();
      
      expect(members).toHaveLength(1);
      expect(members[0].isActive).toBe(true);
      expect(members[0].athlete.id).toBe(12345);
    });
  });

  describe('getMemberCount', () => {
    beforeEach(() => {
      const activeMember1 = { ...mockMember, isActive: true };
      const activeMember2 = { ...mockMember, athlete: { ...mockMember.athlete, id: 67890 }, isActive: true };
      const inactiveMember = { ...mockMember, athlete: { ...mockMember.athlete, id: 11111 }, isActive: false };
      
      memberManager.members.set('12345', activeMember1);
      memberManager.members.set('67890', activeMember2);
      memberManager.members.set('11111', inactiveMember);
    });

    it('should return count of active members only', () => {
      expect(memberManager.getMemberCount()).toBe(2);
    });
  });

  describe('getValidAccessToken', () => {
    beforeEach(() => {
      jest.spyOn(memberManager, 'refreshMemberToken').mockResolvedValue('new_access_token');
    });

    it('should return existing token if still valid', async () => {
      const validMember = {
        ...mockMember,
        tokens: {
          ...mockMember.tokens,
          expires_at: Math.floor(Date.now() / 1000) + 7200 // Valid for 2 hours
        }
      };

      const token = await memberManager.getValidAccessToken(validMember);
      
      expect(token).toBe(validMember.tokens.access_token);
      expect(memberManager.refreshMemberToken).not.toHaveBeenCalled();
    });

    it('should refresh token if expired', async () => {
      const expiredMember = {
        ...mockMember,
        tokens: {
          ...mockMember.tokens,
          expires_at: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        }
      };

      const token = await memberManager.getValidAccessToken(expiredMember);
      
      expect(memberManager.refreshMemberToken).toHaveBeenCalledWith(expiredMember);
      expect(token).toBe('new_access_token');
    });

    it('should refresh token if expiring soon', async () => {
      const expiringMember = {
        ...mockMember,
        tokens: {
          ...mockMember.tokens,
          expires_at: Math.floor(Date.now() / 1000) + 1800 // Expires in 30 minutes
        }
      };

      const token = await memberManager.getValidAccessToken(expiringMember);
      
      expect(memberManager.refreshMemberToken).toHaveBeenCalledWith(expiringMember);
      expect(token).toBe('new_access_token');
    });
  });

  describe('refreshMemberToken', () => {
    beforeEach(() => {
      memberManager.members.set('12345', mockMember);
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();
    });

    it('should refresh token successfully', async () => {
      // Ensure the mock member has the expected refresh token
      mockMember.tokens.refresh_token = 'test_refresh_token';
      
      const newTokenData = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 7200,
        expires_in: 7200,
        token_type: 'Bearer'
      };

      mockStravaAPI.refreshAccessToken.mockResolvedValue(newTokenData);

      const token = await memberManager.refreshMemberToken(mockMember);

      expect(mockStravaAPI.refreshAccessToken).toHaveBeenCalledWith('test_refresh_token');
      expect(token).toBe(newTokenData.access_token);
      expect(mockMember.tokens).toEqual(newTokenData);
      expect(mockMember.lastTokenRefresh).toBeDefined();
      expect(memberManager.saveMembers).toHaveBeenCalled();
      expect(logger.memberAction).toHaveBeenCalledWith(
        'TOKEN_REFRESHED',
        'Test User',
        mockMember.discordUserId,
        12345,
        expect.any(Object)
      );
    });

    it('should handle refresh failure and deactivate member', async () => {
      const refreshError = new Error('Invalid refresh token');
      mockStravaAPI.refreshAccessToken.mockRejectedValue(refreshError);

      const token = await memberManager.refreshMemberToken(mockMember);

      expect(token).toBeNull();
      expect(mockMember.isActive).toBe(false);
      expect(mockMember.tokenError).toEqual({
        message: refreshError.message,
        timestamp: expect.any(String)
      });
      expect(memberManager.saveMembers).toHaveBeenCalled();
      expect(logger.memberAction).toHaveBeenCalledWith(
        'TOKEN_FAILED',
        'Test User',
        mockMember.discordUserId,
        12345,
        expect.any(Object)
      );
    });
  });

  describe('removeMember', () => {
    beforeEach(() => {
      memberManager.members.set('12345', mockMember);
      memberManager.discordToStrava.set(mockMember.discordUserId, '12345');
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();
    });

    it('should remove member completely', async () => {
      const removedMember = await memberManager.removeMember(12345);

      expect(removedMember).toEqual(mockMember);
      expect(memberManager.members.has('12345')).toBe(false);
      expect(memberManager.discordToStrava.has(mockMember.discordUserId)).toBe(false);
      expect(memberManager.saveMembers).toHaveBeenCalled();
      expect(logger.memberAction).toHaveBeenCalledWith(
        'REMOVED',
        'Test User',
        mockMember.discordUserId,
        12345,
        expect.any(Object)
      );
    });

    it('should handle non-existent member', async () => {
      const result = await memberManager.removeMember(99999);
      expect(result).toBeNull();
    });
  });

  describe('removeMemberByDiscordId', () => {
    beforeEach(() => {
      memberManager.members.set('12345', mockMember);
      memberManager.discordToStrava.set(mockMember.discordUserId, '12345');
      jest.spyOn(memberManager, 'removeMember').mockResolvedValue(mockMember);
    });

    it('should remove member by Discord ID', async () => {
      const result = await memberManager.removeMemberByDiscordId(mockMember.discordUserId);

      expect(memberManager.removeMember).toHaveBeenCalledWith('12345');
      expect(result).toEqual(mockMember);
    });

    it('should handle non-existent Discord ID', async () => {
      const result = await memberManager.removeMemberByDiscordId('999999999');
      expect(result).toBeNull();
    });
  });

  describe('deactivateMember', () => {
    beforeEach(() => {
      memberManager.members.set('12345', mockMember);
      memberManager.discordToStrava.set(mockMember.discordUserId, '12345');
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();
    });

    it('should deactivate member successfully', async () => {
      const result = await memberManager.deactivateMember(12345);

      expect(result).toBe(true);
      expect(mockMember.isActive).toBe(false);
      expect(mockMember.deactivatedAt).toBeDefined();
      expect(memberManager.discordToStrava.has(mockMember.discordUserId)).toBe(false);
      expect(memberManager.saveMembers).toHaveBeenCalled();
      expect(logger.memberAction).toHaveBeenCalledWith(
        'DEACTIVATED',
        'Test User',
        mockMember.discordUserId,
        12345,
        expect.any(Object)
      );
    });

    it('should handle non-existent member', async () => {
      const result = await memberManager.deactivateMember(99999);
      expect(result).toBe(false);
    });
  });

  describe('reactivateMember', () => {
    beforeEach(() => {
      const inactiveMember = { 
        ...mockMember, 
        isActive: false, 
        deactivatedAt: '2024-01-01T00:00:00Z',
        tokenError: { message: 'Token expired', timestamp: '2024-01-01T00:00:00Z' }
      };
      memberManager.members.set('12345', inactiveMember);
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();
    });

    it('should reactivate member successfully', async () => {
      const result = await memberManager.reactivateMember(12345);
      const member = memberManager.members.get('12345');

      expect(result).toBe(true);
      expect(member.isActive).toBe(true);
      expect(member.reactivatedAt).toBeDefined();
      expect(member.deactivatedAt).toBeUndefined();
      expect(member.tokenError).toBeUndefined();
      expect(memberManager.discordToStrava.get(mockMember.discordUserId)).toBe('12345');
      expect(memberManager.saveMembers).toHaveBeenCalled();
      expect(logger.memberAction).toHaveBeenCalledWith(
        'REACTIVATED',
        'Test User',
        mockMember.discordUserId,
        12345,
        expect.any(Object)
      );
    });

    it('should handle non-existent member', async () => {
      const result = await memberManager.reactivateMember(99999);
      expect(result).toBe(false);
    });
  });

  describe('encryption and decryption', () => {
    const originalMember = {
      ...mockMember,
      tokens: {
        access_token: 'secret_access_token',
        refresh_token: 'secret_refresh_token',
        expires_at: 1234567890,
        expires_in: 3600,
        token_type: 'Bearer'
      }
    };

    describe('encryptMemberData', () => {
      it('should encrypt sensitive token data', () => {
        const encrypted = memberManager.encryptMemberData(originalMember);

        expect(encrypted.tokens.encrypted).toBeDefined();
        expect(encrypted.tokens.iv).toBeDefined();
        expect(encrypted.tokens.authTag).toBeDefined();
        expect(encrypted.tokens.access_token).toBeUndefined();
        expect(encrypted.tokens.refresh_token).toBeUndefined();

        // Non-sensitive data should remain unchanged
        expect(encrypted.discordUserId).toBe(originalMember.discordUserId);
        expect(encrypted.athlete).toEqual(originalMember.athlete);
      });

      it('should return unencrypted data if no encryption key', () => {
        const originalConfig = config.security.encryptionKey;
        config.security.encryptionKey = null;

        const result = memberManager.encryptMemberData(originalMember);

        expect(result).toEqual(originalMember);
        config.security.encryptionKey = originalConfig;
      });
    });

    describe('decryptMemberData', () => {
      it('should decrypt encrypted member data correctly', () => {
        const encrypted = memberManager.encryptMemberData(originalMember);
        const decrypted = memberManager.decryptMemberData(encrypted);

        expect(decrypted.tokens).toEqual(originalMember.tokens);
        expect(decrypted.discordUserId).toBe(originalMember.discordUserId);
        expect(decrypted.athlete).toEqual(originalMember.athlete);
      });

      it('should handle unencrypted data gracefully', () => {
        const result = memberManager.decryptMemberData(originalMember);
        expect(result).toEqual(originalMember);
      });

      it('should handle missing encryption key', () => {
        const originalConfig = config.security.encryptionKey;
        config.security.encryptionKey = null;

        const encrypted = { ...originalMember, tokens: { encrypted: 'some_data', iv: 'iv', authTag: 'tag' } };
        const result = memberManager.decryptMemberData(encrypted);

        expect(result).toEqual(encrypted);
        config.security.encryptionKey = originalConfig;
      });
    });

    describe('encryption roundtrip', () => {
      it('should maintain data integrity through encrypt/decrypt cycle', () => {
        const encrypted = memberManager.encryptMemberData(originalMember);
        const decrypted = memberManager.decryptMemberData(encrypted);

        expect(decrypted).toEqual(originalMember);
      });

      it('should produce different encrypted outputs for same input', () => {
        const encrypted1 = memberManager.encryptMemberData(originalMember);
        const encrypted2 = memberManager.encryptMemberData(originalMember);

        // Different IVs should result in different encrypted data
        expect(encrypted1.tokens.encrypted).not.toBe(encrypted2.tokens.encrypted);
        expect(encrypted1.tokens.iv).not.toBe(encrypted2.tokens.iv);

        // But both should decrypt to same original data
        const decrypted1 = memberManager.decryptMemberData(encrypted1);
        const decrypted2 = memberManager.decryptMemberData(encrypted2);
        expect(decrypted1).toEqual(originalMember);
        expect(decrypted2).toEqual(originalMember);
      });
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

      const recentMember = { ...mockMember, registeredAt: now.toISOString(), isActive: true };
      const oldActiveMember = { ...mockMember, athlete: { ...mockMember.athlete, id: 67890 }, registeredAt: twoWeeksAgo.toISOString(), isActive: true };
      const inactiveMember = { ...mockMember, athlete: { ...mockMember.athlete, id: 11111 }, registeredAt: weekAgo.toISOString(), isActive: false };

      memberManager.members.set('12345', recentMember);
      memberManager.members.set('67890', oldActiveMember);
      memberManager.members.set('11111', inactiveMember);
    });

    it('should return correct member statistics', () => {
      const stats = memberManager.getStats();

      expect(stats).toEqual({
        total: 3,
        active: 2,
        inactive: 1,
        recentRegistrations: 2 // Both recent member and inactive member registered within last week
      });
    });
  });
});