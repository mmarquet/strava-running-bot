const RaceManager = require('../../src/managers/RaceManager');
const DatabaseManager = require('../../src/database/DatabaseManager');

// Mock the DatabaseManager
jest.mock('../../src/database/DatabaseManager', () => ({
  initialize: jest.fn(),
  getMemberByDiscordId: jest.fn(),
  addRace: jest.fn(),
  updateRace: jest.fn(),
  removeRace: jest.fn(),
  getMemberRaces: jest.fn(),
  getUpcomingRaces: jest.fn(),
  getAllRaces: jest.fn(),
  getStats: jest.fn(),
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn()
        }))
      }))
    }))
  }
}));

describe('RaceManager', () => {
  let raceManager;
  let mockMember;

  beforeEach(() => {
    raceManager = new RaceManager();
    mockMember = {
      athleteId: 12345,
      discordId: 'discord123',
      isActive: true,
      athlete: {
        firstname: 'John',
        lastname: 'Runner'
      }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('addRace', () => {
    it('should add a race successfully', async () => {
      const raceData = {
        name: 'Boston Marathon',
        raceDate: '21-04-2025',
        raceType: 'road',
        distance: '42.2km',
        location: 'Boston, MA',
        goalTime: '3:30:00',
        notes: 'First Boston attempt'
      };

      const expectedRace = {
        id: 1,
        name: 'Boston Marathon',
        raceDate: '2025-04-21',
        raceType: 'road',
        distance: '42.2km',
        distanceKm: null,
        location: 'Boston, MA',
        status: 'registered',
        goalTime: '3:30:00',
        notes: 'First Boston attempt',
        memberAthleteId: 12345
      };

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      DatabaseManager.addRace.mockResolvedValue(expectedRace);

      const result = await raceManager.addRace('discord123', raceData);

      expect(DatabaseManager.getMemberByDiscordId).toHaveBeenCalledWith('discord123');
      expect(DatabaseManager.addRace).toHaveBeenCalledWith(12345, {
        name: 'Boston Marathon',
        raceDate: '2025-04-21',
        raceType: 'road',
        distance: '42.2km',
        distanceKm: null,
        location: 'Boston, MA',
        notes: 'First Boston attempt',
        goalTime: '3:30:00',
        status: 'registered'
      });
      expect(result).toEqual(expectedRace);
    });

    it('should throw error if member not found', async () => {
      const raceData = {
        name: 'Boston Marathon',
        raceDate: '21-04-2025'
      };

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(null);

      await expect(raceManager.addRace('discord123', raceData))
        .rejects.toThrow('Member not found or inactive');
    });

    it('should validate required race data', async () => {
      const raceData = {
        name: '', // Empty name
        raceDate: '21-04-2025'
      };

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);

      await expect(raceManager.addRace('discord123', raceData))
        .rejects.toThrow('Race name is required');
    });

    it('should validate race date format', async () => {
      const raceData = {
        name: 'Boston Marathon',
        raceDate: 'invalid-date'
      };

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);

      await expect(raceManager.addRace('discord123', raceData))
        .rejects.toThrow('Race date must be in DD-MM-YYYY format');
    });
  });

  describe('updateRace', () => {
    it('should update race successfully', async () => {
      const mockRace = {
        id: 1,
        race_name: 'Boston Marathon',
        race_date: '2025-04-21',
        member_athlete_id: 12345,
        member_discord_user_id: 'discord123'
      };

      const mockMember = {
        athleteId: 12345, // Same athlete ID as race
        discordUserId: 'discord123'
      };

      const updates = {
        distance: '42.2km',
        goalTime: '3:20:00'
      };

      const updatedRace = { ...mockRace, ...updates };

      // Mock getRace to return race data
      raceManager.getRace = jest.fn().mockResolvedValue(mockRace);
      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      DatabaseManager.updateRace.mockResolvedValue(updatedRace);

      const result = await raceManager.updateRace(1, 'discord123', updates);

      expect(raceManager.getRace).toHaveBeenCalledWith(1);
      expect(DatabaseManager.updateRace).toHaveBeenCalledWith(1, expect.objectContaining({
        distance: '42.2km',
        goal_time: '3:20:00'
      }));
      expect(result).toEqual(updatedRace);
    });

    it('should throw error if race not found', async () => {
      raceManager.getRace = jest.fn().mockResolvedValue(null);

      await expect(raceManager.updateRace(1, 'discord123', {}))
        .rejects.toThrow('Race not found');
    });

    it('should throw error if user does not own race', async () => {
      const mockRace = {
        id: 1,
        memberAthleteId: 99999 // Different athlete ID
      };

      raceManager.getRace = jest.fn().mockResolvedValue(mockRace);
      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);

      await expect(raceManager.updateRace(1, 'discord123', { name: 'New Name' }))
        .rejects.toThrow('You can only update your own races');
    });
  });

  describe('getMemberRaces', () => {
    it('should return races for member', async () => {
      const mockRaces = [
        { id: 1, name: 'Boston Marathon', raceDate: '2025-04-21', status: 'registered' },
        { id: 2, name: 'NYC Marathon', raceDate: '2025-11-02', status: 'registered' }
      ];

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      DatabaseManager.getMemberRaces.mockResolvedValue(mockRaces);

      const result = await raceManager.getMemberRaces('discord123');

      expect(DatabaseManager.getMemberRaces).toHaveBeenCalledWith(12345, {});
      expect(result).toEqual(mockRaces);
    });

    it('should return empty array if member not found', async () => {
      DatabaseManager.getMemberByDiscordId.mockResolvedValue(null);

      const result = await raceManager.getMemberRaces('discord123');

      expect(result).toEqual([]);
    });
  });

  describe('validateRaceData', () => {
    it('should pass validation for valid data', () => {
      const validData = {
        name: 'Boston Marathon',
        raceDate: '21-04-2025',
        distance: '42.2km',
        location: 'Boston, MA'
      };

      expect(() => raceManager.validateRaceData(validData)).not.toThrow();
    });

    it('should throw error for missing race name', () => {
      const invalidData = {
        raceDate: '21-04-2025'
      };

      expect(() => raceManager.validateRaceData(invalidData))
        .toThrow('Race name is required');
    });

    it('should throw error for invalid date format', () => {
      const invalidData = {
        name: 'Boston Marathon',
        raceDate: '2025/04/21' // Wrong format
      };

      expect(() => raceManager.validateRaceData(invalidData))
        .toThrow('Race date must be in DD-MM-YYYY format');
    });

    it('should throw error for race name too long', () => {
      const invalidData = {
        name: 'A'.repeat(101), // 101 characters
        raceDate: '21-04-2025'
      };

      expect(() => raceManager.validateRaceData(invalidData))
        .toThrow('Race name cannot exceed 100 characters');
    });
  });

  describe('formatRaceDisplay', () => {
    it('should format race display correctly', () => {
      const race = {
        name: 'Boston Marathon',
        race_date: '2025-04-21',
        race_type: 'road',
        distance: '42.2km',
        location: 'Boston, MA',
        goal_time: '3:30:00',
        status: 'registered',
        notes: 'First attempt'
      };

      const formatted = raceManager.formatRaceDisplay(race);

      expect(formatted).toContain('**Boston Marathon**');
      expect(formatted).toContain('(21-04-2025)'); // DD-MM-YYYY format in display
      expect(formatted).toContain('📍 Boston, MA');
      expect(formatted).toContain('🎯 Goal: 3:30:00');
      expect(formatted).toContain('📝 REGISTERED');
      expect(formatted).toContain('💬 First attempt');
    });
  });

  describe('getDaysUntilRace', () => {
    beforeEach(() => {
      // Mock current date to April 1, 2025 at noon UTC to avoid timezone issues
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-04-01T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate days until race correctly', () => {
      const days = raceManager.getDaysUntilRace('2025-04-21');
      expect(days).toBe(20); // From April 1 to April 21 is 20 days
    });
  });

  describe('isUpcoming', () => {
    beforeEach(() => {
      // Mock current date to April 1, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-04-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should identify upcoming races correctly', () => {
      const futureDate = '2025-12-21'; // Future date in December
      const isUpcoming = raceManager.isUpcoming(futureDate);
      expect(isUpcoming).toBe(true);
    });
  });

  describe('removeRace', () => {
    it('should remove race successfully', async () => {
      const raceId = 1;
      const mockRace = {
        id: 1,
        name: 'Boston Marathon',
        member_athlete_id: 12345
      };

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      raceManager.getRace = jest.fn().mockResolvedValue(mockRace);
      DatabaseManager.removeRace.mockResolvedValue(mockRace);

      const result = await raceManager.removeRace(raceId, 'discord123');

      expect(result).toEqual(mockRace);
      expect(DatabaseManager.removeRace).toHaveBeenCalledWith(raceId);
    });

    it('should throw error if race not found', async () => {
      raceManager.getRace = jest.fn().mockResolvedValue(null);

      await expect(raceManager.removeRace(999, 'discord123'))
        .rejects.toThrow('Race not found');
    });

    it('should throw error if user does not own race', async () => {
      const mockRace = {
        id: 1,
        member_athlete_id: 99999 // Different athlete ID
      };

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      raceManager.getRace = jest.fn().mockResolvedValue(mockRace);

      await expect(raceManager.removeRace(1, 'discord123'))
        .rejects.toThrow('You can only remove your own races');
    });
  });

  describe('getRace', () => {
    it('should get race by ID successfully', async () => {
      const mockRace = { id: 1, name: 'Boston Marathon' };
      DatabaseManager.db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue(mockRace)
          })
        })
      });

      const result = await raceManager.getRace(1);

      expect(result).toEqual(mockRace);
    });

    it('should return null for non-existent race', async () => {
      DatabaseManager.db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue(null)
          })
        })
      });

      const result = await raceManager.getRace(999);

      expect(result).toBeNull();
    });
  });

  describe('getUpcomingRaces', () => {
    it('should return upcoming races', async () => {
      const mockRaces = [
        { name: 'Marathon 1', race_date: '2025-04-21' },
        { name: 'Marathon 2', race_date: '2025-05-01' }
      ];

      DatabaseManager.getUpcomingRaces.mockResolvedValue(mockRaces);

      const result = await raceManager.getUpcomingRaces(30);

      expect(result).toEqual(mockRaces);
      expect(DatabaseManager.getUpcomingRaces).toHaveBeenCalledWith(30);
    });

    it('should handle error when getting upcoming races', async () => {
      DatabaseManager.getUpcomingRaces.mockRejectedValue(new Error('Database error'));

      const result = await raceManager.getUpcomingRaces();

      expect(result).toEqual([]);
    });
  });

  describe('getAllRaces', () => {
    it('should return all races', async () => {
      const mockRaces = [
        { name: 'Marathon 1' },
        { name: 'Marathon 2' }
      ];

      DatabaseManager.getAllRaces.mockResolvedValue(mockRaces);

      const result = await raceManager.getAllRaces({});

      expect(result).toEqual(mockRaces);
    });

    it('should handle error when getting all races', async () => {
      DatabaseManager.getAllRaces.mockRejectedValue(new Error('Database error'));

      const result = await raceManager.getAllRaces();

      expect(result).toEqual([]);
    });
  });

  describe('getRaceStats', () => {
    it('should return race statistics', async () => {
      const mockStats = {
        races: {
          total: 10,
          upcoming: 3
        }
      };

      DatabaseManager.getStats.mockResolvedValue(mockStats);

      const result = await raceManager.getRaceStats();

      expect(result).toEqual(mockStats.races);
    });

    it('should handle error when getting race stats', async () => {
      DatabaseManager.getStats.mockRejectedValue(new Error('Database error'));

      const result = await raceManager.getRaceStats();

      expect(result).toEqual({
        total: 0,
        upcoming: 0
      });
    });
  });

  describe('completeRace', () => {
    it('should complete a race successfully', async () => {
      const mockRace = {
        id: 1,
        member_athlete_id: mockMember.athleteId,
        name: 'Boston Marathon',
        race_date: '2025-04-21'
      };

      const completionData = {
        finishTime: '3:30:00',
        placement: 150
      };

      DatabaseManager.db.select().from().where().get.mockResolvedValue(mockRace);
      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      DatabaseManager.updateRace.mockResolvedValue({ ...mockRace, status: 'completed' });

      const result = await raceManager.completeRace(1, 'discord123', completionData);

      expect(result.status).toBe('completed');
      expect(DatabaseManager.updateRace).toHaveBeenCalled();
    });

    it('should throw error if race not found', async () => {
      DatabaseManager.db.select().from().where().get.mockResolvedValue(null);

      await expect(
        raceManager.completeRace(999, 'discord123')
      ).rejects.toThrow('Race not found');
    });

    it('should throw error if user does not own race', async () => {
      const mockRace = {
        id: 1,
        member_athlete_id: 99999,
        name: 'Boston Marathon'
      };

      DatabaseManager.db.select().from().where().get.mockResolvedValue(mockRace);
      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);

      await expect(
        raceManager.completeRace(1, 'discord123')
      ).rejects.toThrow('You can only update your own races');
    });
  });

  describe('cancelRace', () => {
    it('should cancel a race successfully', async () => {
      const mockRace = {
        id: 1,
        member_athlete_id: mockMember.athleteId,
        name: 'Boston Marathon',
        race_date: '2025-04-21'
      };

      DatabaseManager.db.select().from().where().get.mockResolvedValue(mockRace);
      DatabaseManager.getMemberByDiscordId.mockResolvedValue(mockMember);
      DatabaseManager.updateRace.mockResolvedValue({ ...mockRace, status: 'cancelled', notes: 'Injury' });

      const result = await raceManager.cancelRace(1, 'discord123', 'Injury');

      expect(result.status).toBe('cancelled');
      // updateRace calls DatabaseManager.updateRace with only raceId and updates (no discordUserId)
      expect(DatabaseManager.updateRace).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'cancelled', notes: 'Injury' })
      );
    });
  });

  describe('getStatusEmoji', () => {
    it('should return correct emoji for each status', () => {
      expect(raceManager.getStatusEmoji('registered')).toBe('📝');
      expect(raceManager.getStatusEmoji('completed')).toBe('✅');
      expect(raceManager.getStatusEmoji('cancelled')).toBe('❌');
      expect(raceManager.getStatusEmoji('unknown')).toBe('❓');
    });
  });

  describe('getWeeklyRaces', () => {
    it('should return races for the current week', async () => {
      const mockRaces = [
        { id: 1, race_date: '2025-10-25', name: 'Weekend 5K' }
      ];

      DatabaseManager.getRacesByDateRange = jest.fn().mockResolvedValue(mockRaces);

      const result = await raceManager.getWeeklyRaces();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockRaces);
    });
  });

  describe('getMonthlyRaces', () => {
    it('should return races for the current month', async () => {
      const mockRaces = [
        { id: 1, race_date: '2025-10-30', name: 'Halloween Run' }
      ];

      DatabaseManager.getRacesByDateRange = jest.fn().mockResolvedValue(mockRaces);

      const result = await raceManager.getMonthlyRaces();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockRaces);
    });
  });
});