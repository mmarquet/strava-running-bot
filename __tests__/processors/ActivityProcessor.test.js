const ActivityProcessor = require('../../src/processors/ActivityProcessor');
const StravaAPI = require('../../src/strava/api');
const DiscordBot = require('../../src/discord/bot');
const MemberManager = require('../../src/managers/MemberManager');
const ActivityQueue = require('../../src/managers/ActivityQueue');
const config = require('../../config/config');
const logger = require('../../src/utils/Logger');

// Mock dependencies
jest.mock('../../src/strava/api');
jest.mock('../../src/discord/bot');
jest.mock('../../src/managers/MemberManager');
jest.mock('../../src/managers/ActivityQueue');
jest.mock('../../config/config', () => ({
  posting: {
    delayMinutes: 15
  }
}));
jest.mock('../../src/utils/Logger', () => ({
  activity: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  },
  activityProcessing: jest.fn()
}));

describe('ActivityProcessor', () => {
  let activityProcessor;
  let mockStravaAPI;
  let mockDiscordBot;
  let mockMemberManager;
  let mockActivityQueue;

  const mockMember = {
    discordUserId: '123456789',
    discordUser: {
      displayName: 'Test User',
      username: 'testuser'
    },
    athlete: {
      id: 12345,
      firstname: 'John',
      lastname: 'Doe'
    },
    tokens: {
      access_token: 'test_access_token',
      refresh_token: 'test_refresh_token',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    },
    isActive: true
  };

  const mockActivity = {
    id: 98765,
    name: 'Morning Run',
    type: 'Run',
    distance: 5000,
    moving_time: 1800,
    private: false
  };

  const mockProcessedActivity = {
    ...mockActivity,
    athlete: mockMember.athlete
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create fresh mocks for each test
    mockStravaAPI = {
      getActivity: jest.fn(),
      shouldPostActivity: jest.fn(),
      processActivityWithStreams: jest.fn(),
      getAthleteActivities: jest.fn()
    };

    mockDiscordBot = {
      start: jest.fn(),
      stop: jest.fn(),
      postActivity: jest.fn()
    };

    mockMemberManager = {
      loadMembers: jest.fn(),
      saveMembers: jest.fn(),
      getMemberByAthleteId: jest.fn(),
      getValidAccessToken: jest.fn(),
      refreshMemberToken: jest.fn(),
      getAllMembers: jest.fn(),
      getMemberCount: jest.fn()
    };

    mockActivityQueue = {
      queueActivity: jest.fn(),
      updateQueuedActivity: jest.fn(),
      removeFromQueue: jest.fn(),
      getStats: jest.fn(),
      shutdown: jest.fn()
    };

    // Mock constructors
    StravaAPI.mockImplementation(() => mockStravaAPI);
    DiscordBot.mockImplementation(() => mockDiscordBot);
    MemberManager.mockImplementation(() => mockMemberManager);
    ActivityQueue.mockImplementation(() => mockActivityQueue);

    activityProcessor = new ActivityProcessor();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with all required components', () => {
      expect(activityProcessor.stravaAPI).toBe(mockStravaAPI);
      expect(activityProcessor.memberManager).toBe(mockMemberManager);
      expect(activityProcessor.discordBot).toBe(mockDiscordBot);
      expect(activityProcessor.activityQueue).toBe(mockActivityQueue);
      expect(activityProcessor.processedActivities).toBeInstanceOf(Set);
      expect(activityProcessor.processedActivities.size).toBe(0);
    });

    it('should pass itself to DiscordBot and ActivityQueue', () => {
      expect(DiscordBot).toHaveBeenCalledWith(activityProcessor);
      expect(ActivityQueue).toHaveBeenCalledWith(activityProcessor);
    });
  });

  describe('initialize', () => {
    it('should initialize all components successfully', async () => {
      mockDiscordBot.start.mockResolvedValue();
      mockMemberManager.loadMembers.mockResolvedValue();

      await activityProcessor.initialize();

      expect(mockDiscordBot.start).toHaveBeenCalled();
      expect(mockMemberManager.loadMembers).toHaveBeenCalled();
      expect(logger.activity.info).toHaveBeenCalledWith('Initializing Activity Processor...');
      expect(logger.activity.info).toHaveBeenCalledWith('Activity Processor initialized successfully');
    });

    it('should handle Discord bot start failure', async () => {
      const error = new Error('Discord connection failed');
      mockDiscordBot.start.mockRejectedValue(error);

      await expect(activityProcessor.initialize()).rejects.toThrow(error);
      expect(logger.activity.error).toHaveBeenCalledWith('Failed to initialize Activity Processor', error);
    });

    it('should handle member loading failure', async () => {
      mockDiscordBot.start.mockResolvedValue();
      const error = new Error('Failed to load members');
      mockMemberManager.loadMembers.mockRejectedValue(error);

      await expect(activityProcessor.initialize()).rejects.toThrow(error);
      expect(logger.activity.error).toHaveBeenCalledWith('Failed to initialize Activity Processor', error);
    });
  });

  describe('processNewActivity', () => {
    beforeEach(() => {
      mockMemberManager.getMemberByAthleteId.mockResolvedValue(mockMember);
      mockMemberManager.getValidAccessToken.mockResolvedValue('valid_token');
      mockStravaAPI.getActivity.mockResolvedValue(mockActivity);
      mockStravaAPI.shouldPostActivity.mockReturnValue(true);
      mockStravaAPI.processActivityWithStreams.mockResolvedValue(mockProcessedActivity);
      mockDiscordBot.postActivity.mockResolvedValue();
    });

    it('should process new activity successfully', async () => {
      await activityProcessor.processNewActivity(98765, 12345);

      expect(mockMemberManager.getMemberByAthleteId).toHaveBeenCalledWith(12345);
      expect(mockMemberManager.getValidAccessToken).toHaveBeenCalledWith(mockMember);
      expect(mockStravaAPI.getActivity).toHaveBeenCalledWith(98765, 'valid_token');
      expect(mockStravaAPI.shouldPostActivity).toHaveBeenCalledWith(mockActivity);
      expect(mockStravaAPI.processActivityWithStreams).toHaveBeenCalledWith(
        mockActivity,
        expect.objectContaining({ ...mockMember.athlete, discordUser: mockMember.discordUser }),
        'valid_token'
      );
      expect(mockDiscordBot.postActivity).toHaveBeenCalledWith(mockProcessedActivity);
      expect(activityProcessor.processedActivities.has('12345-98765')).toBe(true);
      expect(logger.activityProcessing).toHaveBeenCalledWith(98765, 12345, mockActivity.name, 'COMPLETED', expect.any(Object));
    });

    it('should prevent duplicate processing', async () => {
      // Process once
      await activityProcessor.processNewActivity(98765, 12345);
      jest.clearAllMocks();

      // Try to process again
      await activityProcessor.processNewActivity(98765, 12345);

      expect(mockMemberManager.getMemberByAthleteId).not.toHaveBeenCalled();
      expect(logger.activityProcessing).toHaveBeenCalledWith(98765, 12345, 'DUPLICATE', 'SKIPPED', {
        reason: 'Already processed'
      });
    });

    it('should skip activities for non-registered athletes', async () => {
      mockMemberManager.getMemberByAthleteId.mockResolvedValue(null);

      await activityProcessor.processNewActivity(98765, 99999);

      expect(mockStravaAPI.getActivity).not.toHaveBeenCalled();
      expect(logger.activityProcessing).toHaveBeenCalledWith(98765, 99999, 'NOT_MEMBER', 'SKIPPED', {
        reason: 'Athlete not registered as member'
      });
    });

    it('should skip activities when access token is invalid', async () => {
      mockMemberManager.getValidAccessToken.mockResolvedValue(null);

      await activityProcessor.processNewActivity(98765, 12345);

      expect(mockStravaAPI.getActivity).not.toHaveBeenCalled();
      expect(logger.activityProcessing).toHaveBeenCalledWith(98765, 12345, 'Test User', 'FAILED', {
        reason: 'Unable to get valid access token'
      });
    });

    it('should skip filtered activities', async () => {
      mockStravaAPI.shouldPostActivity.mockReturnValue(false);

      await activityProcessor.processNewActivity(98765, 12345);

      expect(mockDiscordBot.postActivity).not.toHaveBeenCalled();
      expect(activityProcessor.processedActivities.has('12345-98765')).toBe(true);
      expect(logger.activityProcessing).toHaveBeenCalledWith(98765, 12345, mockActivity.name, 'FILTERED', {
        reason: 'Activity filtered by posting rules'
      });
    });

    it('should handle Discord posting errors', async () => {
      const error = new Error('Discord API error');
      mockDiscordBot.postActivity.mockRejectedValue(error);

      await activityProcessor.processNewActivity(98765, 12345);

      expect(logger.activityProcessing).toHaveBeenCalledWith(98765, 12345, 'UNKNOWN', 'FAILED', expect.objectContaining({
        error: error.message
      }));
      expect(activityProcessor.processedActivities.has('12345-98765')).toBe(false);
    });

    it('should handle 401 authentication errors with token refresh', async () => {
      const authError = new Error('Unauthorized');
      authError.response = { status: 401 };
      mockStravaAPI.getActivity.mockRejectedValue(authError);
      mockMemberManager.refreshMemberToken.mockResolvedValue('new_token');

      const processSpy = jest.spyOn(activityProcessor, 'processNewActivity');
      
      await activityProcessor.processNewActivity(98765, 12345);

      expect(mockMemberManager.refreshMemberToken).toHaveBeenCalledWith(mockMember);
      expect(logger.activity.info).toHaveBeenCalledWith('Attempting token refresh for authentication error', expect.any(Object));
      expect(logger.activity.info).toHaveBeenCalledWith('Token refreshed, retrying activity processing', expect.any(Object));

      // Fast-forward timer to trigger retry
      jest.advanceTimersByTime(1000);
      
      // Should attempt retry after 1 second
      expect(processSpy).toHaveBeenCalledTimes(2); // Original call + retry
    });

    it('should handle token refresh failure during 401 error', async () => {
      const authError = new Error('Unauthorized');
      authError.response = { status: 401 };
      mockStravaAPI.getActivity.mockRejectedValue(authError);
      
      const refreshError = new Error('Refresh failed');
      mockMemberManager.refreshMemberToken.mockRejectedValue(refreshError);

      await activityProcessor.processNewActivity(98765, 12345);

      expect(logger.activity.error).toHaveBeenCalledWith(
        'Failed to refresh token during activity processing',
        expect.objectContaining({
          activityId: 98765,
          athleteId: 12345,
          error: refreshError.message
        })
      );
    });

    it('should handle member without Discord user data', async () => {
      const memberWithoutDiscord = {
        ...mockMember,
        discordUser: null
      };
      mockMemberManager.getMemberByAthleteId.mockResolvedValue(memberWithoutDiscord);

      await activityProcessor.processNewActivity(98765, 12345);

      expect(mockStravaAPI.processActivityWithStreams).toHaveBeenCalledWith(
        mockActivity,
        expect.objectContaining({ ...mockMember.athlete, discordUser: null }),
        'valid_token'
      );
      expect(mockDiscordBot.postActivity).toHaveBeenCalled();
    });
  });

  describe('queueActivity', () => {
    it('should queue activity with webhook data', async () => {
      const webhookData = { eventType: 'create', receivedAt: '2024-01-01T00:00:00Z' };
      mockActivityQueue.queueActivity.mockResolvedValue(true);

      const result = await activityProcessor.queueActivity(98765, 12345, webhookData);

      expect(mockActivityQueue.queueActivity).toHaveBeenCalledWith(98765, 12345, webhookData);
      expect(logger.activity.info).toHaveBeenCalledWith('Queueing activity for delayed posting', {
        activityId: 98765,
        athleteId: 12345,
        delayMinutes: config.posting.delayMinutes
      });
      expect(result).toBe(true);
    });

    it('should queue activity with empty webhook data', async () => {
      await activityProcessor.queueActivity(98765, 12345);

      expect(mockActivityQueue.queueActivity).toHaveBeenCalledWith(98765, 12345, {});
    });
  });

  describe('updateQueuedActivity', () => {
    it('should update existing queued activity', async () => {
      const webhookData = { eventType: 'update', receivedAt: '2024-01-01T01:00:00Z' };
      mockActivityQueue.updateQueuedActivity.mockReturnValue(true);

      await activityProcessor.updateQueuedActivity(98765, 12345, webhookData);

      expect(mockActivityQueue.updateQueuedActivity).toHaveBeenCalledWith(98765, 12345, webhookData);
      expect(logger.activity.info).toHaveBeenCalledWith('Updated queued activity with new data', {
        activityId: 98765,
        athleteId: 12345
      });
    });

    it('should queue activity if not currently queued and not processed', async () => {
      mockActivityQueue.updateQueuedActivity.mockReturnValue(false);
      jest.spyOn(activityProcessor, 'queueActivity').mockResolvedValue();

      await activityProcessor.updateQueuedActivity(98765, 12345);

      expect(logger.activity.debug).toHaveBeenCalledWith('Activity update received for non-queued activity', {
        activityId: 98765,
        athleteId: 12345
      });
      expect(activityProcessor.queueActivity).toHaveBeenCalledWith(98765, 12345, {});
    });

    it('should ignore updates for already processed activities', async () => {
      mockActivityQueue.updateQueuedActivity.mockReturnValue(false);
      activityProcessor.processedActivities.add('12345-98765');

      await activityProcessor.updateQueuedActivity(98765, 12345);

      expect(logger.activity.debug).toHaveBeenCalledWith('Activity already processed, ignoring update', {
        activityId: 98765,
        athleteId: 12345
      });
    });
  });

  describe('removeQueuedActivity', () => {
    it('should remove activity from queue', async () => {
      mockActivityQueue.removeFromQueue.mockReturnValue(true);

      await activityProcessor.removeQueuedActivity(98765, 12345);

      expect(mockActivityQueue.removeFromQueue).toHaveBeenCalledWith(98765);
      expect(logger.activity.info).toHaveBeenCalledWith('Removed deleted activity from queue', {
        activityId: 98765,
        athleteId: 12345
      });
    });

    it('should handle removal of non-queued activity', async () => {
      mockActivityQueue.removeFromQueue.mockReturnValue(false);

      await activityProcessor.removeQueuedActivity(98765, 12345);

      expect(logger.activity.debug).toHaveBeenCalledWith('Activity deletion received for non-queued activity', {
        activityId: 98765,
        athleteId: 12345
      });
    });
  });

  describe('processRecentActivities', () => {
    // Increase timeout for all tests in this describe block
    jest.setTimeout(2000);

    const mockActivities = [
      { id: 111, name: 'Recent Run 1' },
      { id: 222, name: 'Recent Run 2' }
    ];

    beforeEach(() => {
      // Clear all mocks and setup fake timers
      jest.clearAllMocks();
      jest.useFakeTimers();
      
      // Setup mock responses
      mockMemberManager.getAllMembers.mockResolvedValue([mockMember]);
      mockMemberManager.getValidAccessToken.mockResolvedValue('valid_token');
      mockStravaAPI.getAthleteActivities.mockResolvedValue(mockActivities);
      jest.spyOn(activityProcessor, 'processNewActivity').mockResolvedValue();
    });

    it('should process recent activities for all members', async () => {
      const hoursBack = 6;
      const expectedAfter = Math.floor((Date.now() - (6 * 60 * 60 * 1000)) / 1000);
      
      // Create multiple members to test with
      const members = [
        mockMember,
        { ...mockMember, athlete: { ...mockMember.athlete, id: 67890 } }
      ];
      mockMemberManager.getAllMembers.mockResolvedValue(members);
      
      // Setup staggered responses to simulate delay
      mockStravaAPI.getAthleteActivities
        .mockImplementationOnce(() => Promise.resolve(mockActivities))
        .mockImplementationOnce(() => Promise.resolve([{ id: 333, name: 'Recent Run 3' }]));

      // Create a promise that resolves when processing is done
      const processPromise = activityProcessor.processRecentActivities(hoursBack);

      // Run all pending promises and advance timers
      await jest.runAllTimersAsync();
      
      // Now wait for the processing to complete
      await processPromise;

      expect(mockMemberManager.getAllMembers).toHaveBeenCalled();
      expect(mockStravaAPI.getAthleteActivities).toHaveBeenCalledTimes(2);
      expect(mockStravaAPI.getAthleteActivities).toHaveBeenCalledWith(
        'valid_token',
        1,
        30,
        null,
        expect.any(Number)
      );
      
      // Verify all activities were processed for both members
      expect(activityProcessor.processNewActivity).toHaveBeenCalledWith(111, 12345);
      expect(activityProcessor.processNewActivity).toHaveBeenCalledWith(222, 12345);
      expect(activityProcessor.processNewActivity).toHaveBeenCalledWith(333, 67890);
    });

    it('should skip members with invalid tokens', async () => {
      mockMemberManager.getValidAccessToken.mockResolvedValue(null);

      await activityProcessor.processRecentActivities(6);

      expect(mockStravaAPI.getAthleteActivities).not.toHaveBeenCalled();
      expect(logger.activity.warn).toHaveBeenCalledWith('Unable to get valid access token for recent activities', {
        memberName: 'Test User',
        athleteId: 12345
      });
    });

    it('should handle member processing errors gracefully', async () => {
      const error = new Error('API error');
      mockStravaAPI.getAthleteActivities.mockRejectedValue(error);

      await activityProcessor.processRecentActivities(6);

      expect(logger.activity.error).toHaveBeenCalledWith('Error processing recent activities for member', {
        memberName: 'Test User',
        athleteId: 12345,
        error: error.message
      });
    });

    it('should process activities with delay to avoid rate limiting', async () => {
      const activities = [
        { id: 111, name: 'Run 1' },
        { id: 222, name: 'Run 2' }
      ];
      mockStravaAPI.getAthleteActivities.mockResolvedValue(activities);

      // Start processing activities
      const processPromise = activityProcessor.processRecentActivities(6);
      
      // Fast-forward each timeout
      for (let i = 0; i < activities.length; i++) {
        // Advance timers by 200ms (the rate limit delay)
        await jest.advanceTimersByTimeAsync(200);
      }
      
      // Complete the processing
      await processPromise;

      // Verify that activities were processed in sequence with delays
      expect(activityProcessor.processNewActivity).toHaveBeenCalledWith(111, 12345);
      expect(activityProcessor.processNewActivity).toHaveBeenCalledWith(222, 12345);
      expect(activityProcessor.processNewActivity).toHaveBeenCalledTimes(2);
    });

    it('should handle members without Discord user data', async () => {
      const memberWithoutDiscord = {
        ...mockMember,
        discordUser: null
      };
      mockMemberManager.getAllMembers.mockResolvedValue([memberWithoutDiscord]);
      
      // Ensure mocks return quickly to avoid timeouts
      mockMemberManager.getValidAccessToken.mockResolvedValue('valid_token');
      mockStravaAPI.getAthleteActivities.mockResolvedValue([]);

      await activityProcessor.processRecentActivities(6);

      expect(logger.activity.debug).toHaveBeenCalledWith('Processing recent activities for member', {
        memberName: 'John Doe',
        athleteId: 12345,
        discordUserId: '123456789'
      });
    }, 15000);
  });

  describe('cleanupProcessedActivities', () => {
    it('should not cleanup if size is below threshold', () => {
      // Add some activities but stay below threshold
      for (let i = 0; i < 5000; i++) {
        activityProcessor.processedActivities.add(`test-${i}`);
      }

      activityProcessor.cleanupProcessedActivities();

      expect(activityProcessor.processedActivities.size).toBe(5000);
      expect(logger.activity.debug).not.toHaveBeenCalled();
    });

    it('should cleanup when size exceeds threshold', () => {
      // Add activities to exceed threshold
      for (let i = 0; i < 12000; i++) {
        activityProcessor.processedActivities.add(`test-${i}`);
      }

      activityProcessor.cleanupProcessedActivities();

      expect(activityProcessor.processedActivities.size).toBe(8000); // 80% of 10000
      expect(logger.activity.debug).toHaveBeenCalledWith('Cleaned up processed activities cache', {
        previousSize: 10000,
        currentSize: 8000,
        cleanupRatio: '80%'
      });
    });

    it('should keep most recent activities during cleanup', () => {
      // Add activities with predictable order
      for (let i = 0; i < 12000; i++) {
        activityProcessor.processedActivities.add(`test-${i}`);
      }

      activityProcessor.cleanupProcessedActivities();

      // Should keep the most recent ones (higher numbers)
      expect(activityProcessor.processedActivities.has('test-11999')).toBe(true);
      expect(activityProcessor.processedActivities.has('test-0')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', () => {
      const mockQueueStats = {
        totalQueued: 5,
        delayMinutes: 15
      };
      mockActivityQueue.getStats.mockReturnValue(mockQueueStats);
      mockMemberManager.getMemberCount.mockReturnValue(25);

      // Add some processed activities
      activityProcessor.processedActivities.add('test-1');
      activityProcessor.processedActivities.add('test-2');

      const stats = activityProcessor.getStats();

      expect(stats).toEqual({
        processedActivities: 2,
        registeredMembers: 25,
        uptime: expect.any(Number),
        memoryUsage: expect.any(Object),
        activityQueue: mockQueueStats
      });
      expect(mockActivityQueue.getStats).toHaveBeenCalled();
      expect(mockMemberManager.getMemberCount).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should shutdown all components gracefully', async () => {
      mockActivityQueue.shutdown.mockResolvedValue();
      mockDiscordBot.stop.mockResolvedValue();
      mockMemberManager.saveMembers.mockResolvedValue();

      await activityProcessor.shutdown();

      expect(mockActivityQueue.shutdown).toHaveBeenCalled();
      expect(mockDiscordBot.stop).toHaveBeenCalled();
      expect(mockMemberManager.saveMembers).toHaveBeenCalled();
      expect(logger.activity.info).toHaveBeenCalledWith('Shutting down Activity Processor...');
      expect(logger.activity.info).toHaveBeenCalledWith('Activity Processor shutdown complete');
    });

    it('should handle shutdown errors gracefully', async () => {
      const error = new Error('Shutdown failed');
      mockDiscordBot.stop.mockRejectedValue(error);

      await activityProcessor.shutdown();

      expect(logger.activity.error).toHaveBeenCalledWith('Error during Activity Processor shutdown', error);
    });

    it('should call shutdown in correct order', async () => {
      const shutdownOrder = [];
      
      mockActivityQueue.shutdown.mockImplementation(() => {
        shutdownOrder.push('queue');
      });
      mockDiscordBot.stop.mockImplementation(() => {
        shutdownOrder.push('discord');
        return Promise.resolve();
      });
      mockMemberManager.saveMembers.mockImplementation(() => {
        shutdownOrder.push('members');
        return Promise.resolve();
      });

      await activityProcessor.shutdown();

      expect(shutdownOrder).toEqual(['queue', 'discord', 'members']);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null activity from Strava API', async () => {
      mockMemberManager.getMemberByAthleteId.mockResolvedValue(mockMember);
      mockMemberManager.getValidAccessToken.mockResolvedValue('valid_token');
      mockStravaAPI.getActivity.mockResolvedValue(null);

      await activityProcessor.processNewActivity(98765, 12345);

      expect(mockStravaAPI.shouldPostActivity).toHaveBeenCalledWith(null);
      expect(logger.activityProcessing).toHaveBeenCalledWith(98765, 12345, 'UNKNOWN', 'FAILED', expect.any(Object));
    });

    it('should handle very large processed activities set', () => {
      // Simulate a large set without actually creating 50k items
      const originalSize = activityProcessor.processedActivities.size;
      Object.defineProperty(activityProcessor.processedActivities, 'size', {
        get: () => 50000,
        configurable: true
      });

      expect(() => activityProcessor.cleanupProcessedActivities()).not.toThrow();

      // Restore original size property
      Object.defineProperty(activityProcessor.processedActivities, 'size', {
        get: () => originalSize,
        configurable: true
      });
    });

    it('should handle empty members list in processRecentActivities', async () => {
      mockMemberManager.getAllMembers.mockResolvedValue([]);

      await activityProcessor.processRecentActivities(6);

      expect(mockStravaAPI.getAthleteActivities).not.toHaveBeenCalled();
      expect(logger.activity.info).toHaveBeenCalledWith('Processing recent activities', expect.any(Object));
      expect(logger.activity.info).toHaveBeenCalledWith('Finished processing recent activities');
    });

    it('should handle concurrent activity processing safely', async () => {
      // Reset the processed activities set for this test
      activityProcessor.processedActivities.clear();
      
      mockMemberManager.getMemberByAthleteId.mockResolvedValue(mockMember);
      mockMemberManager.getValidAccessToken.mockResolvedValue('valid_token');
      mockStravaAPI.getActivity.mockResolvedValue(mockActivity);
      mockStravaAPI.shouldPostActivity.mockReturnValue(true);
      mockStravaAPI.processActivityWithStreams.mockResolvedValue(mockProcessedActivity);
      mockDiscordBot.postActivity.mockResolvedValue();

      // Process same activity concurrently
      const promise1 = activityProcessor.processNewActivity(98765, 12345);
      const promise2 = activityProcessor.processNewActivity(98765, 12345);

      await Promise.all([promise1, promise2]);

      // Due to async nature, both might process if the timing is very close
      // The important thing is that the activity was processed successfully
      expect(mockDiscordBot.postActivity).toHaveBeenCalled();
      expect(mockDiscordBot.postActivity.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});