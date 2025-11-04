const config = require('../../config/config');
const { EmbedBuilder } = require('discord.js');
const ActivityFormatter = require('./ActivityFormatter');

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

    // Determine activity type for display (VirtualRide if it's a virtual ride)
    const displayType = ActivityFormatter.isVirtualRide(activity) ? 'VirtualRide' : activity.type;
    const activityIcon = ActivityFormatter.getActivityTypeIcon(displayType);

    // Add [Virtual] prefix for virtual rides
    const virtualPrefix = ActivityFormatter.isVirtualRide(activity) ? '[Virtual] ' : '';
    const activityTitle = `${activityIcon} ${virtualPrefix}${ActivityFormatter.escapeDiscordMarkdown(activity.name)}`;

    const embed = new EmbedBuilder()
      .setTitle(activityTitle)
      .setTimestamp(new Date(activity.start_date))
      .setURL(`https://www.strava.com/activities/${activity.id}`);
    this._setEmbedColor(embed, activity, displayType);
    this._setEmbedThumbnail(embed, activity);
    this._setEmbedAuthorAndFooter(embed, activity, type);
    this._addActivityDescription(embed, activity);
    this._addCoreActivityFields(embed, activity, displayType);
    this._addOptionalActivityFields(embed, activity);
    this._addMapImage(embed, activity);

    return embed;
  }

  /**
   * Set embed color based on activity type and workout type (Race or not)
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   * @param {string} displayType - Display type (may be VirtualRide instead of Ride)
   */
  static _setEmbedColor(embed, activity, displayType) {
    const raceColor = '#D4AF37'; // Gold
    const color = activity.isRace ? raceColor : ActivityFormatter.getActivityTypeColor(displayType);
    embed.setColor(color);
  }

  /**
   * Set embed thumbnail if activity is a race
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   */
  static _setEmbedThumbnail(embed, activity) {
    if (activity.isRace) {
      embed.setThumbnail(`${config.server.baseUrl}/static/checked-flag.png`); // Finish Race Icon
    }
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
   * Add core activity fields (distance, time, pace)
   * @param {EmbedBuilder} embed - Discord embed builder
   * @param {Object} activity - Activity data
   * @param {string} displayType - Display type (may be VirtualRide instead of Ride)
   */
  static _addCoreActivityFields(embed, activity, displayType) {
    const activity_time = activity.isRace ? activity.elapsed_time : activity.moving_time;
    embed.addFields([
      {
        name: '📏 Distance',
        value: ActivityFormatter.formatDistance(activity.distance),
        inline: true,
      },
      {
        name: '⏱️ Time',
        value: ActivityFormatter.formatTime(activity_time),
        inline: true,
      }
    ]);
    if (activity.type === 'Run' || activity.type === 'Walk') {
      embed.addFields([
        {
          name: '🏃 Pace',
          value: ActivityFormatter.formatPace(activity.distance, activity_time),
          inline: true,
        },
      ]);
    } else if (activity.type === 'Ride' || displayType === 'VirtualRide') {
      embed.addFields([
        {
          name: '🚴 Speed',
          value: ActivityFormatter.formatSpeed(activity.distance, activity_time),
          inline: true,
        },
      ]);
    }
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