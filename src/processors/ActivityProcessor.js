const StravaAPI = require('../strava/api');
const DiscordBot = require('../discord/bot');
const DatabaseMemberManager = require('../database/DatabaseMemberManager');
const ActivityQueue = require('../managers/ActivityQueue');
const Scheduler = require('../managers/Scheduler');
const RaceManager = require('../managers/RaceManager');
const config = require('../../config/config');
const dynamicConfig = require('../../config/dynamicConfig');
const logger = require('../utils/Logger');

class ActivityProcessor {
  constructor() {
    this.stravaAPI = new StravaAPI();
    this.memberManager = new DatabaseMemberManager();
    this.discordBot = new DiscordBot(this); // Pass this instance to Discord bot
    this.activityQueue = new ActivityQueue(this); // Activity queue for delayed posting
    this.processedActivities = new Set(); // Prevent duplicate processing
    
    // Initialize race management and scheduler
    this.raceManager = new RaceManager();
    this.scheduler = new Scheduler(this, this.raceManager);
  }

  async initialize() {
    logger.activity.info('Initializing Activity Processor...');
    
    try {
      // Initialize database and member manager
      logger.activity.info('Initializing member manager...');
      await this.memberManager.initialize();
      
      // Initialize dynamic config with settings manager
      if (this.memberManager.databaseManager.settingsManager) {
        dynamicConfig.setSettingsManager(this.memberManager.databaseManager.settingsManager);
      }
      
      logger.activity.info('Member manager initialized');
      
      // Start Discord bot
      logger.activity.info('Starting Discord bot...');
      await this.discordBot.start();
      logger.activity.info('Discord bot started');

      // Start activity queue processor
      logger.activity.info('Activity queue ready (no startup required)');
      // Note: ActivityQueue doesn't need to be started, it processes activities on-demand

      // Initialize race scheduler
      logger.activity.info('Initializing race scheduler...');
      await this.scheduler.initialize(config);
      logger.activity.info('Race scheduler initialized');

      logger.activity.info('Getting member count...');
      const memberCount = await this.memberManager.getMemberCount();
      logger.activity.info('Activity Processor initialized successfully', {
        memberCount: memberCount
      });
      
    } catch (error) {
      logger.activity.error('Failed to initialize Activity Processor', {
        message: error.message,
        stack: error.stack,
        error: error
      });
      throw error;
    }
  }

  async processNewActivity(activityId, athleteId) {
    const activityKey = `${athleteId}-${activityId}`;
    
    // Prevent duplicate processing
    if (this.processedActivities.has(activityKey)) {
      logger.activityProcessing(activityId, athleteId, 'DUPLICATE', 'SKIPPED', {
        reason: 'Already processed'
      });
      return;
    }

    try {
      logger.activityProcessing(activityId, athleteId, 'PROCESSING', 'STARTED');

      // Check if athlete is a registered member
      const member = await this.memberManager.getMemberByAthleteId(athleteId);
      if (!member) {
        logger.activityProcessing(activityId, athleteId, 'NOT_MEMBER', 'SKIPPED', {
          reason: 'Athlete not registered as member'
        });
        return;
      }

      const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
      logger.activity.debug('Found registered member for activity', {
        activityId,
        athleteId,
        memberName,
        discordUserId: member.discordUserId
      });

      // Get valid access token (refresh if needed)
      const accessToken = await this.memberManager.getValidAccessToken(member);
      if (!accessToken) {
        logger.activityProcessing(activityId, athleteId, memberName, 'FAILED', {
          reason: 'Unable to get valid access token'
        });
        return;
      }

      // Fetch detailed activity data
      const activity = await this.stravaAPI.getActivity(activityId, accessToken);
      
      // Check if activity should be posted
      if (!this.stravaAPI.shouldPostActivity(activity)) {
        logger.activityProcessing(activityId, athleteId, activity.name, 'FILTERED', {
          reason: 'Activity filtered by posting rules'
        });
        this.processedActivities.add(activityKey);
        return;
      }

      // Process activity data for Discord with member info including Discord user data
      const athleteWithDiscordInfo = {
        ...member.athlete,
        discordUser: member.discordUser
      };
      const processedActivity = await this.stravaAPI.processActivityWithStreams(activity, athleteWithDiscordInfo, accessToken);

      // Post to Discord
      await this.discordBot.postActivity(processedActivity);

      // Mark as processed
      this.processedActivities.add(activityKey);
      
      logger.activityProcessing(activityId, athleteId, activity.name, 'COMPLETED', {
        memberName,
        activityType: activity.type,
        distance: activity.distance
      });

    } catch (error) {
      logger.activityProcessing(activityId, athleteId, 'UNKNOWN', 'FAILED', {
        error: error.message,
        stack: error.stack,
        responseStatus: error.response?.status
      });
      
      // If it's an authentication error, try to refresh the token
      if (error.response && error.response.status === 401) {
        logger.activity.info('Attempting token refresh for authentication error', {
          activityId,
          athleteId,
          errorStatus: error.response?.status
        });
        try {
          const member = await this.memberManager.getMemberByAthleteId(athleteId);
          if (member) {
            await this.memberManager.refreshMemberToken(member);
            logger.activity.info('Token refreshed, retrying activity processing', {
              activityId,
              athleteId
            });
            
            // Retry processing once with new token
            setTimeout(() => this.processNewActivity(activityId, athleteId), 1000);
          }
        } catch (refreshError) {
          logger.activity.error('Failed to refresh token during activity processing', {
            activityId,
            athleteId,
            error: refreshError.message
          });
        }
      }
    }
  }

