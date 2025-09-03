const axios = require('axios');
const config = require('../../config/config');
const logger = require('../utils/Logger');
const RateLimiter = require('../utils/RateLimiter');

class StravaAPI {
  constructor() {
    this.baseURL = config.strava.baseUrl;
    this.clientId = config.strava.clientId;
    this.clientSecret = config.strava.clientSecret;
    this.rateLimiter = new RateLimiter();
  }

  // Generate OAuth authorization URL
  getAuthorizationUrl(state = '') {
    const scopes = 'read,activity:read_all,profile:read_all';
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: scopes,
      state: state,
    });

    return `${config.strava.authUrl}?${params.toString()}`;
  }

  getRedirectUri() {
    // This should match your webhook endpoint domain
    return `${config.server.baseUrl}/auth/strava/callback`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(authCode) {
    logger.strava.debug('Exchanging authorization code for token', { authCode });
    
    return this.rateLimiter.executeRequest(async () => {
      try {
        const response = await axios.post(config.strava.tokenUrl, {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: authCode,
          grant_type: 'authorization_code',
        });

        return response.data;
      } catch (error) {
        logger.strava.error('Error exchanging code for token', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw new Error('Failed to exchange authorization code for token');
      }
    }, { operation: 'exchangeCodeForToken', authCode });
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken) {
    logger.strava.debug('Refreshing access token');
    
    return this.rateLimiter.executeRequest(async () => {
      try {
        const response = await axios.post(config.strava.tokenUrl, {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        });

        return response.data;
      } catch (error) {
        logger.strava.error('Error refreshing token', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw new Error('Failed to refresh access token');
      }
    }, { operation: 'refreshAccessToken' });
  }

  // Get athlete information
  async getAthlete(accessToken) {
    logger.strava.debug('Fetching athlete information');
    
    return this.rateLimiter.executeRequest(async () => {
      try {
        const response = await axios.get(`${this.baseURL}/athlete`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        return response.data;
      } catch (error) {
        logger.strava.error('Error fetching athlete', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw new Error('Failed to fetch athlete information');
      }
    }, { operation: 'getAthlete' });
  }

  // Get athlete activities
  async getAthleteActivities(accessToken, page = 1, perPage = 30, before = null, after = null) {
    logger.strava.debug('Fetching athlete activities', { page, perPage, before, after });
    
    return this.rateLimiter.executeRequest(async () => {
      try {
        const params = {
          page: page,
          per_page: perPage,
        };

        if (before) params.before = before;
        if (after) params.after = after;

        const response = await axios.get(`${this.baseURL}/athlete/activities`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: params,
        });

        return response.data;
      } catch (error) {
        logger.strava.error('Error fetching activities', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status,
          params: { page, perPage, before, after }
        });
        throw new Error('Failed to fetch athlete activities');
      }
    }, { operation: 'getAthleteActivities', page, perPage });
  }

  // Get detailed activity by ID
  async getActivity(activityId, accessToken) {
    logger.strava.debug('Fetching detailed activity', { activityId });
    
    return this.rateLimiter.executeRequest(async () => {
      try {
        const response = await axios.get(`${this.baseURL}/activities/${activityId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        return response.data;
      } catch (error) {
        logger.strava.error('Error fetching activity', {
          activityId,
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw new Error(`Failed to fetch activity ${activityId}`);
      }
    }, { operation: 'getActivity', activityId });
  }

  // Get activity streams data
  async getActivityStreams(activityId, accessToken, keys = ['grade_adjusted_distance']) {
    logger.strava.debug('Fetching activity streams', { activityId, keys });
    
    return this.rateLimiter.executeRequest(async () => {
      try {
        const response = await axios.get(`${this.baseURL}/activities/${activityId}/streams`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            keys: keys.join(','),
            key_by_type: true
          }
        });

        return response.data;
      } catch (error) {
        logger.strava.error('Error fetching activity streams', {
          activityId,
          keys,
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw new Error(`Failed to fetch activity streams for ${activityId}`);
      }
    }, { operation: 'getActivityStreams', activityId, keys });
  }

  // Calculate Grade Adjusted Pace (GAP) using streams data when available
  calculateGradeAdjustedPace(activity, streamsData = null) {
    if (!activity.distance || !activity.moving_time) {
      return null;
    }

    // Use streams data if available for accurate GAP calculation
    if (streamsData?.grade_adjusted_distance?.data?.length > 0) {
      
      const gradeAdjustedDistanceData = streamsData.grade_adjusted_distance.data;
      const finalGradeAdjustedDistance = gradeAdjustedDistanceData[gradeAdjustedDistanceData.length - 1];
      
      if (finalGradeAdjustedDistance > 0) {
        const gapInSecondsPerKm = activity.moving_time / (finalGradeAdjustedDistance / 1000);
        const minutes = Math.floor(gapInSecondsPerKm / 60);
        const seconds = Math.round(gapInSecondsPerKm % 60);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
      }
    }

    // Fallback to simplified estimation when streams data is not available
    if (!activity.total_elevation_gain) {
      return null;
    }

    const distanceInKm = activity.distance / 1000;
    const elevationGainPercent = (activity.total_elevation_gain / activity.distance) * 100;
    
    // Simplified GAP calculation: for every 1% grade, add ~3% to pace
    const gradeAdjustment = elevationGainPercent * 0.03;
    const adjustedTime = activity.moving_time * (1 + gradeAdjustment);
    
    const gapInSecondsPerKm = adjustedTime / distanceInKm;
    const minutes = Math.floor(gapInSecondsPerKm / 60);
    const seconds = Math.round(gapInSecondsPerKm % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }

  // Process activity data for Discord display
  processActivityData(activity, athlete = null, streamsData = null) {
    const processedActivity = {
      id: activity.id,
      name: activity.name,
      description: activity.description || '',
      type: activity.type,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      start_date: activity.start_date,
      start_date_local: activity.start_date_local,
      timezone: activity.timezone,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      elev_high: activity.elev_high,
      elev_low: activity.elev_low,
      upload_id: activity.upload_id,
      external_id: activity.external_id,
      map: activity.map,
      athlete: athlete || activity.athlete,
    };

    // Add calculated Grade Adjusted Pace with streams data if available
    processedActivity.gap_pace = this.calculateGradeAdjustedPace(activity, streamsData);

    return processedActivity;
  }

  // Validate webhook signature
  validateWebhookSignature(_signature, _body) {
    // Strava doesn't send HMAC signatures for webhooks, but we can verify the token
    // This is a placeholder for additional security measures if needed
    return true;
  }

  /**
   * Determines if a Strava activity should be posted to Discord.
   * 
   * Activity Visibility Filtering:
   * - Private activities (private: true) are filtered out for privacy
   * - Followers-only activities (visibility: 'followers_only') are allowed
   * - Public activities (visibility: 'everyone' or null) are allowed
   * 
   * This change allows team members to share activities with their followers
   * while still respecting private activity settings.
   * 
   * @param {Object} activity - Strava activity object
   * @param {Object} options - Filtering options
   * @param {boolean} options.skipAgeFilter - If true, don't filter activities older than 24 hours (for /last command)
   * @returns {boolean} - Whether the activity should be posted
   */
  shouldPostActivity(activity, options = {}) {
    const { skipAgeFilter = false } = options;
    
    // Filter out private activities - these should never be shared publicly
    if (activity.private === true) {
      logger.strava.debug('Skipping private activity', {
        name: activity.name,
        private: activity.private,
        activityId: activity.id
      });
      return false;
    }

    // Allow followers-only activities - team members can share with their followers
    // Strava API visibility levels:
    // - 'everyone' or null/undefined: public activities (allowed)
    // - 'followers_only': visible to followers only (allowed as of this update)
    // - private: true: private activities (filtered out above)

    // Skip if activity is hidden from home feed
    if (activity.hide_from_home === true) {
      logger.strava.debug('Skipping activity hidden from home feed', {
        name: activity.name,
        hideFromHome: activity.hide_from_home,
        activityId: activity.id
      });
      return false;
    }

    // Skip if activity is flagged
    if (activity.flagged === true) {
      logger.strava.debug('Skipping flagged activity', {
        name: activity.name,
        flagged: activity.flagged,
        activityId: activity.id
      });
      return false;
    }

    // Skip if activity is too old (more than 24 hours) - but only for webhook posting, not /last command
    if (!skipAgeFilter) {
      const activityDate = new Date(activity.start_date);
      const now = new Date();
      const hoursDiff = (now - activityDate) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        logger.strava.debug('Skipping old activity', {
          name: activity.name,
          hoursOld: hoursDiff.toFixed(1),
          activityDate: activity.start_date
        });
        return false;
      }
    }

    // Skip if activity is too short (less than 1 minute)
    if (activity.moving_time < 60) {
      logger.strava.debug('Skipping short activity', {
        name: activity.name,
        movingTime: activity.moving_time
      });
      return false;
    }

    // Skip if activity has no distance (manual entries)
    if (!activity.distance || activity.distance < 100) {
      logger.strava.debug('Skipping activity with no distance', {
        name: activity.name,
        distance: activity.distance
      });
      return false;
    }

    return true;
  }

  // Get rate limiter statistics
  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  // Reset rate limiter (for testing or manual reset)
  resetRateLimiter() {
    return this.rateLimiter.reset();
  }
}

module.exports = StravaAPI;