const fs = require('fs').promises;
const path = require('path');
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

describe('MemberManager - Stress Tests', () => {
  let memberManager;
  
  // Helper to create mock member data
  const createMockMember = (id, discordId = null) => ({
    discordUserId: discordId || `discord_${id}`,
    discordUser: {
      username: `user_${id}`,
      displayName: `User ${id}`,
      discriminator: '0',
      avatar: 'avatar_hash',
      avatarURL: 'https://example.com/avatar.png'
    },
    athlete: {
      id: parseInt(id),
      firstname: `First${id}`,
      lastname: `Last${id}`,
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
      access_token: `access_${id}`,
      refresh_token: `refresh_${id}`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'Bearer'
    },
    registeredAt: new Date().toISOString(),
    lastTokenRefresh: new Date().toISOString(),
    isActive: true
  });

  beforeEach(() => {
    jest.clearAllMocks();
    memberManager = new MemberManager();
    
    // Mock successful file operations by default
    fs.access.mockResolvedValue();
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
  });

  describe('Concurrent Registration Stress Tests', () => {
    beforeEach(() => {
      // Mock saveMembers to track calls and simulate delays
      jest.spyOn(memberManager, 'saveMembers').mockImplementation(async () => {
        // Simulate file save delay to increase chance of race conditions
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      });
    });

    it('should handle 50 simultaneous registrations without data corruption', async () => {
      const registrationPromises = [];
      
      // Create 50 unique members and register them simultaneously
      for (let i = 1; i <= 50; i++) {
        const member = createMockMember(i);
        const promise = memberManager.registerMember(
          member.discordUserId,
          member.athlete,
          member.tokens,
          member.discordUser
        );
        registrationPromises.push(promise);
      }

      // Wait for all registrations to complete
      const results = await Promise.allSettled(registrationPromises);
      
      // All registrations should succeed
      const successful = results.filter(result => result.status === 'fulfilled');
      const failed = results.filter(result => result.status === 'rejected');
      
      expect(successful).toHaveLength(50);
      expect(failed).toHaveLength(0);
      
      // Verify data integrity
      expect(memberManager.members.size).toBe(50);
      expect(memberManager.discordToStrava.size).toBe(50);
      
      // Verify each member is correctly mapped
      for (let i = 1; i <= 50; i++) {
        const discordId = `discord_${i}`;
        const athleteId = memberManager.discordToStrava.get(discordId);
        expect(athleteId).toBe(i.toString());
        
        const member = memberManager.members.get(athleteId);
        expect(member).toBeDefined();
        expect(member.discordUserId).toBe(discordId);
        expect(member.athlete.id).toBe(i);
      }
      
      // Verify consistency check passes
      const consistencyCheck = memberManager.verifyMapConsistency();
      expect(consistencyCheck.isConsistent).toBe(true);
      expect(consistencyCheck.errors).toHaveLength(0);
    });

    it('should prevent duplicate Discord user registrations during concurrent attempts', async () => {
      const duplicateDiscordId = 'duplicate_user_123';
      const registrationPromises = [];
      
      // Try to register the same Discord user to 10 different athletes
      for (let i = 1; i <= 10; i++) {
        const member = createMockMember(i, duplicateDiscordId);
        const promise = memberManager.registerMember(
          member.discordUserId,
          member.athlete,
          member.tokens,
          member.discordUser
        );
        registrationPromises.push(promise);
      }

      const results = await Promise.allSettled(registrationPromises);
      
      // Only one registration should succeed, others should fail
      const successful = results.filter(result => result.status === 'fulfilled');
      const failed = results.filter(result => result.status === 'rejected');
      
      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(9);
      
      // Verify only one member is registered with this Discord ID
      expect(memberManager.discordToStrava.size).toBe(1);
      expect(memberManager.members.size).toBe(1);
      
      // Verify error messages for duplicates
      failed.forEach(result => {
        expect(result.reason.message).toContain('is already registered to athlete');
      });
    });

    it('should prevent same athlete from registering to multiple Discord users', async () => {
      const duplicateAthleteId = 999;
      const registrationPromises = [];
      
      // Try to register the same athlete to 10 different Discord users
      for (let i = 1; i <= 10; i++) {
        const member = createMockMember(duplicateAthleteId, `discord_user_${i}`);
        const promise = memberManager.registerMember(
          member.discordUserId,
          member.athlete,
          member.tokens,
          member.discordUser
        );
        registrationPromises.push(promise);
      }

      const results = await Promise.allSettled(registrationPromises);
      
      // Only one registration should succeed
      const successful = results.filter(result => result.status === 'fulfilled');
      const failed = results.filter(result => result.status === 'rejected');
      
      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(9);
      
      // Verify error messages
      failed.forEach(result => {
        expect(result.reason.message).toContain('is already registered to Discord user');
      });
    });
  });

  describe('Data Corruption Recovery Tests', () => {
    it('should recover from corrupted members.json with duplicate entries', async () => {
      // Create corrupted data with duplicate Discord IDs and athlete IDs
      const corruptedData = {
        version: '1.0',
        savedAt: '2024-01-01T00:00:00Z',
        members: [
          createMockMember(1, 'duplicate_discord'),
          createMockMember(2, 'duplicate_discord'), // Same Discord ID
          createMockMember(1, 'different_discord'),  // Same athlete ID
          createMockMember(3, 'unique_discord'),
        ]
      };

      fs.readFile.mockResolvedValue(JSON.stringify(corruptedData));
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();

      await memberManager.loadMembers();

      // Should have only 2 valid members (first duplicate wins)
      expect(memberManager.members.size).toBe(2);
      expect(memberManager.discordToStrava.size).toBe(2);
      
      // Should have logged warnings about duplicates
      expect(logger.member.warn).toHaveBeenCalledWith(
        'Data integrity issues detected during load',
        expect.objectContaining({
          inconsistencies: expect.arrayContaining([
            expect.stringContaining('Duplicate Discord user ID'),
            expect.stringContaining('Duplicate athlete ID')
          ])
        })
      );
      
      // Should have saved cleaned data
      expect(memberManager.saveMembers).toHaveBeenCalled();
    });

    it('should handle completely corrupted member data structure', async () => {
      const corruptedData = {
        version: '1.0',
        members: [
          { invalid: 'structure' },
          { athlete: { id: 'not_a_number' } },
          null,
          undefined,
          'string_instead_of_object'
        ]
      };

      fs.readFile.mockResolvedValue(JSON.stringify(corruptedData));

      await expect(memberManager.loadMembers()).rejects.toThrow();
      expect(logger.member.error).toHaveBeenCalled();
    });

    it('should handle members with missing required fields', async () => {
      const dataWithMissingFields = {
        version: '1.0',
        members: [
          // Missing discordUserId
          { athlete: { id: 1 }, tokens: {}, isActive: true },
          // Missing athlete
          { discordUserId: 'user_2', tokens: {}, isActive: true },
          // Missing tokens
          { discordUserId: 'user_3', athlete: { id: 3 }, isActive: true },
          // Valid member
          createMockMember(4)
        ]
      };

      fs.readFile.mockResolvedValue(JSON.stringify(dataWithMissingFields));
      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();

      await expect(memberManager.loadMembers()).rejects.toThrow();
    });
  });

  describe('Race Condition Simulation Tests', () => {
    it('should handle rapid sequential member operations without corruption', async () => {
      // Pre-populate with some members
      for (let i = 1; i <= 10; i++) {
        const member = createMockMember(i);
        memberManager.members.set(i.toString(), member);
        memberManager.discordToStrava.set(member.discordUserId, i.toString());
      }

      jest.spyOn(memberManager, 'saveMembers').mockResolvedValue();

      const operations = [];
      
      // Mix of operations happening rapidly
      for (let i = 11; i <= 20; i++) {
        const member = createMockMember(i);
        operations.push(
          memberManager.registerMember(
            member.discordUserId,
            member.athlete,
            member.tokens,
            member.discordUser
          )
        );
      }
      
      // Rapid deactivations
      for (let i = 1; i <= 5; i++) {
        operations.push(memberManager.deactivateMember(i));
      }
      
      // Rapid reactivations
      for (let i = 1; i <= 3; i++) {
        operations.push(memberManager.reactivateMember(i));
      }
      
      // Rapid removals
      for (let i = 6; i <= 8; i++) {
        operations.push(memberManager.removeMember(i));
      }

      const results = await Promise.allSettled(operations);
      
      // Check that state remains consistent
      const consistencyCheck = memberManager.verifyMapConsistency();
      expect(consistencyCheck.isConsistent).toBe(true);
      
      // Verify save was called for each operation
      expect(memberManager.saveMembers).toHaveBeenCalledTimes(results.filter(r => r.status === 'fulfilled').length);
    });

    it('should handle file save failures with proper rollback', async () => {
      // Setup initial state
      const member = createMockMember(1);
      memberManager.members.set('1', member);
      memberManager.discordToStrava.set(member.discordUserId, '1');

      // Mock save failure
      jest.spyOn(memberManager, 'saveMembers').mockRejectedValue(new Error('Disk full'));

      // Try to remove member (should fail and rollback)
      await expect(memberManager.removeMember(1)).rejects.toThrow('Disk full');

      // Verify rollback occurred
      expect(memberManager.members.has('1')).toBe(true);
      expect(memberManager.discordToStrava.has(member.discordUserId)).toBe(true);
      
      // Verify error was logged
      expect(logger.member.error).toHaveBeenCalledWith(
        'Failed to remove member, rolled back changes',
        expect.objectContaining({
          athleteId: 1,
          error: 'Disk full'
        })
      );
    });
  });

  describe('File System Failure Tests', () => {
    it('should handle disk full during registration', async () => {
      const member = createMockMember(1);
      
      jest.spyOn(memberManager, 'saveMembers').mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await expect(
        memberManager.registerMember(
          member.discordUserId,
          member.athlete,
          member.tokens,
          member.discordUser
        )
      ).rejects.toThrow('ENOSPC: no space left on device');

      // Should have rolled back in-memory state after save failure
      expect(memberManager.members.size).toBe(0);
      expect(memberManager.discordToStrava.size).toBe(0);
      
      // Should have logged the rollback
      expect(logger.member.error).toHaveBeenCalledWith(
        'Failed to register member, rolled back changes',
        expect.objectContaining({
          athleteId: '1',  // athleteId is stored as string
          discordUserId: 'discord_1',
          error: 'ENOSPC: no space left on device'
        })
      );
    });

    it('should handle permission denied during deactivation with rollback', async () => {
      // Setup member
      const member = createMockMember(1);
      memberManager.members.set('1', member);
      memberManager.discordToStrava.set(member.discordUserId, '1');

      jest.spyOn(memberManager, 'saveMembers').mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(memberManager.deactivateMember(1)).rejects.toThrow('EACCES: permission denied');

      // Verify rollback
      const restoredMember = memberManager.members.get('1');
      expect(restoredMember.isActive).toBe(true);
      expect(restoredMember.deactivatedAt).toBeUndefined();
      expect(memberManager.discordToStrava.has(member.discordUserId)).toBe(true);
    });

    it('should handle network storage interruption during save', async () => {
      // Setup multiple members
      for (let i = 1; i <= 5; i++) {
        const member = createMockMember(i);
        memberManager.members.set(i.toString(), member);
        memberManager.discordToStrava.set(member.discordUserId, i.toString());
      }

      // Mock network interruption
      jest.spyOn(memberManager, 'saveMembers').mockRejectedValue(new Error('ETIMEDOUT: network timeout'));

      await expect(memberManager.removeMember(3)).rejects.toThrow('ETIMEDOUT: network timeout');

      // Member 3 should be restored
      expect(memberManager.members.has('3')).toBe(true);
      expect(memberManager.discordToStrava.has('discord_3')).toBe(true);
    });
  });

  describe('Map Consistency Validation Tests', () => {
    it('should detect and report all types of map inconsistencies', async () => {
      // Create inconsistent state manually
      const member1 = createMockMember(1);
      const member2 = createMockMember(2);
      const member3 = createMockMember(3);
      
      // Add members
      memberManager.members.set('1', member1);
      memberManager.members.set('2', { ...member2, isActive: false }); // Inactive
      memberManager.members.set('3', { ...member3, discordUserId: 'wrong_discord_id' });
      
      // Create inconsistent Discord mappings
      memberManager.discordToStrava.set('discord_1', '1'); // Correct
      memberManager.discordToStrava.set('discord_2', '2'); // Points to inactive member
      memberManager.discordToStrava.set('orphaned_discord', '999'); // Points to non-existent member
      memberManager.discordToStrava.set('wrong_discord_id', '999'); // Mismatched
      // Missing mapping for member3

      const result = memberManager.verifyMapConsistency();
      
      expect(result.isConsistent).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should detect specific error types
      const errorTypes = result.errors.map(error => error.type);
      expect(errorTypes).toContain('missing_or_incorrect_mapping');
      expect(errorTypes).toContain('inactive_member_mapped');
      expect(errorTypes).toContain('orphaned_discord_mapping');
    });

    it('should handle large dataset consistency check (100+ members)', async () => {
      // Add 100 members
      for (let i = 1; i <= 100; i++) {
        const member = createMockMember(i);
        memberManager.members.set(i.toString(), member);
        memberManager.discordToStrava.set(member.discordUserId, i.toString());
      }

      const result = memberManager.verifyMapConsistency();
      
      expect(result.isConsistent).toBe(true);
      expect(result.memberCount).toBe(100);
      expect(result.mappingCount).toBe(100);
      expect(result.errors).toHaveLength(0);
      
      // Performance check - should complete quickly even with 100 members
      const startTime = Date.now();
      memberManager.verifyMapConsistency();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle mixed active/inactive member states correctly', async () => {
      // Add mix of active and inactive members
      let activeMembersCount = 0;
      for (let i = 1; i <= 20; i++) {
        const member = createMockMember(i);
        member.isActive = i % 3 !== 0; // Every 3rd member is inactive
        memberManager.members.set(i.toString(), member);
        
        // Only active members should have Discord mappings
        if (member.isActive) {
          memberManager.discordToStrava.set(member.discordUserId, i.toString());
          activeMembersCount++;
        }
      }

      const result = memberManager.verifyMapConsistency();
      
      expect(result.isConsistent).toBe(true);
      expect(result.memberCount).toBe(20);
      expect(result.mappingCount).toBe(activeMembersCount); // Exact count of active members
    });
  });

  describe('Load/Save Integrity Under Stress', () => {
    it('should maintain data integrity through multiple load/save cycles', async () => {
      // Create initial dataset
      const initialMembers = [];
      for (let i = 1; i <= 30; i++) {
        initialMembers.push(createMockMember(i));
      }

      // Mock file operations
      let savedData = null;
      jest.spyOn(memberManager, 'saveMembers').mockImplementation(async () => {
        const membersArray = Array.from(memberManager.members.values());
        const encryptedMembers = membersArray.map(member => memberManager.encryptMemberData(member));
        savedData = {
          version: '1.0',
          savedAt: new Date().toISOString(),
          members: encryptedMembers
        };
      });

      // Register all members
      for (const member of initialMembers) {
        await memberManager.registerMember(
          member.discordUserId,
          member.athlete,
          member.tokens,
          member.discordUser
        );
      }

      // Simulate multiple load/save cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        // Mock reading the saved data
        fs.readFile.mockResolvedValue(JSON.stringify(savedData));
        
        // Clear and reload
        memberManager.members.clear();
        memberManager.discordToStrava.clear();
        await memberManager.loadMembers();
        
        // Verify data integrity after each cycle
        expect(memberManager.members.size).toBe(30);
        expect(memberManager.discordToStrava.size).toBe(30);
        
        const consistencyCheck = memberManager.verifyMapConsistency();
        expect(consistencyCheck.isConsistent).toBe(true);
        
        // Modify some data and save again
        if (cycle < 4) {
          await memberManager.deactivateMember(cycle + 1);
          await memberManager.reactivateMember(cycle + 1);
        }
      }
    });

    it('should handle concurrent save operations without corruption', async () => {
      // Setup initial members
      for (let i = 1; i <= 10; i++) {
        const member = createMockMember(i);
        memberManager.members.set(i.toString(), member);
        memberManager.discordToStrava.set(member.discordUserId, i.toString());
      }

      let saveCount = 0;
      jest.spyOn(memberManager, 'saveMembers').mockImplementation(async () => {
        saveCount++;
        // Simulate save delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
      });

      // Trigger many save operations simultaneously
      const savePromises = [];
      for (let i = 0; i < 20; i++) {
        savePromises.push(memberManager.saveMembers());
      }

      await Promise.all(savePromises);
      
      expect(saveCount).toBe(20);
      // State should remain consistent throughout
      expect(memberManager.members.size).toBe(10);
      expect(memberManager.discordToStrava.size).toBe(10);
    });
  });

  describe('Memory Pressure and Performance Tests', () => {
    it('should handle large member datasets efficiently', async () => {
      // Add 500 members to test memory usage
      for (let i = 1; i <= 500; i++) {
        const member = createMockMember(i);
        memberManager.members.set(i.toString(), member);
        memberManager.discordToStrava.set(member.discordUserId, i.toString());
      }

      // Test various operations performance
      const startTime = Date.now();
      
      // Test lookups
      for (let i = 1; i <= 50; i++) {
        await memberManager.getMemberByDiscordId(`discord_${i}`);
        await memberManager.getMemberByAthleteId(i);
      }
      
      // Test consistency check
      const consistencyResult = memberManager.verifyMapConsistency();
      expect(consistencyResult.isConsistent).toBe(true);
      
      // Test getAllMembers
      const allMembers = await memberManager.getAllMembers();
      expect(allMembers).toHaveLength(500);
      
      const endTime = Date.now();
      
      // Should complete quickly even with 500 members
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle encryption/decryption under load without memory leaks', async () => {
      const operations = [];
      
      // Perform many encrypt/decrypt operations simultaneously
      for (let i = 1; i <= 100; i++) {
        const member = createMockMember(i);
        operations.push(async () => {
          const encrypted = memberManager.encryptMemberData(member);
          const decrypted = memberManager.decryptMemberData(encrypted);
          expect(decrypted.tokens).toEqual(member.tokens);
          return decrypted;
        });
      }

      const results = await Promise.all(operations.map(op => op()));
      expect(results).toHaveLength(100);
      
      // All should have correct data
      results.forEach((result, index) => {
        expect(result.athlete.id).toBe(index + 1);
        expect(result.discordUserId).toBe(`discord_${index + 1}`);
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extremely long member lists in save/load cycle', async () => {
      const largeDataset = [];
      
      // Create 1000 members
      for (let i = 1; i <= 1000; i++) {
        largeDataset.push(createMockMember(i));
      }

      // Mock save/load cycle
      let savedContent = null;
      jest.spyOn(memberManager, 'saveMembers').mockImplementation(async () => {
        const membersArray = Array.from(memberManager.members.values());
        savedContent = JSON.stringify({
          version: '1.0',
          savedAt: new Date().toISOString(),
          members: membersArray.map(m => memberManager.encryptMemberData(m))
        });
      });

      // Register all members
      for (const member of largeDataset) {
        await memberManager.registerMember(
          member.discordUserId,
          member.athlete,
          member.tokens,
          member.discordUser
        );
      }

      expect(memberManager.members.size).toBe(1000);
      
      // Simulate load from large file
      fs.readFile.mockResolvedValue(savedContent);
      memberManager.members.clear();
      memberManager.discordToStrava.clear();
      
      await memberManager.loadMembers();
      
      expect(memberManager.members.size).toBe(1000);
      expect(memberManager.discordToStrava.size).toBe(1000);
      
      const consistencyCheck = memberManager.verifyMapConsistency();
      expect(consistencyCheck.isConsistent).toBe(true);
    });

    it('should handle malformed encryption data gracefully', async () => {
      const memberWithBadEncryption = {
        ...createMockMember(1),
        tokens: {
          encrypted: 'invalid_hex_data',
          iv: 'bad_iv',
          authTag: 'bad_auth_tag'
        }
      };

      const corruptedData = {
        version: '1.0',
        members: [memberWithBadEncryption]
      };

      fs.readFile.mockResolvedValue(JSON.stringify(corruptedData));

      await expect(memberManager.loadMembers()).rejects.toThrow();
      expect(logger.member.error).toHaveBeenCalled();
    });

    it('should handle concurrent registrations with file system delays', async () => {
      let saveDelay = 0;
      jest.spyOn(memberManager, 'saveMembers').mockImplementation(async () => {
        saveDelay += 10;
        await new Promise(resolve => setTimeout(resolve, saveDelay));
      });

      const concurrentRegistrations = [];
      
      // Start 20 registrations with increasing save delays
      for (let i = 1; i <= 20; i++) {
        const member = createMockMember(i);
        concurrentRegistrations.push(
          memberManager.registerMember(
            member.discordUserId,
            member.athlete,
            member.tokens,
            member.discordUser
          )
        );
      }

      const results = await Promise.allSettled(concurrentRegistrations);
      
      // All should succeed despite delays
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      expect(memberManager.members.size).toBe(20);
      expect(memberManager.discordToStrava.size).toBe(20);
      
      const consistencyCheck = memberManager.verifyMapConsistency();
      expect(consistencyCheck.isConsistent).toBe(true);
    });
  });
});