  // Queue activity for delayed posting (used by webhook handler)
  async queueActivity(activityId, athleteId, webhookData = {}) {
    logger.activity.info('Queueing activity for delayed posting', {
      activityId,
      athleteId,
      delayMinutes: config.posting.delayMinutes
    });
    
    return this.activityQueue.queueActivity(activityId, athleteId, webhookData);
  }

  // Handle activity updates during delay period
  async updateQueuedActivity(activityId, athleteId, webhookData = {}) {
    const wasUpdated = this.activityQueue.updateQueuedActivity(activityId, athleteId, webhookData);
    
    if (wasUpdated) {
      logger.activity.info('Updated queued activity with new data', {
        activityId,
        athleteId
      });
    } else {
      // Activity not in queue, might need to process immediately or queue it
      logger.activity.debug('Activity update received for non-queued activity', {
        activityId,
        athleteId
      });
      
      // Check if already processed
      const activityKey = `${athleteId}-${activityId}`;
      if (this.processedActivities.has(activityKey)) {
        logger.activity.debug('Activity already processed, ignoring update', {
          activityId,
          athleteId
        });
        return;
      }
      
      // Queue the updated activity
      return this.queueActivity(activityId, athleteId, webhookData);
    }
  }

  // Handle activity deletions during delay period
  async removeQueuedActivity(activityId, athleteId) {
    const wasRemoved = this.activityQueue.removeFromQueue(activityId);
    
    if (wasRemoved) {
      logger.activity.info('Removed deleted activity from queue', {
        activityId,
        athleteId
      });
    } else {
      logger.activity.debug('Activity deletion received for non-queued activity', {
        activityId,
        athleteId
      });
    }
  }

  // Process recent activities for all members (useful for initial sync or recovery)
  async processRecentActivities(hoursBack = 24) {
    const members = await this.memberManager.getAllMembers();
    const after = Math.floor((Date.now() - (hoursBack * 60 * 60 * 1000)) / 1000);
    
    logger.activity.info('Processing recent activities', {
      hoursBack,
      afterTimestamp: after,
      memberCount: members.length
    });

    for (const member of members) {
      const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
      
      try {
        logger.activity.debug('Processing recent activities for member', {
          memberName,
          athleteId: member.athlete.id,
          discordUserId: member.discordUserId
        });
        
        const accessToken = await this.memberManager.getValidAccessToken(member);
        if (!accessToken) {
          logger.activity.warn('Unable to get valid access token for recent activities', {
            memberName,
            athleteId: member.athlete.id
          });
          continue;
        }

        const activities = await this.stravaAPI.getAthleteActivities(
          accessToken,
          1, // page
          30, // per_page
          null, // before
          after // after
        );

        logger.activity.info('Found recent activities', {
          memberName,
          activityCount: activities.length,
          timeRange: `${hoursBack} hours`
        });

        for (const activity of activities) {
          // Process each activity with a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          await this.processNewActivity(activity.id, member.athlete.id);
        }

      } catch (error) {
        logger.activity.error('Error processing recent activities for member', {
          memberName,
          athleteId: member.athlete.id,
          error: error.message
        });
      }
    }

    logger.activity.info('Finished processing recent activities');
  }

  // Cleanup old processed activity records to prevent memory buildup
  cleanupProcessedActivities() {
    const maxSize = 10000; // Keep track of last 10k activities
    
    if (this.processedActivities.size > maxSize) {
      const activitiesArray = Array.from(this.processedActivities);
      const toKeep = activitiesArray.slice(-Math.floor(maxSize * 0.8)); // Keep 80% of max
      
      this.processedActivities.clear();
      toKeep.forEach(activity => this.processedActivities.add(activity));
      
      logger.activity.debug('Cleaned up processed activities cache', {
        previousSize: maxSize,
        currentSize: toKeep.length,
        cleanupRatio: '80%'
      });
    }
  }

  // Get activity statistics
  async getStats() {
    const queueStats = this.activityQueue.getStats();
    
    return {
      processedActivities: this.processedActivities.size,
      registeredMembers: await this.memberManager.getMemberCount(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activityQueue: queueStats
    };
  }

  async shutdown() {
    logger.activity.info('Shutting down Activity Processor...');
    
    try {
      // Shutdown scheduler first to stop cron jobs
      await this.scheduler.shutdown();
      
      // Shutdown activity queue to stop any pending timers
      this.activityQueue.shutdown();
      
      await this.discordBot.stop();
      await this.memberManager.saveMembers();
      logger.activity.info('Activity Processor shutdown complete');
    } catch (error) {
      logger.activity.error('Error during Activity Processor shutdown', error);
    }
  }
}

module.exports = ActivityProcessor;