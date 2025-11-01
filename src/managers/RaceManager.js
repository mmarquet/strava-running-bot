const databaseManager = require('../database/DatabaseManager');
const logger = require('../utils/Logger');
const { VALIDATION, DATE, RACE_EMOJI } = require('../constants');
const DateUtils = require('../utils/DateUtils');

class RaceManager {
  constructor() {
    this.databaseManager = databaseManager;
  }

  async initialize() {
    // Database manager will be initialized by the main application
    return;
  }

  // Add a new race for a member
  async addRace(discordUserId, raceData) {
    try {
      // Get member by Discord ID
      const member = await this.databaseManager.getMemberByDiscordId(discordUserId);
      
      if (!member?.isActive) {
        throw new Error('Member not found or inactive');
      }

      // Validate race data
      this.validateRaceData(raceData);

      // Add the race
      const race = await this.databaseManager.addRace(member.athleteId, {
        name: raceData.name.trim(),
        raceDate: raceData.raceDate,
        raceType: raceData.raceType || 'road',
        distance: raceData.distance?.trim() || null,
        distanceKm: raceData.distanceKm?.trim() || null,
        location: raceData.location?.trim() || null,
        notes: raceData.notes?.trim() || null,
        goalTime: raceData.goalTime?.trim() || null,
        status: 'registered'
      });

      logger.database.info('Race added for member', {
        raceId: race.id,
        discordUserId,
        athleteId: member.athleteId,
        raceName: raceData.name,
        raceDate: raceData.raceDate,
        raceType: raceData.raceType
      });

      return race;

    } catch (error) {
      logger.database.error('Failed to add race', {
        discordUserId,
        raceData,
        error: error.message
      });
      throw error;
    }
  }

  // Update an existing race
  async updateRace(raceId, discordUserId, updates) {
    try {
      // Get the race first to check ownership
      const race = await this.getRace(raceId);
      
      if (!race) {
        throw new Error('Race not found');
      }

      // Verify the user owns this race
      const member = await this.databaseManager.getMemberByDiscordId(discordUserId);
      if (!member || race.member_athlete_id !== member.athleteId) {
        throw new Error('You can only update your own races');
      }

      // Validate updates
      if (updates.name) updates.name = updates.name.trim();
      if (updates.distance) updates.distance = updates.distance.trim();
      if (updates.location) updates.location = updates.location.trim();
      if (updates.notes) updates.notes = updates.notes.trim();
      if (updates.goal) updates.goal_time = updates.goal; // Map goal to goal_time
      if (updates.goalTime) updates.goal_time = updates.goalTime.trim(); // Also handle goalTime directly
      if (updates.date) updates.race_date = updates.date; // Map date to race_date
      if (updates.raceDate) updates.race_date = updates.raceDate; // Also handle raceDate directly
      
      // Clean up any unmapped fields to avoid column errors
      delete updates.goal;
      delete updates.date;
      delete updates.raceDate;
      delete updates.goalTime;

      // Update the race
      const updatedRace = await this.databaseManager.updateRace(raceId, updates);

      logger.database.info('Race updated', {
        raceId,
        discordUserId,
        updates
      });

      return updatedRace;

    } catch (error) {
      logger.database.error('Failed to update race', {
        raceId,
        discordUserId,
        updates,
        error: error.message
      });
      throw error;
    }
  }

  // Remove a race
  async removeRace(raceId, discordUserId) {
    try {
      // Get the race first to check ownership
      const race = await this.getRace(raceId);
      
      if (!race) {
        throw new Error('Race not found');
      }

      // Verify the user owns this race
      const member = await this.databaseManager.getMemberByDiscordId(discordUserId);
      if (!member || race.member_athlete_id !== member.athleteId) {
        throw new Error('You can only remove your own races');
      }

      // Remove the race
      const removedRace = await this.databaseManager.removeRace(raceId);

      logger.database.info('Race removed', {
        raceId,
        discordUserId,
        raceName: removedRace.name
      });

      return removedRace;

    } catch (error) {
      logger.database.error('Failed to remove race', {
        raceId,
        discordUserId,
        error: error.message
      });
      throw error;
    }
  }

