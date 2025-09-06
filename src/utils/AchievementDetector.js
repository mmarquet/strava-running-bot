const logger = require('./Logger');
const GifService = require('./GifService');
const config = require('../../config/config');

/**
 * Utility class for detecting and processing Strava achievements (KOMs, QOMs, Local Legends)
 */
class AchievementDetector {
  
  constructor() {
    // Initialize GIF service with API key from config
    this.gifService = new GifService(config.giphy?.apiKey);
  }
  
  /**
   * Fun GIF URLs for different achievement types with descriptions
   */
  static ACHIEVEMENT_GIFS = {
    kom: [
      { url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', description: 'Crown celebration' },
      { url: 'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif', description: 'Victory dance' },
      { url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', description: 'Champions celebration' },
      { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', description: 'Winning celebration' },
      { url: 'https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif', description: 'Trophy celebration' },
      { url: 'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif', description: 'Epic victory' },
      { url: 'https://media.giphy.com/media/l0MYGb8ZTlbS2LNKA/giphy.gif', description: 'King vibes' },
      { url: 'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif', description: 'Mountain conquest' },
      { url: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif', description: 'Winner celebration' },
      { url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', description: 'Champion moment' },
      { url: 'https://media.giphy.com/media/l0HlLQDtuPyQ8O5Gg/giphy.gif', description: 'Victory roar' },
      { url: 'https://media.giphy.com/media/26tk0XFpq1woJOJGg/giphy.gif', description: 'Triumphant glory' },
      { url: 'https://media.giphy.com/media/3o6ZsYq6bUMwlFe4Tu/giphy.gif', description: 'Peak performance' },
      { url: 'https://media.giphy.com/media/3o7abE7n5QKOxhY8Za/giphy.gif', description: 'KOM mastery' },
      { url: 'https://media.giphy.com/media/26BRIEYLEVvEZAEWQ/giphy.gif', description: 'Royal triumph' },
      { url: 'https://media.giphy.com/media/l0MYt8F5EuYs2DcYw/giphy.gif', description: 'Mountain king' },
      { url: 'https://media.giphy.com/media/3oz8xr6VoWGVHVhOla/giphy.gif', description: 'Speed demon' },
      { url: 'https://media.giphy.com/media/26tP4gFBQewkLnMv6/giphy.gif', description: 'Segment destroyer' },
      { url: 'https://media.giphy.com/media/3o7btNhMBytxAM6YBa/giphy.gif', description: 'Hill crusher' },
      { url: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif', description: 'Ultimate victory' }
    ],
    qom: [
      { url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', description: 'Crown celebration' },
      { url: 'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif', description: 'Victory dance' },
      { url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', description: 'Champions celebration' },
      { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', description: 'Winning celebration' },
      { url: 'https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif', description: 'Trophy celebration' },
      { url: 'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif', description: 'Queen energy' },
      { url: 'https://media.giphy.com/media/l0MYJYHRvWKgp9VaE/giphy.gif', description: 'Fierce victory' },
      { url: 'https://media.giphy.com/media/26tOWO8Bb8zJd8rkI/giphy.gif', description: 'Powerful triumph' },
      { url: 'https://media.giphy.com/media/3oz8xZvvOZRmKay4xy/giphy.gif', description: 'Speed queen' },
      { url: 'https://media.giphy.com/media/26BRxfUrRHQf99aBG/giphy.gif', description: 'Mountain queen' },
      { url: 'https://media.giphy.com/media/l0HlJ8mAEjKpZUgLu/giphy.gif', description: 'Unstoppable force' },
      { url: 'https://media.giphy.com/media/26tk1RXWFM3Jh0qMo/giphy.gif', description: 'Royal dominance' },
      { url: 'https://media.giphy.com/media/3o6ZsZdNs3yE5l6hWE/giphy.gif', description: 'Champion spirit' },
      { url: 'https://media.giphy.com/media/3o7abF8QcmHt3pSH9m/giphy.gif', description: 'QOM excellence' },
      { url: 'https://media.giphy.com/media/26BRsI7rek5cAguO2/giphy.gif', description: 'Victorious queen' },
      { url: 'https://media.giphy.com/media/l0MYt9FQcgKLdKcaA/giphy.gif', description: 'Hill conqueror' },
      { url: 'https://media.giphy.com/media/3oz8xsIWMNbG4gCOu4/giphy.gif', description: 'Lightning fast' },
      { url: 'https://media.giphy.com/media/26tP2Enz6KdMduyf6/giphy.gif', description: 'Segment slayer' },
      { url: 'https://media.giphy.com/media/3o7btYwdcdHGAv1LUI/giphy.gif', description: 'Fierce competitor' },
      { url: 'https://media.giphy.com/media/26BRy8tlzfaG6Z1KM/giphy.gif', description: 'Ultimate queen' }
    ],
    local_legend: [
      { url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', description: 'Champions celebration' },
      { url: 'https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif', description: 'Trophy celebration' },
      { url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', description: 'Crown celebration' },
      { url: 'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif', description: 'Victory dance' },
      { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', description: 'Winning celebration' },
      { url: 'https://media.giphy.com/media/3o6Zt47cgKrn8nU9UY/giphy.gif', description: 'Local hero' },
      { url: 'https://media.giphy.com/media/l0MYHRvz1VBmAm9DG/giphy.gif', description: 'Legendary status' },
      { url: 'https://media.giphy.com/media/26tOZlKq64dSKTq9O/giphy.gif', description: 'Community legend' },
      { url: 'https://media.giphy.com/media/3oz8xZghZgKn5mW4lG/giphy.gif', description: 'Persistent champion' },
      { url: 'https://media.giphy.com/media/26BRDLOBz9gxvePvy/giphy.gif', description: 'Regular crusher' },
      { url: 'https://media.giphy.com/media/l0HlIz1fCFcxIgBjy/giphy.gif', description: 'Consistent legend' },
      { url: 'https://media.giphy.com/media/26tkiK1mYGv1DAKfS/giphy.gif', description: 'Frequent flyer' },
      { url: 'https://media.giphy.com/media/3o6ZsXeX1QKnGVAHWG/giphy.gif', description: 'Local dominator' },
      { url: 'https://media.giphy.com/media/3o7abGGH5qHFD8eOsM/giphy.gif', description: 'Segment regular' },
      { url: 'https://media.giphy.com/media/26BRlhZJZeGlgKvpm/giphy.gif', description: 'Legendary effort' },
      { url: 'https://media.giphy.com/media/l0MYt9SAKxHHKf10Y/giphy.gif', description: 'Route master' },
      { url: 'https://media.giphy.com/media/3oz8xrOFdOzJTxL4ly/giphy.gif', description: 'Local superstar' },
      { url: 'https://media.giphy.com/media/26tP3gKr7DFRdKmUo/giphy.gif', description: 'Dedication legend' },
      { url: 'https://media.giphy.com/media/3o7btO3bwGUdZMGXDy/giphy.gif', description: 'Activity king' },
      { url: 'https://media.giphy.com/media/26BRxOBKCPiM3r8ju/giphy.gif', description: 'Legend status' }
    ]
  };

  /**
   * Achievement messages and emojis
   */
  static ACHIEVEMENT_CONFIG = {
    kom: {
      emoji: '👑',
      title: 'King of the Mountain!',
      description: 'Claimed the crown on'
    },
    qom: {
      emoji: '👸',
      title: 'Queen of the Mountain!',
      description: 'Claimed the crown on'
    },
    local_legend: {
      emoji: '🏆',
      title: 'Local Legend!',
      description: 'Became a legend on'
    }
  };

  /**
   * Detect achievements in an activity's segment efforts
   * @param {Object} activity - Strava activity object with segment_efforts
   * @returns {Array} Array of achievement objects
   */
  static detectAchievements(activity) {
    if (!activity.segment_efforts || !Array.isArray(activity.segment_efforts)) {
      return [];
    }

    const achievements = [];

    activity.segment_efforts.forEach(effort => {
      if (effort.achievements && Array.isArray(effort.achievements)) {
        effort.achievements.forEach(achievementType => {
          const achievement = this.createAchievementObject(achievementType, effort);
          if (achievement) {
            achievements.push(achievement);
          }
        });
      }
    });

    logger.activity.debug('Detected achievements', {
      activityId: activity.id,
      achievementCount: achievements.length,
      achievements: achievements.map(a => ({ type: a.type, segment: a.segmentName }))
    });

    return achievements;
  }

  /**
   * Create an achievement object from segment effort data
   * @param {string} achievementType - Type of achievement (kom, qom, local_legend)
   * @param {Object} effort - Segment effort object
   * @returns {Object|null} Achievement object or null if invalid
   */
  static createAchievementObject(achievementType, effort) {
    const config = this.ACHIEVEMENT_CONFIG[achievementType];
    if (!config) {
      logger.activity.debug('Unknown achievement type', { achievementType });
      return null;
    }

    const gifData = this.getRandomGifWithDescription(achievementType);
    const segmentUrl = `https://www.strava.com/segments/${effort.segment.id}`;

    return {
      type: achievementType,
      emoji: config.emoji,
      title: config.title,
      description: config.description,
      segmentName: effort.segment.name,
      segmentId: effort.segment.id,
      segmentUrl: segmentUrl,
      gif: gifData ? gifData.url : null,
      gifDescription: gifData ? gifData.description : null,
      effort: {
        id: effort.id,
        elapsedTime: effort.elapsed_time,
        movingTime: effort.moving_time,
        distance: effort.distance,
        startIndex: effort.start_index,
        endIndex: effort.end_index,
        komRank: effort.kom_rank,
        prRank: effort.pr_rank
      }
    };
  }

  /**
   * Get a random GIF URL for an achievement type
   * @param {string} achievementType - Type of achievement
   * @returns {string} Random GIF URL
   */
  static getRandomGif(achievementType) {
    const gifs = this.ACHIEVEMENT_GIFS[achievementType];
    if (!gifs || gifs.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * gifs.length);
    return gifs[randomIndex].url;
  }

  /**
   * Get a random GIF with description for an achievement type
   * @param {string} achievementType - Type of achievement
   * @returns {Object|null} Object with url and description, or null
   */
  static getRandomGifWithDescription(achievementType) {
    const gifs = this.ACHIEVEMENT_GIFS[achievementType];
    if (!gifs || gifs.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * gifs.length);
    return {
      url: gifs[randomIndex].url,
      description: gifs[randomIndex].description
    };
  }

  /**
   * Get all available GIF descriptions for an achievement type
   * @param {string} achievementType - Type of achievement
   * @returns {Array} Array of descriptions
   */
  static getGifDescriptions(achievementType) {
    const gifs = this.ACHIEVEMENT_GIFS[achievementType];
    if (!gifs || gifs.length === 0) {
      return [];
    }
    
    return gifs.map(gif => gif.description);
  }

  /**
   * Get total number of available GIFs for an achievement type
   * @param {string} achievementType - Type of achievement
   * @returns {number} Number of available GIFs
   */
  static getGifCount(achievementType) {
    const gifs = this.ACHIEVEMENT_GIFS[achievementType];
    return gifs ? gifs.length : 0;
  }

  /**
   * Format achievement for Discord display
   * @param {Object} achievement - Achievement object
   * @returns {Object} Formatted achievement for Discord
   */
  static formatAchievementForDiscord(achievement) {
    const timeText = achievement.effort.movingTime 
      ? this.formatEffortTime(achievement.effort.movingTime)
      : 'N/A';

    const distanceText = achievement.effort.distance 
      ? `${(achievement.effort.distance / 1000).toFixed(2)}km`
      : 'N/A';

    return {
      name: `${achievement.emoji} ${achievement.title}`,
      value: `**${achievement.segmentName}**\n` +
             `${achievement.description} this segment!\n` +
             `📊 Time: ${timeText} | Distance: ${distanceText}\n` +
             `🔗 [View Segment](${achievement.segmentUrl})`,
      inline: false
    };
  }

  /**
   * Format effort time in MM:SS format
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string
   */
  static formatEffortTime(seconds) {
    if (!seconds || seconds <= 0) {
      return 'N/A';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get the most impressive achievement from a list (prioritizes KOM/QOM over Local Legend)
   * @param {Array} achievements - Array of achievement objects
   * @returns {Object|null} Most impressive achievement or null
   */
  static getMostImpressiveAchievement(achievements) {
    if (!achievements || achievements.length === 0) {
      return null;
    }

    // Priority order: KOM/QOM first, then Local Legend
    const priorityOrder = ['kom', 'qom', 'local_legend'];
    
    for (const type of priorityOrder) {
      const achievement = achievements.find(a => a.type === type);
      if (achievement) {
        return achievement;
      }
    }

    // Fallback to first achievement
    return achievements[0];
  }

  /**
   * Check if an activity has any achievements
   * @param {Object} activity - Strava activity object
   * @returns {boolean} True if activity has achievements
   */
  static hasAchievements(activity) {
    const achievements = this.detectAchievements(activity);
    return achievements.length > 0;
  }

  /**
   * Get achievement summary text for notifications
   * @param {Array} achievements - Array of achievement objects
   * @returns {string} Summary text
   */
  static getAchievementSummary(achievements) {
    if (!achievements || achievements.length === 0) {
      return '';
    }

    const counts = achievements.reduce((acc, achievement) => {
      acc[achievement.type] = (acc[achievement.type] || 0) + 1;
      return acc;
    }, {});

    const parts = [];
    if (counts.kom) parts.push(`${counts.kom} KOM${counts.kom > 1 ? 's' : ''}`);
    if (counts.qom) parts.push(`${counts.qom} QOM${counts.qom > 1 ? 's' : ''}`);
    if (counts.local_legend) parts.push(`${counts.local_legend} Local Legend${counts.local_legend > 1 ? 's' : ''}`);

    return parts.join(', ');
  }
}

module.exports = AchievementDetector;
