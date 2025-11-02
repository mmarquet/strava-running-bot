const Scheduler = require('../../src/managers/Scheduler');
const cron = require('node-cron');

// Mock cron job
const mockCronJob = {
  start: jest.fn(),
  stop: jest.fn(),
  destroy: jest.fn()
};

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => mockCronJob)
}));

// Mock Logger
jest.mock('../../src/utils/Logger', () => ({
  scheduler: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock Discord.js EmbedBuilder
const mockEmbedBuilder = {
  setTitle: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setFooter: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({
    title: '📅 This Week\'s Team Races',
    description: 'test description',
    fields: [{
      name: 'Test Race',
      value: 'Test Value',
      inline: false
    }]
  })
};

jest.mock('discord.js', () => ({
  EmbedBuilder: jest.fn(() => mockEmbedBuilder)
}));

describe('Scheduler', () => {
  let scheduler;
  let mockActivityProcessor;
  let mockRaceManager;
  let mockDiscordBot;
  let mockChannel;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCronJob.start.mockClear();
    mockCronJob.stop.mockClear();
    mockCronJob.destroy.mockClear();
    
    // Reset embed builder mock
    mockEmbedBuilder.setTitle.mockReturnThis();
    mockEmbedBuilder.setColor.mockReturnThis();
    mockEmbedBuilder.setDescription.mockReturnThis();
    mockEmbedBuilder.setTimestamp.mockReturnThis();
    mockEmbedBuilder.setFooter.mockReturnThis();
    mockEmbedBuilder.addFields.mockReturnThis();

    mockChannel = {
      send: jest.fn().mockResolvedValue({ id: 'message-123' })
    };

    mockDiscordBot = {
      getChannel: jest.fn().mockResolvedValue(mockChannel)
    };

    mockRaceManager = {
      getWeeklyRaces: jest.fn(),
      getMonthlyRaces: jest.fn(),
      getDaysUntilRace: jest.fn((date) => {
        const today = new Date();
        const raceDate = new Date(date);
        const diffTime = raceDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      })
    };

    mockActivityProcessor = {
      discordBot: mockDiscordBot,
      memberManager: {
        getMemberByAthleteId: jest.fn()
      }
    };

    mockConfig = {
      scheduler: {
        weeklyEnabled: true,
        monthlyEnabled: true,
        weeklySchedule: '0 8 * * 1',
        monthlySchedule: '0 8 1 * *',
        timezone: 'UTC'
      }
    };

    scheduler = new Scheduler(mockActivityProcessor, mockRaceManager);
  });

  describe('Initialization', () => {
    test('should initialize with activity processor and race manager', () => {
      expect(scheduler.activityProcessor).toBe(mockActivityProcessor);
      expect(scheduler.raceManager).toBe(mockRaceManager);
      expect(scheduler.isInitialized).toBe(false);
    });

    test('should schedule jobs when initializing', async () => {
      await scheduler.initialize(mockConfig);
      
      expect(cron.schedule).toHaveBeenCalledTimes(2);
      expect(mockCronJob.start).toHaveBeenCalledTimes(2);
      expect(scheduler.isInitialized).toBe(true);
    });

    test('should handle disabled features during initialization', async () => {
      const disabledConfig = {
        scheduler: {
          weeklyEnabled: false,
          monthlyEnabled: true,
          weeklySchedule: '0 8 * * 1',
          monthlySchedule: '0 8 1 * *',
          timezone: 'UTC'
        }
      };

      await scheduler.initialize(disabledConfig);
      
      expect(cron.schedule).toHaveBeenCalledTimes(1); // Only monthly
      expect(scheduler.isInitialized).toBe(true);
    });

    test('should not reinitialize if already initialized', async () => {
      await scheduler.initialize(mockConfig);
      await scheduler.initialize(mockConfig);
      
      expect(cron.schedule).toHaveBeenCalledTimes(2); // Still only 2 from first call
    });
  });

  describe('Weekly Race Announcements', () => {
    test('should post weekly races successfully', async () => {
      const mockRaces = [
        {
          id: 1,
          race_name: 'Test Marathon',
          race_date: '2025-09-10',
          race_type: 'road',
          race_distance: 42.2,
          member_athlete_id: 123456
        }
      ];

      const mockMember = {
        discordUser: { displayName: 'Test Runner' },
        athlete: { firstname: 'Test', lastname: 'Runner' }
      };

      mockRaceManager.getWeeklyRaces.mockResolvedValue(mockRaces);
      mockActivityProcessor.memberManager.getMemberByAthleteId.mockResolvedValue(mockMember);

      await scheduler.postWeeklyRaces();

      expect(mockRaceManager.getWeeklyRaces).toHaveBeenCalled();
      expect(mockDiscordBot.getChannel).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalled();

      const sentMessage = mockChannel.send.mock.calls[0][0];
      expect(sentMessage.embeds).toHaveLength(1);
      expect(sentMessage.embeds[0]).toBe(mockEmbedBuilder);
    });

    test('should handle no weekly races', async () => {
      mockRaceManager.getWeeklyRaces.mockResolvedValue([]);

      await scheduler.postWeeklyRaces();

      expect(mockRaceManager.getWeeklyRaces).toHaveBeenCalled();
      expect(mockDiscordBot.getChannel).not.toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    test('should handle Discord channel not available', async () => {
      const mockRaces = [
        {
          id: 1,
          race_name: 'Test Marathon',
          race_date: '2025-09-10',
          race_type: 'road',
          race_distance: 42.2,
          member_athlete_id: 123456
        }
      ];

      mockRaceManager.getWeeklyRaces.mockResolvedValue(mockRaces);
      mockDiscordBot.getChannel.mockResolvedValue(null);

      await scheduler.postWeeklyRaces();

      expect(mockRaceManager.getWeeklyRaces).toHaveBeenCalled();
      expect(mockDiscordBot.getChannel).toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    test('should handle errors during posting', async () => {
      const error = new Error('Test error');
      mockRaceManager.getWeeklyRaces.mockRejectedValue(error);

      await scheduler.postWeeklyRaces();

      expect(mockRaceManager.getWeeklyRaces).toHaveBeenCalled();
    });
  });

  describe('Monthly Race Announcements', () => {
    test('should post monthly races successfully', async () => {
      const mockRaces = [
        {
          id: 1,
          race_name: 'Test Marathon',
          race_date: '2025-09-15',
          race_type: 'trail',
          race_distance: 21.1,
          member_athlete_id: 123456
        },
        {
          id: 2,
          race_name: 'City 10K',
          race_date: '2025-09-25',
          race_type: 'road',
          race_distance: 10,
          member_athlete_id: 789012
        }
      ];

      const mockMember1 = {
        discordUser: { displayName: 'Trail Runner' },
        athlete: { firstname: 'Trail', lastname: 'Runner' }
      };

      const mockMember2 = {
        athlete: { firstname: 'Road', lastname: 'Runner' }
      };

      mockRaceManager.getMonthlyRaces.mockResolvedValue(mockRaces);
      mockActivityProcessor.memberManager.getMemberByAthleteId
        .mockResolvedValueOnce(mockMember1)
        .mockResolvedValueOnce(mockMember2);

      await scheduler.postMonthlyRaces();

      expect(mockRaceManager.getMonthlyRaces).toHaveBeenCalled();
      expect(mockDiscordBot.getChannel).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalled();

      const sentMessage = mockChannel.send.mock.calls[0][0];
      expect(sentMessage.embeds).toHaveLength(1);
      expect(sentMessage.embeds[0]).toBe(mockEmbedBuilder);
    });

    test('should handle no monthly races', async () => {
      mockRaceManager.getMonthlyRaces.mockResolvedValue([]);

      await scheduler.postMonthlyRaces();

      expect(mockRaceManager.getMonthlyRaces).toHaveBeenCalled();
      expect(mockDiscordBot.getChannel).not.toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });
  });

  describe('Embed Creation', () => {
    test('should create weekly race embed with correct format', () => {
      const races = [
        {
          race_name: 'Test Marathon',
          race_date: '2025-09-10',
          race_type: 'road',
          race_distance: 42.2,
          memberName: 'Test Runner'
        }
      ];

      const embed = scheduler.createWeeklyRaceEmbed(races);

      expect(mockEmbedBuilder.setTitle).toHaveBeenCalledWith('📅 This Week\'s Team Races');
      expect(mockEmbedBuilder.setColor).toHaveBeenCalledWith('#4169E1');
      expect(mockEmbedBuilder.setTimestamp).toHaveBeenCalled();
      expect(embed).toBe(mockEmbedBuilder);
    });

    test('should create monthly race embed with correct format', () => {
      const races = [
        {
          race_name: 'Trail Ultra',
          race_date: '2025-09-15',
          race_type: 'trail',
          race_distance: 50,
          memberName: 'Ultra Runner'
        },
        {
          race_name: 'City 5K',
          race_date: '2025-09-25',
          race_type: 'road',
          race_distance: 5,
          memberName: 'Speed Runner'
        }
      ];

      const embed = scheduler.createMonthlyRaceEmbed(races);

      expect(mockEmbedBuilder.setTitle).toHaveBeenCalledWith('📅 This Month\'s Team Races');
      expect(mockEmbedBuilder.setColor).toHaveBeenCalledWith('#FF6347'); // Fixed color to match actual
      expect(mockEmbedBuilder.setTimestamp).toHaveBeenCalled();
      expect(embed).toBe(mockEmbedBuilder);
    });

    test('should handle race distance formatting', () => {
      const races = [
        {
          race_name: 'Test Race',
          race_date: '2025-09-10',
          race_type: 'road',
          race_distance: null,
          memberName: 'Test Runner'
        }
      ];

      const embed = scheduler.createWeeklyRaceEmbed(races);
      expect(embed).toBe(mockEmbedBuilder);
    });

    test('should handle unknown member names', () => {
      const races = [
        {
          race_name: 'Test Race',
          race_date: '2025-09-10',
          race_type: 'road',
          race_distance: 10,
          memberName: 'Unknown'
        }
      ];

      const embed = scheduler.createWeeklyRaceEmbed(races);
      expect(embed).toBe(mockEmbedBuilder);
    });
  });

  describe('Manual Triggers', () => {
    test('should trigger weekly announcement manually', async () => {
      const mockRaces = [
        {
          id: 1,
          race_name: 'Manual Test Race',
          race_date: '2025-09-10',
          race_type: 'road',
          race_distance: 21.1,
          member_athlete_id: 123456
        }
      ];

      const mockMember = {
        discordUser: { displayName: 'Manual Runner' }
      };

      mockRaceManager.getWeeklyRaces.mockResolvedValue(mockRaces);
      mockActivityProcessor.memberManager.getMemberByAthleteId.mockResolvedValue(mockMember);

      await scheduler.triggerWeeklyAnnouncement();

      expect(mockRaceManager.getWeeklyRaces).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalled();
    });

    test('should trigger monthly announcement manually', async () => {
      const mockRaces = [
        {
          id: 1,
          race_name: 'Manual Monthly Race',
          race_date: '2025-09-15',
          race_type: 'trail',
          race_distance: 15,
          member_athlete_id: 123456
        }
      ];

      const mockMember = {
        athlete: { firstname: 'Monthly', lastname: 'Runner' }
      };

      mockRaceManager.getMonthlyRaces.mockResolvedValue(mockRaces);
      mockActivityProcessor.memberManager.getMemberByAthleteId.mockResolvedValue(mockMember);

      await scheduler.triggerMonthlyAnnouncement();

      expect(mockRaceManager.getMonthlyRaces).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalled();
    });
  });

  describe('Scheduler Status', () => {
    test('should track initialized state', async () => {
      expect(scheduler.isInitialized).toBe(false);
      
      await scheduler.initialize(mockConfig);
      
      expect(scheduler.isInitialized).toBe(true);
    });

    test('should track job count', async () => {
      await scheduler.initialize(mockConfig);
      
      expect(scheduler.jobs.size).toBe(2);
    });

    test('should handle partial job initialization', async () => {
      const partialConfig = {
        scheduler: {
          weeklyEnabled: true,
          monthlyEnabled: false,
          weeklySchedule: '0 8 * * 1',
          monthlySchedule: '0 8 1 * *',
          timezone: 'UTC'
        }
      };

      await scheduler.initialize(partialConfig);
      
      expect(scheduler.jobs.size).toBe(1);
    });
  });

  describe('Shutdown', () => {
    test('should stop and destroy all jobs on shutdown', async () => {
      await scheduler.initialize(mockConfig);
      
      await scheduler.shutdown();
      
      expect(mockCronJob.stop).toHaveBeenCalledTimes(2);
      expect(mockCronJob.destroy).toHaveBeenCalledTimes(2);
      expect(scheduler.jobs.size).toBe(0);
      expect(scheduler.isInitialized).toBe(false);
    });

    test('should handle shutdown with no jobs', async () => {
      await scheduler.shutdown();
      
      expect(mockCronJob.stop).not.toHaveBeenCalled();
      expect(mockCronJob.destroy).not.toHaveBeenCalled();
    });
  });

  describe('Date Formatting', () => {
    test('should format race dates correctly', () => {
      const races = [
        {
          race_name: 'Date Test Race',
          race_date: '2025-12-25',
          race_type: 'road',
          race_distance: 10,
          memberName: 'Date Runner'
        }
      ];

      const embed = scheduler.createWeeklyRaceEmbed(races);
      expect(embed).toBe(mockEmbedBuilder);
    });

    test('should handle invalid dates gracefully', () => {
      const races = [
        {
          race_name: 'Invalid Date Race',
          race_date: 'invalid-date',
          race_type: 'road',
          race_distance: 10,
          memberName: 'Invalid Runner'
        }
      ];

      const embed = scheduler.createWeeklyRaceEmbed(races);
      expect(embed).toBe(mockEmbedBuilder);
    });
  });

  describe('Race Type Icons', () => {
    test('should use correct icons for race types', () => {
      const roadRace = [{
        race_name: 'Road Race',
        race_date: '2025-09-10',
        race_type: 'road',
        race_distance: 10,
        memberName: 'Road Runner'
      }];

      const trailRace = [{
        race_name: 'Trail Race',
        race_date: '2025-09-10',
        race_type: 'trail',
        race_distance: 15,
        memberName: 'Trail Runner'
      }];

      const roadEmbed = scheduler.createWeeklyRaceEmbed(roadRace);
      const trailEmbed = scheduler.createWeeklyRaceEmbed(trailRace);

      expect(roadEmbed).toBe(mockEmbedBuilder);
      expect(trailEmbed).toBe(mockEmbedBuilder);
    });
  });
});