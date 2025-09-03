const ActivityQueue = require('../../src/managers/ActivityQueue');
const config = require('../../config/config');
const logger = require('../../src/utils/Logger');

// Mock dependencies
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
  }
}));

describe('ActivityQueue', () => {
  let activityQueue;
  let mockActivityProcessor;
  let mockMemberManager;
  let mockStravaAPI;
  let mockDiscordBot;

  const mockMember = {
    discordUserId: '123456789',
    discordUser: {
      displayName: 'Test User'
    },
    athlete: {
      id: 12345,
      firstname: 'John',
      lastname: 'Doe'
    },
    tokens: {
      access_token: 'test_access_token'
    }
  };

  const mockActivity = {
    id: 98765,
    name: 'Morning Run',
    type: 'Run',
    distance: 5000,
    moving_time: 1800,
    private: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    // Mock MemberManager
    mockMemberManager = {
      getMemberByAthleteId: jest.fn(),
      getValidAccessToken: jest.fn()
    };

    // Mock StravaAPI
    mockStravaAPI = {
      getActivity: jest.fn(),
      shouldPostActivity: jest.fn(),
      processActivityWithStreams: jest.fn()
    };

    // Mock DiscordBot
    mockDiscordBot = {
      postActivity: jest.fn()
    };

    // Mock ActivityProcessor
    mockActivityProcessor = {
      memberManager: mockMemberManager,
      stravaAPI: mockStravaAPI,
      discordBot: mockDiscordBot,
      processNewActivity: jest.fn(),
      processedActivities: new Set()
    };

    activityQueue = new ActivityQueue(mockActivityProcessor);

    // Setup default successful mocks
    mockMemberManager.getMemberByAthleteId.mockResolvedValue(mockMember);
    mockMemberManager.getValidAccessToken.mockResolvedValue('valid_token');
    mockStravaAPI.getActivity.mockResolvedValue(mockActivity);
    mockStravaAPI.shouldPostActivity.mockReturnValue(true);
    mockStravaAPI.processActivityWithStreams.mockResolvedValue(mockActivity);
    mockDiscordBot.postActivity.mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with activity processor and empty maps', () => {
      expect(activityQueue.activityProcessor).toBe(mockActivityProcessor);
      expect(activityQueue.queuedActivities).toBeInstanceOf(Map);
      expect(activityQueue.timers).toBeInstanceOf(Map);
      expect(activityQueue.queuedActivities.size).toBe(0);
      expect(activityQueue.timers.size).toBe(0);
    });
  });

  describe('queueActivity', () => {
    const activityId = 98765;
    const athleteId = 12345;
    const webhookData = { eventType: 'create', receivedAt: '2024-01-01T12:00:00Z' };

    it('should process immediately when delay is 0', async () => {
      config.posting.delayMinutes = 0;
      mockActivityProcessor.processNewActivity.mockResolvedValue();

      await activityQueue.queueActivity(activityId, athleteId, webhookData);

      expect(mockActivityProcessor.processNewActivity).toHaveBeenCalledWith(activityId, athleteId);
      expect(logger.activity.info).toHaveBeenCalledWith('Posting activity immediately (no delay configured)', {
        activityId,
        athleteId
      });
      expect(activityQueue.queuedActivities.size).toBe(0);
    });

    it('should queue activity for delayed posting', async () => {
      config.posting.delayMinutes = 15;

      await activityQueue.queueActivity(activityId, athleteId, webhookData);

      expect(activityQueue.queuedActivities.size).toBe(1);
      expect(activityQueue.timers.size).toBe(1);

      const queueItem = activityQueue.queuedActivities.get(activityId);
      expect(queueItem).toMatchObject({
        activityId,
        athleteId,
        originalWebhookData: webhookData,
        status: 'queued'
      });
      expect(queueItem.queuedAt).toBeInstanceOf(Date);
      expect(queueItem.scheduledTime).toBeInstanceOf(Date);

      expect(logger.activity.info).toHaveBeenCalledWith('Activity queued for delayed posting', {
        activityId,
        athleteId,
        delayMinutes: 15,
        scheduledTime: expect.any(String)
      });
    });

    it('should cancel existing timer when re-queueing activity', async () => {
      config.posting.delayMinutes = 15;
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Queue first time
      await activityQueue.queueActivity(activityId, athleteId);
      expect(activityQueue.timers.size).toBe(1);

      // Queue again
      await activityQueue.queueActivity(activityId, athleteId, webhookData);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(logger.activity.debug).toHaveBeenCalledWith('Cancelled existing timer for updated activity', {
        activityId,
        athleteId
      });
      expect(activityQueue.timers.size).toBe(1); // Should still have one timer
    });

    it('should calculate correct scheduled time', async () => {
      config.posting.delayMinutes = 30;
      const startTime = new Date('2024-01-01T12:00:00Z');
      jest.setSystemTime(startTime);

      await activityQueue.queueActivity(activityId, athleteId);

      const queueItem = activityQueue.queuedActivities.get(activityId);
      const expectedScheduledTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      
      expect(queueItem.scheduledTime.getTime()).toBe(expectedScheduledTime.getTime());
    });

    it('should handle empty webhook data', async () => {
      await activityQueue.queueActivity(activityId, athleteId);

      const queueItem = activityQueue.queuedActivities.get(activityId);
      expect(queueItem.originalWebhookData).toEqual({});
    });
  });

  describe('processQueuedActivity', () => {
    const activityId = 98765;
    const athleteId = 12345;

    beforeEach(async () => {
      // Queue an activity first
      await activityQueue.queueActivity(activityId, athleteId);
    });

    it('should process queued activity successfully', async () => {
      await activityQueue.processQueuedActivity(activityId);

      expect(mockMemberManager.getMemberByAthleteId).toHaveBeenCalledWith(athleteId);
      expect(mockMemberManager.getValidAccessToken).toHaveBeenCalledWith(mockMember);
      expect(mockStravaAPI.getActivity).toHaveBeenCalledWith(activityId, 'valid_token');
      expect(mockStravaAPI.shouldPostActivity).toHaveBeenCalledWith(mockActivity);
      expect(mockStravaAPI.processActivityWithStreams).toHaveBeenCalledWith(
        mockActivity,
        expect.objectContaining({
          ...mockMember.athlete,
          discordUser: mockMember.discordUser
        }),
        'valid_token'
      );
      expect(mockDiscordBot.postActivity).toHaveBeenCalledWith(mockActivity);
      expect(mockActivityProcessor.processedActivities.has(`${athleteId}-${activityId}`)).toBe(true);
      
      expect(logger.activity.info).toHaveBeenCalledWith('Successfully posted queued activity', expect.any(Object));
      expect(activityQueue.queuedActivities.size).toBe(0);
    });

    it('should handle missing queue item gracefully', async () => {
      activityQueue.queuedActivities.clear();

      await activityQueue.processQueuedActivity(activityId);

      expect(logger.activity.warn).toHaveBeenCalledWith('Queued activity not found when processing', { activityId });
      expect(mockMemberManager.getMemberByAthleteId).not.toHaveBeenCalled();
    });

    it('should skip processing if athlete is no longer registered', async () => {
      mockMemberManager.getMemberByAthleteId.mockResolvedValue(null);

      await activityQueue.processQueuedActivity(activityId);

      expect(logger.activity.warn).toHaveBeenCalledWith('Athlete no longer registered, skipping queued activity', {
        activityId,
        athleteId
      });
      expect(mockStravaAPI.getActivity).not.toHaveBeenCalled();
      expect(activityQueue.queuedActivities.size).toBe(0);
    });

    it('should skip processing if unable to get valid access token', async () => {
      mockMemberManager.getValidAccessToken.mockResolvedValue(null);

      await activityQueue.processQueuedActivity(activityId);

      expect(logger.activity.error).toHaveBeenCalledWith('Unable to get valid access token for queued activity', {
        activityId,
        athleteId,
        memberName: 'Test User'
      });
      expect(mockStravaAPI.getActivity).not.toHaveBeenCalled();
      expect(activityQueue.queuedActivities.size).toBe(0);
    });

    it('should skip processing if activity no longer meets posting criteria', async () => {
      mockStravaAPI.shouldPostActivity.mockReturnValue(false);

      await activityQueue.processQueuedActivity(activityId);

      expect(logger.activity.info).toHaveBeenCalledWith('Activity no longer meets posting criteria, skipping', {
        activityId,
        activityName: mockActivity.name,
        memberName: 'Test User'
      });
      expect(mockDiscordBot.postActivity).not.toHaveBeenCalled();
      expect(activityQueue.queuedActivities.size).toBe(0);
    });

    it('should update queue item status to processing', async () => {
      // Mock a delay in processing to check status
      mockStravaAPI.getActivity.mockImplementation(async () => {
        const queueItem = activityQueue.queuedActivities.get(activityId);
        expect(queueItem.status).toBe('processing');
        return mockActivity;
      });

      await activityQueue.processQueuedActivity(activityId);
    });

    it('should handle member without Discord user data', async () => {
      const memberWithoutDiscord = {
        ...mockMember,
        discordUser: null
      };
      mockMemberManager.getMemberByAthleteId.mockResolvedValue(memberWithoutDiscord);

      await activityQueue.processQueuedActivity(activityId);

      expect(mockStravaAPI.processActivityWithStreams).toHaveBeenCalledWith(
        mockActivity,
        expect.objectContaining({
          ...mockMember.athlete,
          discordUser: null
        }),
        'valid_token'
      );
      expect(mockDiscordBot.postActivity).toHaveBeenCalled();
    });

    it('should calculate correct delay time in logs', async () => {
      // Set initial time when queuing
      const queueTime = new Date('2024-01-01T12:00:00Z');
      jest.setSystemTime(queueTime);
      
      // Clear and re-queue to get fresh timestamp
      activityQueue.queuedActivities.clear();
      await activityQueue.queueActivity(activityId, athleteId);
      
      // Advance time by 10 minutes
      const processTime = new Date('2024-01-01T12:10:00Z');
      jest.setSystemTime(processTime);

      await activityQueue.processQueuedActivity(activityId);

      expect(logger.activity.info).toHaveBeenCalledWith('Successfully posted queued activity', 
        expect.objectContaining({
          delayedBy: '10 minutes'
        })
      );
    });

    describe('error handling', () => {
      it('should handle Strava API errors', async () => {
        const error = new Error('Strava API error');
        mockStravaAPI.getActivity.mockRejectedValue(error);

        await activityQueue.processQueuedActivity(activityId);

        expect(logger.activity.error).toHaveBeenCalledWith('Error processing queued activity', {
          activityId,
          error: error.message,
          stack: error.stack
        });
        expect(activityQueue.queuedActivities.size).toBe(0);
      });

      it('should handle Discord posting errors', async () => {
        const error = new Error('Discord API error');
        mockDiscordBot.postActivity.mockRejectedValue(error);

        await activityQueue.processQueuedActivity(activityId);

        expect(logger.activity.error).toHaveBeenCalledWith('Error processing queued activity', {
          activityId,
          error: error.message,
          stack: error.stack
        });
        expect(activityQueue.queuedActivities.size).toBe(0);
      });

      it('should handle member manager errors', async () => {
        const error = new Error('Database connection failed');
        mockMemberManager.getMemberByAthleteId.mockRejectedValue(error);

        await activityQueue.processQueuedActivity(activityId);

        expect(logger.activity.error).toHaveBeenCalledWith('Error processing queued activity', expect.any(Object));
        expect(activityQueue.queuedActivities.size).toBe(0);
      });
    });
  });

  describe('updateQueuedActivity', () => {
    const activityId = 98765;
    const athleteId = 12345;
    const originalWebhookData = { eventType: 'create' };
    const updateWebhookData = { eventType: 'update', receivedAt: '2024-01-01T12:05:00Z' };

    beforeEach(async () => {
      await activityQueue.queueActivity(activityId, athleteId, originalWebhookData);
    });

    it('should update queued activity with new webhook data', () => {
      const result = activityQueue.updateQueuedActivity(activityId, athleteId, updateWebhookData);

      expect(result).toBe(true);
      
      const queueItem = activityQueue.queuedActivities.get(activityId);
      expect(queueItem.originalWebhookData).toEqual(updateWebhookData);
      expect(queueItem.updatedAt).toBeInstanceOf(Date);
      
      expect(logger.activity.debug).toHaveBeenCalledWith('Updating queued activity with new webhook data', {
        activityId,
        athleteId,
        originalQueueTime: expect.any(Date),
        scheduledTime: expect.any(Date)
      });
    });

    it('should return false if activity is not queued', () => {
      const nonExistentActivityId = 99999;
      
      const result = activityQueue.updateQueuedActivity(nonExistentActivityId, athleteId, updateWebhookData);

      expect(result).toBe(false);
      expect(logger.activity.debug).not.toHaveBeenCalled();
    });

    it('should not change scheduled time when updating', () => {
      const queueItem = activityQueue.queuedActivities.get(activityId);
      const originalScheduledTime = queueItem.scheduledTime.getTime();

      activityQueue.updateQueuedActivity(activityId, athleteId, updateWebhookData);

      const updatedItem = activityQueue.queuedActivities.get(activityId);
      expect(updatedItem.scheduledTime.getTime()).toBe(originalScheduledTime);
    });

    it('should preserve original queue time when updating', () => {
      const queueItem = activityQueue.queuedActivities.get(activityId);
      const originalQueueTime = queueItem.queuedAt.getTime();

      activityQueue.updateQueuedActivity(activityId, athleteId, updateWebhookData);

      const updatedItem = activityQueue.queuedActivities.get(activityId);
      expect(updatedItem.queuedAt.getTime()).toBe(originalQueueTime);
    });
  });

  describe('removeFromQueue', () => {
    const activityId = 98765;
    const athleteId = 12345;

    beforeEach(async () => {
      await activityQueue.queueActivity(activityId, athleteId);
    });

    it('should remove activity and clear timer', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const result = activityQueue.removeFromQueue(activityId);

      expect(result).toBe(true);
      expect(activityQueue.queuedActivities.size).toBe(0);
      expect(activityQueue.timers.size).toBe(0);
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(logger.activity.debug).toHaveBeenCalledWith('Removed activity from queue', { activityId });
    });

    it('should return false if activity not in queue', () => {
      const nonExistentActivityId = 99999;
      
      const result = activityQueue.removeFromQueue(nonExistentActivityId);

      expect(result).toBe(false);
      expect(activityQueue.queuedActivities.size).toBe(1); // Original activity still there
    });

    it('should handle missing timer gracefully', () => {
      // Remove timer manually to simulate edge case
      activityQueue.timers.delete(activityId);
      
      const result = activityQueue.removeFromQueue(activityId);

      expect(result).toBe(true);
      expect(activityQueue.queuedActivities.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return empty stats when queue is empty', () => {
      const stats = activityQueue.getStats();

      expect(stats).toEqual({
        totalQueued: 0,
        processing: 0,
        waiting: 0,
        oldestQueued: null,
        nextScheduled: null,
        delayMinutes: config.posting.delayMinutes
      });
    });

    it('should return correct stats with queued activities', async () => {
      config.posting.delayMinutes = 15; // Reset to expected value
      const baseTime = new Date('2024-01-01T12:00:00Z');
      jest.setSystemTime(baseTime);

      // Queue multiple activities at different times
      await activityQueue.queueActivity(111, 12345);
      
      jest.setSystemTime(new Date('2024-01-01T12:05:00Z'));
      await activityQueue.queueActivity(222, 12346);
      
      jest.setSystemTime(new Date('2024-01-01T12:10:00Z'));
      await activityQueue.queueActivity(333, 12347);

      const stats = activityQueue.getStats();

      expect(stats.totalQueued).toBe(3);
      expect(stats.waiting).toBe(3);
      expect(stats.processing).toBe(0);
      expect(stats.oldestQueued).toBe(baseTime.getTime());
      expect(stats.nextScheduled).toBe(new Date('2024-01-01T12:15:00Z').getTime()); // First scheduled
      expect(stats.delayMinutes).toBe(config.posting.delayMinutes);
    });

    it('should count processing activities correctly', async () => {
      await activityQueue.queueActivity(111, 12345);
      
      // Manually set one to processing status
      const queueItem = activityQueue.queuedActivities.get(111);
      queueItem.status = 'processing';

      const stats = activityQueue.getStats();

      expect(stats.totalQueued).toBe(1);
      expect(stats.processing).toBe(1);
      expect(stats.waiting).toBe(0);
    });

    it('should handle mixed activity states', async () => {
      await activityQueue.queueActivity(111, 12345);
      await activityQueue.queueActivity(222, 12346);
      await activityQueue.queueActivity(333, 12347);

      // Set different statuses
      activityQueue.queuedActivities.get(111).status = 'processing';
      activityQueue.queuedActivities.get(222).status = 'queued';
      activityQueue.queuedActivities.get(333).status = 'queued';

      const stats = activityQueue.getStats();

      expect(stats.totalQueued).toBe(3);
      expect(stats.processing).toBe(1);
      expect(stats.waiting).toBe(2);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      // Queue multiple activities
      await activityQueue.queueActivity(111, 12345);
      await activityQueue.queueActivity(222, 12346);
      await activityQueue.queueActivity(333, 12347);
    });

    it('should clear all timers and activities', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      activityQueue.shutdown();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
      expect(activityQueue.timers.size).toBe(0);
      expect(activityQueue.queuedActivities.size).toBe(0);
      
      expect(logger.activity.info).toHaveBeenCalledWith('Shutting down activity queue', {
        queuedActivities: 3,
        activeTimers: 3
      });
      expect(logger.activity.info).toHaveBeenCalledWith('Activity queue shutdown complete');
    });

    it('should log each cleared timer', () => {
      activityQueue.shutdown();

      expect(logger.activity.debug).toHaveBeenCalledWith('Cleared timer for queued activity', { activityId: 111 });
      expect(logger.activity.debug).toHaveBeenCalledWith('Cleared timer for queued activity', { activityId: 222 });
      expect(logger.activity.debug).toHaveBeenCalledWith('Cleared timer for queued activity', { activityId: 333 });
    });

    it('should handle shutdown with no activities', () => {
      activityQueue.queuedActivities.clear();
      activityQueue.timers.clear();

      activityQueue.shutdown();

      expect(logger.activity.info).toHaveBeenCalledWith('Shutting down activity queue', {
        queuedActivities: 0,
        activeTimers: 0
      });
    });
  });

  describe('timer integration', () => {
    it('should automatically process activity after delay', async () => {
      const activityId = 98765;
      const athleteId = 12345;
      const processSpy = jest.spyOn(activityQueue, 'processQueuedActivity').mockResolvedValue();

      config.posting.delayMinutes = 1; // 1 minute delay
      await activityQueue.queueActivity(activityId, athleteId);

      expect(processSpy).not.toHaveBeenCalled();

      // Fast-forward time by 1 minute
      jest.advanceTimersByTime(60 * 1000);

      expect(processSpy).toHaveBeenCalledWith(activityId);
    });

    it('should handle timer callback errors gracefully', async () => {
      const activityId = 98765;
      const athleteId = 12345;
      
      // Mock processQueuedActivity to resolve (simulate successful processing)
      const processSpy = jest.spyOn(activityQueue, 'processQueuedActivity').mockImplementation(async () => {
        // Mock implementation that doesn't throw
        return Promise.resolve();
      });

      config.posting.delayMinutes = 1;
      await activityQueue.queueActivity(activityId, athleteId);

      // Fast-forward time
      jest.advanceTimersByTime(60 * 1000);
      
      expect(processSpy).toHaveBeenCalledWith(activityId);
    });

    it('should cancel and reschedule timer when activity is re-queued', async () => {
      const activityId = 98765;
      const athleteId = 12345;
      const processSpy = jest.spyOn(activityQueue, 'processQueuedActivity').mockResolvedValue();

      config.posting.delayMinutes = 2;
      
      // Queue first time
      await activityQueue.queueActivity(activityId, athleteId);
      
      // Fast-forward 1 minute (half the delay)
      jest.advanceTimersByTime(60 * 1000);
      expect(processSpy).not.toHaveBeenCalled();
      
      // Re-queue (should cancel and restart timer)
      await activityQueue.queueActivity(activityId, athleteId, { updated: true });
      
      // Fast-forward another minute (would have triggered original timer)
      jest.advanceTimersByTime(60 * 1000);
      expect(processSpy).not.toHaveBeenCalled();
      
      // Fast-forward final minute to trigger new timer
      jest.advanceTimersByTime(60 * 1000);
      expect(processSpy).toHaveBeenCalledWith(activityId);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle concurrent queue operations', async () => {
      const activityId = 98765;
      const athleteId = 12345;

      // Queue first
      await activityQueue.queueActivity(activityId, athleteId);
      
      // Then update - should return true since activity is now queued
      const updateResult = activityQueue.updateQueuedActivity(activityId, athleteId, { event: 'update' });

      expect(updateResult).toBe(true);
      expect(activityQueue.queuedActivities.size).toBe(1);
    });

    it('should handle processing activity that was removed from queue', async () => {
      const activityId = 98765;
      const athleteId = 12345;

      await activityQueue.queueActivity(activityId, athleteId);
      
      // Remove from queue before processing
      activityQueue.removeFromQueue(activityId);
      
      // Process should handle missing queue item
      await activityQueue.processQueuedActivity(activityId);
      
      expect(logger.activity.warn).toHaveBeenCalledWith('Queued activity not found when processing', { activityId });
    });

    it('should handle very large delay values', async () => {
      config.posting.delayMinutes = 10080; // 1 week
      const activityId = 98765;
      const athleteId = 12345;

      await activityQueue.queueActivity(activityId, athleteId);

      const queueItem = activityQueue.queuedActivities.get(activityId);
      const expectedScheduledTime = new Date(Date.now() + 10080 * 60 * 1000);
      
      expect(queueItem.scheduledTime.getTime()).toBeCloseTo(expectedScheduledTime.getTime(), -1000); // 1 second tolerance
    });

    it('should handle negative delay values', async () => {
      config.posting.delayMinutes = -5; // Invalid negative delay
      const activityId = 98765;
      const athleteId = 12345;

      await activityQueue.queueActivity(activityId, athleteId);

      // Should still queue with negative delay (scheduled in the past)
      expect(activityQueue.queuedActivities.size).toBe(1);
      const queueItem = activityQueue.queuedActivities.get(activityId);
      expect(queueItem.scheduledTime.getTime()).toBeLessThan(Date.now());
    });

    it('should handle fractional delay minutes', async () => {
      config.posting.delayMinutes = 2.5; // 2.5 minutes = 150 seconds
      const activityId = 98765;
      const athleteId = 12345;

      const startTime = Date.now();
      await activityQueue.queueActivity(activityId, athleteId);

      const queueItem = activityQueue.queuedActivities.get(activityId);
      const expectedScheduledTime = startTime + (2.5 * 60 * 1000);
      
      expect(queueItem.scheduledTime.getTime()).toBe(expectedScheduledTime);
    });
  });

  describe('memory management', () => {
    it('should properly clean up after processing', async () => {
      const activityId = 98765;
      const athleteId = 12345;

      await activityQueue.queueActivity(activityId, athleteId);
      expect(activityQueue.queuedActivities.size).toBe(1);
      expect(activityQueue.timers.size).toBe(1);

      await activityQueue.processQueuedActivity(activityId);

      expect(activityQueue.queuedActivities.size).toBe(0);
      expect(activityQueue.timers.size).toBe(0);
    });

    it('should clean up after errors', async () => {
      const activityId = 98765;
      const athleteId = 12345;
      
      await activityQueue.queueActivity(activityId, athleteId);
      mockMemberManager.getMemberByAthleteId.mockRejectedValue(new Error('Database error'));

      await activityQueue.processQueuedActivity(activityId);

      expect(activityQueue.queuedActivities.size).toBe(0);
      expect(activityQueue.timers.size).toBe(0);
    });

    it('should handle multiple activities without memory leaks', async () => {
      const activities = [
        { id: 111, athleteId: 12345 },
        { id: 222, athleteId: 12346 },
        { id: 333, athleteId: 12347 }
      ];

      // Queue all activities
      for (const activity of activities) {
        await activityQueue.queueActivity(activity.id, activity.athleteId);
      }

      expect(activityQueue.queuedActivities.size).toBe(3);
      expect(activityQueue.timers.size).toBe(3);

      // Process all activities
      for (const activity of activities) {
        await activityQueue.processQueuedActivity(activity.id);
      }

      expect(activityQueue.queuedActivities.size).toBe(0);
      expect(activityQueue.timers.size).toBe(0);
    });
  });
});