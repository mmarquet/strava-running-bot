const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/Logger');
const { DATE } = require('../constants');

class Scheduler {
  constructor(activityProcessor, raceManager) {
    this.activityProcessor = activityProcessor;
    this.raceManager = raceManager;
    this.jobs = new Map(); // Store active cron jobs
    this.isInitialized = false;
  }

  /**
   * Group races by date - Helper method to reduce duplication
   */
  groupRacesByDate(races) {
    const racesByDate = {};
    for (const race of races) {
      const date = race.race_date;
      if (!racesByDate[date]) racesByDate[date] = [];
      racesByDate[date].push(race);
    }
    return racesByDate;
  }

  /**
   * Format race item text - Helper method to reduce duplication
   */
  formatRaceItem(race, showWeekday = false) {
    const raceDate = new Date(race.race_date + 'T00:00:00');
    const dateOptions = showWeekday 
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric' };
    const dateStr = raceDate.toLocaleDateString('en-US', dateOptions);
    
    let raceText = `**${dateStr}**: ${race.name} - ${race.memberName}`;
    if (race.distance) raceText += ` (${race.distance})`;
    
    const icon = race.race_type === 'trail' ? '🥾' : '🏃‍♂️';
    return `${icon} ${raceText}`;
  }

  /**
   * Initialize the scheduler with cron jobs
   */
  async initialize(config) {
    if (this.isInitialized) {
      logger.scheduler.warn('Scheduler already initialized, skipping');
      return;
    }

    logger.scheduler.info('Initializing race scheduler...');

    try {
      // Weekly race announcement - Every Monday at 8:00 AM
      if (config.scheduler.weeklyEnabled) {
        const weeklyJob = cron.schedule(
          config.scheduler.weeklySchedule, 
          () => this.postWeeklyRaces(),
          {
            scheduled: false,
            timezone: config.scheduler.timezone
          }
        );
        
        this.jobs.set('weekly', weeklyJob);
        weeklyJob.start();
        
        logger.scheduler.info('Weekly race announcements scheduled', {
          schedule: config.scheduler.weeklySchedule,
          timezone: config.scheduler.timezone
        });
      }

      // Monthly race announcement - First day of month at 8:00 AM
      if (config.scheduler.monthlyEnabled) {
        const monthlyJob = cron.schedule(
          config.scheduler.monthlySchedule, 
          () => this.postMonthlyRaces(),
          {
            scheduled: false,
            timezone: config.scheduler.timezone
          }
        );
        
        this.jobs.set('monthly', monthlyJob);
        monthlyJob.start();
        
        logger.scheduler.info('Monthly race announcements scheduled', {
          schedule: config.scheduler.monthlySchedule,
          timezone: config.scheduler.timezone
        });
      }

      this.isInitialized = true;
      logger.scheduler.info('Race scheduler initialized successfully', {
        weeklyEnabled: config.scheduler.weeklyEnabled,
        monthlyEnabled: config.scheduler.monthlyEnabled,
        activeJobs: this.jobs.size
      });

    } catch (error) {
      logger.scheduler.error('Failed to initialize scheduler', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Post weekly race announcements
   */
  async postWeeklyRaces() {
    try {
      logger.scheduler.info('Posting weekly race announcements...');

      const weeklyRaces = await this.raceManager.getWeeklyRaces();
      
      if (weeklyRaces.length === 0) {
        logger.scheduler.info('No races this week to announce');
        return;
      }

      // Get member data for each race
      const racesWithMembers = await Promise.all(
        weeklyRaces.map(async (race) => {
          const member = await this.activityProcessor.memberManager.getMemberByAthleteId(race.member_athlete_id);
          return {
            ...race,
            memberName: member?.discordUser?.displayName || `${member?.athlete?.firstname} ${member?.athlete?.lastname}` || 'Unknown'
          };
        })
      );

      const embed = this.createWeeklyRaceEmbed(racesWithMembers);
      
      const channel = await this.activityProcessor.discordBot.getChannel();
      if (channel) {
        await channel.send({ embeds: [embed] });
        
        logger.scheduler.info('Weekly race announcement posted successfully', {
          raceCount: weeklyRaces.length
        });
      } else {
        logger.scheduler.error('Discord channel not available for weekly announcement');
      }

    } catch (error) {
      logger.scheduler.error('Failed to post weekly race announcements', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Post monthly race announcements
   */
  async postMonthlyRaces() {
    try {
      logger.scheduler.info('Posting monthly race announcements...');

      const monthlyRaces = await this.raceManager.getMonthlyRaces();
      
      if (monthlyRaces.length === 0) {
        logger.scheduler.info('No races this month to announce');
        return;
      }

      // Get member data for each race
      const racesWithMembers = await Promise.all(
        monthlyRaces.map(async (race) => {
          const member = await this.activityProcessor.memberManager.getMemberByAthleteId(race.member_athlete_id);
          return {
            ...race,
            memberName: member?.discordUser?.displayName || `${member?.athlete?.firstname} ${member?.athlete?.lastname}` || 'Unknown'
          };
        })
      );

      const embed = this.createMonthlyRaceEmbed(racesWithMembers);
      
      const channel = await this.activityProcessor.discordBot.getChannel();
      if (channel) {
        await channel.send({ embeds: [embed] });
        
        logger.scheduler.info('Monthly race announcement posted successfully', {
          raceCount: monthlyRaces.length
        });
      } else {
        logger.scheduler.error('Discord channel not available for monthly announcement');
      }

    } catch (error) {
      logger.scheduler.error('Failed to post monthly race announcements', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Create weekly race announcement embed
   */
  createWeeklyRaceEmbed(races) {
    const weekStart = this.getWeekStart();
    const weekEnd = this.getWeekEnd();
    
    const embed = new EmbedBuilder()
      .setTitle('📅 This Week\'s Team Races')
      .setColor('#4169E1') // Royal Blue
      .setDescription(`Upcoming races for **${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}**`)
      .setTimestamp();

    if (races.length === 0) {
      embed.addFields([{
        name: 'No Races This Week',
        value: '📭 No team races scheduled for this week.',
        inline: false
      }]);
    } else {
      // Group races by date
      const racesByDate = this.groupRacesByDate(races);

      // Sort dates and add fields
      const sortedDates = Object.keys(racesByDate).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      
      for (const date of sortedDates) {
        const dayRaces = racesByDate[date];
        const raceDate = new Date(date + 'T00:00:00');
        const daysUntil = this.raceManager.getDaysUntilRace(date);
        
        let dayText = `**${raceDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric' 
        })}**`;
        
        if (daysUntil === 0) dayText += ' (Today!)';
        else if (daysUntil === 1) dayText += ' (Tomorrow)';
        else if (daysUntil > 0) dayText += ` (${daysUntil} days)`;

        const raceList = dayRaces.map(race => this.formatRaceItem(race, false)).join('\n');

        embed.addFields([{
          name: dayText,
          value: raceList,
          inline: false
        }]);
      }

      embed.setFooter({ text: `Good luck to all ${races.length} team member${races.length === 1 ? '' : 's'} racing this week! 🏁` });
    }

    return embed;
  }

  /**
   * Create monthly race announcement embed
   */
  createMonthlyRaceEmbed(races) {
    const monthStart = this.getMonthStart();
    
    const embed = new EmbedBuilder()
      .setTitle('📅 This Month\'s Team Races')
      .setColor('#FF6347') // Tomato Red
      .setDescription(`All races scheduled for **${monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}**`)
      .setTimestamp();

    if (races.length === 0) {
      embed.addFields([{
        name: 'No Races This Month',
        value: '📭 No team races scheduled for this month.',
        inline: false
      }]);
    } else {
      // Group races by week
      const racesByWeek = this.groupRacesByWeek(races);
      
      for (const [weekKey, weekRaces] of Object.entries(racesByWeek)) {
        const [weekStart, weekEnd] = weekKey.split(' - ');
        const weekIndex = Object.keys(racesByWeek).indexOf(weekKey);
        
        const raceList = weekRaces.map(race => this.formatRaceItem(race, true)).join('\n');

        embed.addFields([{
          name: `Week ${weekIndex + 1}: ${weekStart} - ${weekEnd}`,
          value: raceList || '📭 No races this week',
          inline: false
        }]);
      }

      const uniqueMembers = new Set(races.map(race => race.memberName));
      embed.setFooter({ 
        text: `${races.length} race${races.length === 1 ? '' : 's'} scheduled • ${uniqueMembers.size} team member${uniqueMembers.size === 1 ? '' : 's'} participating 🏁` 
      });
    }

    return embed;
  }

  /**
   * Group races by week for monthly display
   */
  groupRacesByWeek(races) {
    const weeks = {};
    
    for (const race of races) {
      const raceDate = new Date(race.race_date + 'T00:00:00');
      const weekStart = this.getWeekStartForDate(raceDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekKey = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      
      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey].push(race);
    }
    
    return weeks;
  }

  /**
   * Get start of current week (Monday)
   */
  getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === DATE.SUNDAY ? DATE.WEEK_ADJUSTMENT_SUNDAY : DATE.WEEK_ADJUSTMENT_OTHER); // Adjust when day is Sunday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Get end of current week (Sunday)
   */
  getWeekEnd() {
    const weekStart = this.getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  /**
   * Get start of current month
   */
  getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Get end of current month
   */
  getMonthEnd() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  /**
   * Get week start for a specific date
   */
  getWeekStartForDate(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === DATE.SUNDAY ? DATE.WEEK_ADJUSTMENT_SUNDAY : DATE.WEEK_ADJUSTMENT_OTHER); // Adjust when day is Sunday
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Manually trigger weekly race announcement (for testing)
   */
  async triggerWeeklyAnnouncement() {
    logger.scheduler.info('Manually triggering weekly race announcement');
    await this.postWeeklyRaces();
  }

  /**
   * Manually trigger monthly race announcement (for testing)
   */
  async triggerMonthlyAnnouncement() {
    logger.scheduler.info('Manually triggering monthly race announcement');
    await this.postMonthlyRaces();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size
    };
  }

  /**
   * Stop all scheduled jobs
   */
  async shutdown() {
    logger.scheduler.info('Shutting down scheduler...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      job.destroy();
      logger.scheduler.info(`Stopped ${name} job`);
    }
    
    this.jobs.clear();
    this.isInitialized = false;
    
    logger.scheduler.info('Scheduler shutdown complete');
  }
}

module.exports = Scheduler;