  // Get a specific race by ID
  async getRace(raceId) {
    try {
      const { races } = require('../database/schema');
      const { eq } = require('drizzle-orm');
      
      return await this.databaseManager.db.select()
        .from(races)
        .where(eq(races.id, Number.parseInt(raceId, 10)))
        .get();
    } catch (error) {
      logger.database.error('Failed to get race by ID', { raceId, error: error.message });
      return null;
    }
  }

  // Get all races for a specific member
  async getMemberRaces(discordUserId, options = {}) {
    try {
      const member = await this.databaseManager.getMemberByDiscordId(discordUserId);
      
      if (!member) {
        return [];
      }

      return await this.databaseManager.getMemberRaces(member.athleteId, options);

    } catch (error) {
      logger.database.error('Failed to get member races', {
        discordUserId,
        options,
        error: error.message
      });
      return [];
    }
  }

  // Get upcoming races for all members
  async getUpcomingRaces(daysAhead = 30) {
    try {
      return await this.databaseManager.getUpcomingRaces(daysAhead);
    } catch (error) {
      logger.database.error('Failed to get upcoming races', {
        daysAhead,
        error: error.message
      });
      return [];
    }
  }

  // Get all races with optional filters
  async getAllRaces(options = {}) {
    try {
      return await this.databaseManager.getAllRaces(options);
    } catch (error) {
      logger.database.error('Failed to get all races', {
        options,
        error: error.message
      });
      return [];
    }
  }

  // Mark race as completed
  async completeRace(raceId, discordUserId, completionData = {}) {
    const updates = {
      status: 'completed',
      actualTime: completionData.actualTime || null,
      stravaActivityId: completionData.stravaActivityId || null,
      notes: completionData.notes || null
    };

    return await this.updateRace(raceId, discordUserId, updates);
  }

  // Mark race as cancelled
  async cancelRace(raceId, discordUserId, reason = null) {
    const updates = {
      status: 'cancelled',
      notes: reason || null
    };

    return await this.updateRace(raceId, discordUserId, updates);
  }

  // Get race statistics
  async getRaceStats() {
    try {
      const stats = await this.databaseManager.getStats();
      return stats.races;
    } catch (error) {
      logger.database.error('Failed to get race stats', error);
      return { total: 0, upcoming: 0 };
    }
  }

  // Helper: Validate race date
  _validateRaceDate(raceDate) {
    if (!raceDate) {
      throw new TypeError('Race date is required');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(raceDate)) {
      throw new TypeError('Race date must be in YYYY-MM-DD format');
    }

    const date = new Date(raceDate + 'T00:00:00');
    if (Number.isNaN(date.getTime())) {
      throw new TypeError('Invalid race date');
    }
  }

  // Helper: Validate distance
  _validateDistance(distanceKm) {
    if (!distanceKm) return;

    const distance = Number.parseFloat(distanceKm);
    if (Number.isNaN(distance) || distance <= VALIDATION.MIN_DISTANCE) {
      throw new TypeError('Distance must be a positive number');
    }
    if (distance > VALIDATION.MAX_DISTANCE) {
      throw new TypeError(`Distance cannot exceed ${VALIDATION.MAX_DISTANCE}km`);
    }
  }

  // Helper: Validate field lengths
  _validateFieldLengths(raceData) {
    const validations = [
      { field: 'name', maxLength: VALIDATION.MAX_NAME_LENGTH, label: 'Race name' },
      { field: 'distance', maxLength: VALIDATION.MAX_DISTANCE_STRING_LENGTH, label: 'Distance' },
      { field: 'location', maxLength: VALIDATION.MAX_LOCATION_LENGTH, label: 'Location' },
      { field: 'notes', maxLength: VALIDATION.MAX_NOTES_LENGTH, label: 'Notes' },
      { field: 'goalTime', maxLength: VALIDATION.MAX_GOAL_TIME_LENGTH, label: 'Goal time' }
    ];

    for (const { field, maxLength, label } of validations) {
      const value = field === 'name' ? raceData[field]?.trim() : raceData[field];
      if (value && value.length > maxLength) {
        throw new TypeError(`${label} cannot exceed ${maxLength} characters`);
      }
    }
  }

