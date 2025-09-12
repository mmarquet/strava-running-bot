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
        raceDate: '2025-04-21',
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
        raceDate: '2025-04-21'
      };

      DatabaseManager.getMemberByDiscordId.mockResolvedValue(null);

      await expect(raceManager.addRace('discord123', raceData))
        .rejects.toThrow('Member not found or inactive');
    });

    it('should validate required race data', async () => {
      const raceData = {
        name: '', // Empty name
        raceDate: '2025-04-21'
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
        .rejects.toThrow('Race date must be in YYYY-MM-DD format');
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
        raceDate: '2025-04-21',
        distance: '42.2km',
        location: 'Boston, MA'
      };

      expect(() => raceManager.validateRaceData(validData)).not.toThrow();
    });

    it('should throw error for missing race name', () => {
      const invalidData = {
        raceDate: '2025-04-21'
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
        .toThrow('Race date must be in YYYY-MM-DD format');
    });

    it('should throw error for race name too long', () => {
      const invalidData = {
        name: 'A'.repeat(101), // 101 characters
        raceDate: '2025-04-21'
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
      expect(formatted).toContain('📍 Boston, MA');
      expect(formatted).toContain('🎯 Goal: 3:30:00');
      expect(formatted).toContain('📝 REGISTERED');
      expect(formatted).toContain('💬 First attempt');
    });
  });

  describe('getDaysUntilRace', () => {
    beforeEach(() => {
      // Mock current date to April 1, 2025
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-04-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate days until race correctly', () => {
      const days = raceManager.getDaysUntilRace('2025-04-21');
      expect(days).toBe(21); // From April 1 to April 21 is 21 days (inclusive)
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
      expect(raceManager.isUpcoming('2025-04-21')).toBe(true);
      expect(raceManager.isUpcoming('2025-03-15')).toBe(false);
      expect(raceManager.isUpcoming('2025-04-01')).toBe(true); // Same day
    });
  });
});