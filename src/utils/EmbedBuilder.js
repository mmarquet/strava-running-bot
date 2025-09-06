const { EmbedBuilder } = require('discord.js');
const ActivityFormatter = require('./ActivityFormatter');
const AchievementDetector = require('./AchievementDetector');

/**
 * Shared utility for creating Discord embeds for activities
 */
class ActivityEmbedBuilder {
  
  /**
   * Create a Discord embed for an activity
   * @param {Object} activity - Processed activity data
   * @param {Object} options - Embed options
   * @param {string} options.type - 'posted' or 'latest'
   * @returns {EmbedBuilder} Discord embed
   */
  static createActivityEmbed(activity, options = {}) {
    const { type = 'posted' } = options;
    
    const embed = new EmbedBuilder()
      .setTitle(`🏃 ${ActivityFormatter.escapeDiscordMarkdown(activity.name)}`)
      .setColor(ActivityFormatter.getActivityColor(activity.type))
      .setTimestamp(new Date(activity.start_date))
      .setURL(`https://www.strava.com/activities/${activity.id}`);

    this._setEmbedAuthorAndFooter(embed, activity, type);
    this._addActivityDescription(embed, activity);
    this._addAchievementsBanner(embed, activity);
    this._addCoreActivityFields(embed, activity);
    this._addOptionalActivityFields(embed, activity);
    this._addAchievementFields(embed, activity);
    this._addMapImage(embed, activity);

    return embed;
  }

  /**
   * Set embed author and footer based on type
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   * @param {string} type - Embed type
   */
  static _setEmbedAuthorAndFooter(embed, activity, type) {
    let authorName = 'Unknown Athlete';
    let iconURL;

    if (activity.athlete) {
      if (activity.athlete.discordUser?.displayName) {
        authorName = activity.athlete.discordUser.displayName;
      } else if (activity.athlete.firstname && activity.athlete.lastname) {
        authorName = `${activity.athlete.firstname} ${activity.athlete.lastname}`;
      }
      iconURL = activity.athlete.discordUser?.avatarURL ?? activity.athlete.profile_medium;
    }

    if (type === 'latest') {
      embed.setAuthor({
        name: `${authorName} - Last Activity`,
        iconURL: iconURL,
      });
      embed.setFooter({
        text: 'Latest Activity • Powered by Strava',
        iconURL: 'https://cdn.worldvectorlogo.com/logos/strava-1.svg',
      });
    } else {
      embed.setAuthor({
        name: authorName,
        iconURL: iconURL,
      });
      embed.setFooter({
        text: 'Powered by Strava',
        iconURL: 'https://cdn.worldvectorlogo.com/logos/strava-1.svg',
      });
    }
  }

  /**
   * Add activity description if available
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   */
  static _addActivityDescription(embed, activity) {
    if (activity.description) {
      embed.setDescription(ActivityFormatter.escapeDiscordMarkdown(activity.description));
    }
  }

  /**
   * Add achievements banner to embed title if achievements exist
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   */
  static _addAchievementsBanner(embed, activity) {
    if (activity.achievements && activity.achievements.length > 0) {
      const summary = AchievementDetector.getAchievementSummary(activity.achievements);
      const currentTitle = embed.data.title;
      
      // Add celebration emoji and achievement summary to title
      embed.setTitle(`🎉 ${currentTitle} - ${summary}!`);
      
      // Use special color for achievements
      embed.setColor('#FFD700'); // Gold color for achievements
      
      // Set GIF from most impressive achievement
      const topAchievement = AchievementDetector.getMostImpressiveAchievement(activity.achievements);
      if (topAchievement && topAchievement.gif) {
        embed.setThumbnail(topAchievement.gif);
      }
    }
  }

  /**
   * Add core activity fields (distance, time, pace)
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   */
  static _addCoreActivityFields(embed, activity) {
    embed.addFields([
      {
        name: '📏 Distance',
        value: ActivityFormatter.formatDistance(activity.distance),
        inline: true,
      },
      {
        name: '⏱️ Time',
        value: ActivityFormatter.formatTime(activity.moving_time),
        inline: true,
      },
      {
        name: '🏃 Pace',
        value: ActivityFormatter.formatPace(activity.distance, activity.moving_time),
        inline: true,
      },
    ]);
  }

  /**
   * Add optional activity fields (GAP, heart rate, elevation)
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   */
  static _addOptionalActivityFields(embed, activity) {
    if (activity.gap_pace) {
      embed.addFields([{
        name: '📈 Grade Adjusted Pace',
        value: activity.gap_pace,
        inline: true,
      }]);
    }

    if (activity.average_heartrate) {
      embed.addFields([{
        name: '❤️ Avg Heart Rate',
        value: `${Math.round(activity.average_heartrate)} bpm`,
        inline: true,
      }]);
    }

    if (activity.total_elevation_gain > 10) {
      embed.addFields([{
        name: '⛰️ Elevation Gain',
        value: `${Math.round(activity.total_elevation_gain)}m`,
        inline: true,
      }]);
    }
  }

  /**
   * Add achievement fields for KOMs, QOMs, and Local Legends
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   */
  static _addAchievementFields(embed, activity) {
    if (activity.achievements && activity.achievements.length > 0) {
      // Add a separator field
      embed.addFields([{
        name: '\u200B', // Zero-width space for empty field
        value: '\u200B',
        inline: false
      }]);

      // Add each achievement as a field
      activity.achievements.forEach(achievement => {
        const field = AchievementDetector.formatAchievementForDiscord(achievement);
        embed.addFields([field]);
      });
    }
  }

  /**
   * Add map image if polyline is available
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   */
  static _addMapImage(embed, activity) {
    if (activity.map?.summary_polyline) {
      const mapUrl = ActivityFormatter.generateStaticMapUrl(activity.map.summary_polyline);
      if (mapUrl) {
        embed.setImage(mapUrl);
      }
    }
  }
}

module.exports = ActivityEmbedBuilder;