  // Validate race data
  validateRaceData(raceData) {
    if (!raceData.name || raceData.name.trim().length === 0) {
      throw new TypeError('Race name is required');
    }

    this._validateRaceDate(raceData.raceDate);

    // Validate race type
    if (raceData.raceType && !['road', 'trail'].includes(raceData.raceType)) {
      throw new TypeError('Race type must be either "road" or "trail"');
    }

    this._validateDistance(raceData.distanceKm);
    this._validateFieldLengths(raceData);
  }

  // Format race for display
  formatRaceDisplay(race, includeStatus = true) {
    let display = `**${race.name}**`;
    
    // Add race type emoji
    const typeEmoji = race.race_type === 'trail' ? '🏔️' : '🛣️';
    const typeLabel = race.race_type === 'trail' ? 'Trail' : 'Road';
    
    if (race.race_date) {
      const date = new Date(race.race_date + 'T00:00:00');
      display += ` - ${date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`;
    }

    display += `\n${typeEmoji} ${typeLabel} Race`;

    if (race.distance) {
      display += ` (${race.distance})`;
    }

    if (race.location) {
      display += `\n📍 ${race.location}`;
    }

    if (race.goal_time) {
      display += `\n🎯 Goal: ${race.goal_time}`;
    }

    if (race.actual_time && race.status === 'completed') {
      display += `\n⏱️ Time: ${race.actual_time}`;
    }

    if (includeStatus) {
      display += `\n${RACE_EMOJI[race.status] || '❓'} ${race.status.toUpperCase()}`;
    }

    if (race.notes) {
      display += `\n💬 ${race.notes}`;
    }

    return display;
  }

  // Get race status emoji
  getStatusEmoji(status) {
    return RACE_EMOJI[status] || '❓';
  }

  // Check if race date is in the future
  isUpcoming(raceDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const race = new Date(raceDate + 'T00:00:00');
    return race >= today;
  }

  // Get days until race
  getDaysUntilRace(raceDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const race = new Date(raceDate + 'T00:00:00');
    const diffTime = race - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  // Get races for the current week (Monday to Sunday)
  async getWeeklyRaces() {
    try {
      const weekStart = this.getWeekStart();
      const weekEnd = this.getWeekEnd();
      
      const startDate = this.formatDateForQuery(weekStart);
      const endDate = this.formatDateForQuery(weekEnd);
      
      logger.database.info('Fetching weekly races', {
        weekStart: startDate,
        weekEnd: endDate
      });

      const races = await this.databaseManager.getRacesByDateRange(startDate, endDate, {
        status: 'registered' // Only get upcoming races
      });

      // Sort by race date
      races.sort((a, b) => new Date(a.race_date) - new Date(b.race_date));

      return races;

    } catch (error) {
      logger.database.error('Error fetching weekly races', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Get races for the current month
  async getMonthlyRaces() {
    try {
      const monthStart = this.getMonthStart();
      const monthEnd = this.getMonthEnd();
      
      const startDate = this.formatDateForQuery(monthStart);
      const endDate = this.formatDateForQuery(monthEnd);
      
      logger.database.info('Fetching monthly races', {
        monthStart: startDate,
        monthEnd: endDate
      });

      const races = await this.databaseManager.getRacesByDateRange(startDate, endDate, {
        status: 'registered' // Only get upcoming races
      });

      // Sort by race date
      races.sort((a, b) => new Date(a.race_date) - new Date(b.race_date));

      return races;

    } catch (error) {
      logger.database.error('Error fetching monthly races', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Get start of current week (Monday)
  getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === DATE.SUNDAY ? DATE.WEEK_ADJUSTMENT_SUNDAY : DATE.WEEK_ADJUSTMENT_OTHER); // Adjust when day is Sunday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // Get end of current week (Sunday)
  getWeekEnd() {
    const weekStart = this.getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  // Get start of current month
  getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Get end of current month
  getMonthEnd() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Format date for database query (YYYY-MM-DD)
  formatDateForQuery(date) {
    return DateUtils.formatDateOnly(date);
  }
}

module.exports = RaceManager;