const config = require('../../config/config');
const logger = require('../utils/Logger');
const { TIME } = require('../constants');

class ActivityQueue {
  constructor(activityProcessor) {
    this.activityProcessor = activityProcessor;
    this.queuedActivities = new Map(); // activityId -> queueItem
    this.timers = new Map(); // activityId -> timeoutId
  }

  /**
   * Queue an activity for delayed posting
   */
  queueActivity(activityId, athleteId, originalWebhookData = {}) {
    const delayMinutes = config.posting.delayMinutes;
    
    // If delay is 0, post immediately
    if (delayMinutes === 0) {
      logger.activity.info('Posting activity immediately (no delay configured)', {
        activityId,
        athleteId
      });
      return this.activityProcessor.processNewActivity(activityId, athleteId);
    }

    const delayMs = delayMinutes * TIME.MS_PER_MINUTE;
    const scheduledTime = new Date(Date.now() + delayMs);

    const queueItem = {
      activityId,
      athleteId,
      queuedAt: new Date(),
      scheduledTime,
      originalWebhookData,
      status: 'queued'
    };

    // Cancel existing timer if activity is already queued
    if (this.timers.has(activityId)) {
      clearTimeout(this.timers.get(activityId));
      logger.activity.debug('Cancelled existing timer for updated activity', {
        activityId,
        athleteId
      });
    }

    // Store the queued activity
    this.queuedActivities.set(activityId, queueItem);

    // Set up the delayed posting timer
    const timeoutId = setTimeout(async () => {
      await this.processQueuedActivity(activityId);
    }, delayMs);

    this.timers.set(activityId, timeoutId);

    logger.activity.info('Activity queued for delayed posting', {
      activityId,
      athleteId,
      delayMinutes,
      scheduledTime: scheduledTime.toISOString()
    });

    return Promise.resolve();
  }

  /**
   * Process a queued activity (fetch latest data and post to Discord)
   */
  async processQueuedActivity(activityId) {
    try {
      const queueItem = this.queuedActivities.get(activityId);
      if (!queueItem) {
        logger.activity.warn('Queued activity not found when processing', { activityId });
        return;
      }

      logger.activity.info('Processing queued activity', {
        activityId,
        athleteId: queueItem.athleteId,
        queuedAt: queueItem.queuedAt,
        scheduledTime: queueItem.scheduledTime
      });

      // Update status
      queueItem.status = 'processing';

      // Check if athlete is still a registered member
      const member = await this.activityProcessor.memberManager.getMemberByAthleteId(queueItem.athleteId);
      if (!member) {
        logger.activity.warn('Athlete no longer registered, skipping queued activity', {
          activityId,
          athleteId: queueItem.athleteId
        });
        this.removeFromQueue(activityId);
        return;
      }

      const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;

      // Get valid access token
      const accessToken = await this.activityProcessor.memberManager.getValidAccessToken(member);
      if (!accessToken) {
        logger.activity.error('Unable to get valid access token for queued activity', {
          activityId,
          athleteId: queueItem.athleteId,
          memberName
        });
        this.removeFromQueue(activityId);
        return;
      }

      // Fetch the latest activity data from Strava
      logger.activity.debug('Fetching updated activity data before posting', {
        activityId,
        memberName
      });

      const activity = await this.activityProcessor.stravaAPI.getActivity(activityId, accessToken);
      
      // Check if activity should still be posted (might have been made private, etc.)
      if (!this.activityProcessor.stravaAPI.shouldPostActivity(activity)) {
        logger.activity.info('Activity no longer meets posting criteria, skipping', {
          activityId,
          activityName: activity.name,
          memberName
        });
        this.removeFromQueue(activityId);
        return;
      }

      // Process activity data for Discord with member info
      const athleteWithDiscordInfo = {
        ...member.athlete,
        discordUser: member.discordUser
      };
      const processedActivity = await this.activityProcessor.stravaAPI.processActivityWithStreams(activity, athleteWithDiscordInfo, accessToken);

      // Post to Discord
      await this.activityProcessor.discordBot.postActivity(processedActivity);

      // Mark as processed in the main processor to prevent duplicate processing
      const activityKey = `${queueItem.athleteId}-${activityId}`;
      this.activityProcessor.processedActivities.add(activityKey);

      logger.activity.info('Successfully posted queued activity', {
        activityId,
        activityName: activity.name,
        memberName,
        delayedBy: `${Math.round((Date.now() - queueItem.queuedAt.getTime()) / 1000 / 60)} minutes`
      });

      // Clean up
      this.removeFromQueue(activityId);

    } catch (error) {
      logger.activity.error('Error processing queued activity', {
        activityId,
        error: error.message,
        stack: error.stack
      });
      
      // Remove from queue to prevent retry loops
      this.removeFromQueue(activityId);
    }
  }

  /**
   * Handle activity updates during delay period
   */
  updateQueuedActivity(activityId, athleteId, webhookData) {
    const queueItem = this.queuedActivities.get(activityId);
    
    if (queueItem) {
      logger.activity.debug('Updating queued activity with new webhook data', {
        activityId,
        athleteId,
        originalQueueTime: queueItem.queuedAt,
        scheduledTime: queueItem.scheduledTime
      });
      
      // Update the webhook data but keep the original timing
      queueItem.originalWebhookData = webhookData;
      queueItem.updatedAt = new Date();
      
      // No need to reschedule - just update the data
      return true;
    }
    
    return false;
  }

  /**
   * Remove activity from queue (e.g., if deleted)
   */
  removeFromQueue(activityId) {
    // Cancel timer if exists
    if (this.timers.has(activityId)) {
      clearTimeout(this.timers.get(activityId));
      this.timers.delete(activityId);
    }

    // Remove from queue
    const removed = this.queuedActivities.delete(activityId);
    
    if (removed) {
      logger.activity.debug('Removed activity from queue', { activityId });
    }
    
    return removed;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const items = Array.from(this.queuedActivities.values());
    
    return {
      totalQueued: items.length,
      processing: items.filter(item => item.status === 'processing').length,
      waiting: items.filter(item => item.status === 'queued').length,
      oldestQueued: items.length > 0 ? Math.min(...items.map(item => item.queuedAt.getTime())) : null,
      nextScheduled: items.length > 0 ? Math.min(...items.map(item => item.scheduledTime.getTime())) : null,
      delayMinutes: config.posting.delayMinutes
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  shutdown() {
    logger.activity.info('Shutting down activity queue', {
      queuedActivities: this.queuedActivities.size,
      activeTimers: this.timers.size
    });

    // Clear all timers
    for (const [activityId, timeoutId] of this.timers.entries()) {
      clearTimeout(timeoutId);
      logger.activity.debug('Cleared timer for queued activity', { activityId });
    }

    // Clear maps
    this.timers.clear();
    this.queuedActivities.clear();

    logger.activity.info('Activity queue shutdown complete');
  }
}

module.exports = ActivityQueue;