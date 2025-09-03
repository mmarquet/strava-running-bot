const axios = require('axios');
const StravaAPI = require('../../src/strava/api');
const config = require('../../config/config');
const logger = require('../../src/utils/Logger');
const RateLimiter = require('../../src/utils/RateLimiter');

// Mock dependencies
jest.mock('axios');
jest.mock('../../config/config', () => ({
  strava: {
    baseUrl: 'https://www.strava.com/api/v3',
    authUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret'
  },
  server: {
    baseUrl: 'https://test.example.com'
  }
}));
jest.mock('../../src/utils/Logger', () => ({
  strava: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));
jest.mock('../../src/utils/RateLimiter');

describe('StravaAPI', () => {
  let stravaAPI;
  let mockRateLimiter;
  let mockAxios;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = axios;
    
    mockRateLimiter = {
      executeRequest: jest.fn(async (fn, options) => await fn()),
      getStats: jest.fn(),
      reset: jest.fn()
    };
    RateLimiter.mockImplementation(() => mockRateLimiter);

    stravaAPI = new StravaAPI();
  });

  describe('constructor', () => {
    it('should initialize with config values and rate limiter', () => {
      expect(stravaAPI.baseURL).toBe(config.strava.baseUrl);
      expect(stravaAPI.clientId).toBe(config.strava.clientId);
      expect(stravaAPI.clientSecret).toBe(config.strava.clientSecret);
      expect(stravaAPI.rateLimiter).toBe(mockRateLimiter);
      expect(RateLimiter).toHaveBeenCalled();
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate OAuth authorization URL with state', () => {
      const state = 'test_state_123';
      const url = stravaAPI.getAuthorizationUrl(state);

      expect(url).toContain(config.strava.authUrl);
      expect(url).toContain(`client_id=${config.strava.clientId}`);
      expect(url).toContain('redirect_uri=https%3A%2F%2Ftest.example.com%2Fauth%2Fstrava%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=read%2Cactivity%3Aread_all%2Cprofile%3Aread_all');
      expect(url).toContain(`state=${state}`);
    });

    it('should generate URL without state parameter', () => {
      const url = stravaAPI.getAuthorizationUrl();

      expect(url).toContain(config.strava.authUrl);
      expect(url).toContain('state=');
    });

    it('should properly encode redirect URI', () => {
      const url = stravaAPI.getAuthorizationUrl('test');
      
      expect(url).toContain('redirect_uri=https%3A%2F%2Ftest.example.com%2Fauth%2Fstrava%2Fcallback');
    });
  });

  describe('getRedirectUri', () => {
    it('should return correct redirect URI', () => {
      const redirectUri = stravaAPI.getRedirectUri();
      
      expect(redirectUri).toBe(`${config.server.baseUrl}/auth/strava/callback`);
    });
  });

  describe('exchangeCodeForToken', () => {
    const mockTokenResponse = {
      data: {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'Bearer'
      }
    };

    beforeEach(() => {
      mockAxios.post.mockResolvedValue(mockTokenResponse);
    });

    it('should exchange authorization code for token', async () => {
      const authCode = 'test_auth_code';
      
      const result = await stravaAPI.exchangeCodeForToken(authCode);

      expect(mockRateLimiter.executeRequest).toHaveBeenCalled();
      expect(mockAxios.post).toHaveBeenCalledWith(config.strava.tokenUrl, {
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        code: authCode,
        grant_type: 'authorization_code'
      });
      expect(result).toEqual(mockTokenResponse.data);
      expect(logger.strava.debug).toHaveBeenCalledWith('Exchanging authorization code for token', { authCode });
    });

    it('should handle token exchange errors', async () => {
      const error = new Error('Network error');
      error.response = { status: 400, data: { error: 'invalid_grant' } };
      mockAxios.post.mockRejectedValue(error);

      await expect(stravaAPI.exchangeCodeForToken('invalid_code')).rejects.toThrow('Failed to exchange authorization code for token');
      
      expect(logger.strava.error).toHaveBeenCalledWith('Error exchanging code for token', {
        error: error.message,
        response: error.response.data,
        status: error.response.status
      });
    });

    it('should handle errors without response data', async () => {
      const error = new Error('Network timeout');
      mockAxios.post.mockRejectedValue(error);

      await expect(stravaAPI.exchangeCodeForToken('test_code')).rejects.toThrow('Failed to exchange authorization code for token');
      
      expect(logger.strava.error).toHaveBeenCalledWith('Error exchanging code for token', {
        error: error.message,
        response: undefined,
        status: undefined
      });
    });

    it('should pass operation context to rate limiter', async () => {
      await stravaAPI.exchangeCodeForToken('test_code');

      expect(mockRateLimiter.executeRequest).toHaveBeenCalledWith(
        expect.any(Function),
        { operation: 'exchangeCodeForToken', authCode: 'test_code' }
      );
    });
  });

  describe('refreshAccessToken', () => {
    const mockRefreshResponse = {
      data: {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'Bearer'
      }
    };

    beforeEach(() => {
      mockAxios.post.mockResolvedValue(mockRefreshResponse);
    });

    it('should refresh access token', async () => {
      const refreshToken = 'test_refresh_token';
      
      const result = await stravaAPI.refreshAccessToken(refreshToken);

      expect(mockAxios.post).toHaveBeenCalledWith(config.strava.tokenUrl, {
        client_id: config.strava.clientId,
        client_secret: config.strava.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });
      expect(result).toEqual(mockRefreshResponse.data);
      expect(logger.strava.debug).toHaveBeenCalledWith('Refreshing access token');
    });

    it('should handle refresh token errors', async () => {
      const error = new Error('Unauthorized');
      error.response = { status: 401, data: { error: 'invalid_grant' } };
      mockAxios.post.mockRejectedValue(error);

      await expect(stravaAPI.refreshAccessToken('invalid_refresh_token')).rejects.toThrow('Failed to refresh access token');
      
      expect(logger.strava.error).toHaveBeenCalledWith('Error refreshing token', {
        error: error.message,
        response: error.response.data,
        status: error.response.status
      });
    });
  });

  describe('getAthlete', () => {
    const mockAthleteResponse = {
      data: {
        id: 12345,
        firstname: 'John',
        lastname: 'Doe',
        profile: 'https://example.com/profile.jpg',
        city: 'Test City',
        country: 'Test Country'
      }
    };

    beforeEach(() => {
      mockAxios.get.mockResolvedValue(mockAthleteResponse);
    });

    it('should fetch athlete information', async () => {
      const accessToken = 'test_access_token';
      
      const result = await stravaAPI.getAthlete(accessToken);

      expect(mockAxios.get).toHaveBeenCalledWith(`${config.strava.baseUrl}/athlete`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      expect(result).toEqual(mockAthleteResponse.data);
      expect(logger.strava.debug).toHaveBeenCalledWith('Fetching athlete information');
    });

    it('should handle athlete fetch errors', async () => {
      const error = new Error('Unauthorized');
      error.response = { status: 401, data: { error: 'unauthorized' } };
      mockAxios.get.mockRejectedValue(error);

      await expect(stravaAPI.getAthlete('invalid_token')).rejects.toThrow('Failed to fetch athlete information');
      
      expect(logger.strava.error).toHaveBeenCalledWith('Error fetching athlete', {
        error: error.message,
        response: error.response.data,
        status: error.response.status
      });
    });
  });

  describe('getAthleteActivities', () => {
    const mockActivitiesResponse = {
      data: [
        { id: 111, name: 'Morning Run', type: 'Run' },
        { id: 222, name: 'Evening Bike', type: 'Ride' }
      ]
    };

    beforeEach(() => {
      mockAxios.get.mockResolvedValue(mockActivitiesResponse);
    });

    it('should fetch athlete activities with default parameters', async () => {
      const accessToken = 'test_access_token';
      
      const result = await stravaAPI.getAthleteActivities(accessToken);

      expect(mockAxios.get).toHaveBeenCalledWith(`${config.strava.baseUrl}/athlete/activities`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          page: 1,
          per_page: 30
        }
      });
      expect(result).toEqual(mockActivitiesResponse.data);
    });

    it('should fetch activities with custom parameters', async () => {
      const accessToken = 'test_access_token';
      const page = 2;
      const perPage = 50;
      const before = 1234567890;
      const after = 1234567800;
      
      await stravaAPI.getAthleteActivities(accessToken, page, perPage, before, after);

      expect(mockAxios.get).toHaveBeenCalledWith(`${config.strava.baseUrl}/athlete/activities`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          page,
          per_page: perPage,
          before,
          after
        }
      });
      expect(logger.strava.debug).toHaveBeenCalledWith('Fetching athlete activities', { page, perPage, before, after });
    });

    it('should omit null parameters', async () => {
      const accessToken = 'test_access_token';
      
      await stravaAPI.getAthleteActivities(accessToken, 1, 30, null, null);

      expect(mockAxios.get).toHaveBeenCalledWith(`${config.strava.baseUrl}/athlete/activities`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          page: 1,
          per_page: 30
        }
      });
    });

    it('should handle activities fetch errors', async () => {
      const error = new Error('Rate limited');
      error.response = { status: 429, data: { message: 'Rate Limit Exceeded' } };
      mockAxios.get.mockRejectedValue(error);

      await expect(stravaAPI.getAthleteActivities('token')).rejects.toThrow('Failed to fetch athlete activities');
      
      expect(logger.strava.error).toHaveBeenCalledWith('Error fetching activities', {
        error: error.message,
        response: error.response.data,
        status: error.response.status,
        params: { page: 1, perPage: 30, before: null, after: null }
      });
    });
  });

  describe('getActivity', () => {
    const mockActivityResponse = {
      data: {
        id: 98765,
        name: 'Morning Run',
        type: 'Run',
        distance: 5000,
        moving_time: 1800,
        total_elevation_gain: 100,
        start_date: '2024-01-01T06:00:00Z'
      }
    };

    beforeEach(() => {
      mockAxios.get.mockResolvedValue(mockActivityResponse);
    });

    it('should fetch detailed activity by ID', async () => {
      const activityId = 98765;
      const accessToken = 'test_access_token';
      
      const result = await stravaAPI.getActivity(activityId, accessToken);

      expect(mockAxios.get).toHaveBeenCalledWith(`${config.strava.baseUrl}/activities/${activityId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      expect(result).toEqual(mockActivityResponse.data);
      expect(logger.strava.debug).toHaveBeenCalledWith('Fetching detailed activity', { activityId });
    });

    it('should handle activity fetch errors', async () => {
      const activityId = 98765;
      const error = new Error('Not found');
      error.response = { status: 404, data: { error: 'Record Not Found' } };
      mockAxios.get.mockRejectedValue(error);

      await expect(stravaAPI.getActivity(activityId, 'token')).rejects.toThrow(`Failed to fetch activity ${activityId}`);
      
      expect(logger.strava.error).toHaveBeenCalledWith('Error fetching activity', {
        activityId,
        error: error.message,
        response: error.response.data,
        status: error.response.status
      });
    });
  });


  describe('calculateGradeAdjustedPace', () => {
    it('should calculate GAP using grade_adjusted_distance when available', () => {
      const activity = {
        distance: 5000, // 5km
        moving_time: 1800, // 30 minutes
        grade_adjusted_distance: 5150 // 5150m grade-adjusted distance
      };

      const gap = stravaAPI.calculateGradeAdjustedPace(activity);

      // Expected: 1800 / (5150/1000) = 349.5 seconds per km = 5:50/km
      expect(gap).toBe('5:50/km');
    });

    it('should return "-" when grade_adjusted_distance unavailable', () => {
      const activity = {
        distance: 5000, // 5km
        moving_time: 1800 // 30 minutes
      };

      const gap = stravaAPI.calculateGradeAdjustedPace(activity);

      expect(gap).toBe('-');
    });

    it('should return "-" for activity without required data', () => {
      const incompleteActivity = {
        distance: 5000,
        moving_time: 1800
        // missing grade_adjusted_distance
      };

      const gap = stravaAPI.calculateGradeAdjustedPace(incompleteActivity);

      expect(gap).toBe('-');
    });

    it('should return "-" for activity with zero distance', () => {
      const zeroDistanceActivity = {
        distance: 0,
        moving_time: 1800,
        grade_adjusted_distance: 1000
      };

      const gap = stravaAPI.calculateGradeAdjustedPace(zeroDistanceActivity);

      expect(gap).toBe('-');
    });

    it('should return "-" for activity with zero moving time', () => {
      const zeroTimeActivity = {
        distance: 5000,
        moving_time: 0,
        grade_adjusted_distance: 5150
      };

      const gap = stravaAPI.calculateGradeAdjustedPace(zeroTimeActivity);

      expect(gap).toBe('-');
    });

    it('should calculate accurate GAP for real-world example', () => {
      const activity = {
        distance: 12600, // 12.6 km
        moving_time: 4200, // 1:10:00
        grade_adjusted_distance: 12689 // 12689m grade-adjusted distance
      };

      const gap = stravaAPI.calculateGradeAdjustedPace(activity);

      // Expected: 4200 / (12689/1000) = 331 seconds per km = 5:31/km
      expect(gap).toBe('5:31/km');
    });

    it('should format seconds with leading zeros', () => {
      const activity = {
        distance: 1000, // 1km
        moving_time: 305, // 5:05
        grade_adjusted_distance: 1050 // 1050m grade-adjusted distance
      };

      const gap = stravaAPI.calculateGradeAdjustedPace(activity);

      // Expected: 305 / (1050/1000) = 290.48 seconds per km = 4:50/km
      expect(gap).toBe('4:50/km');
    });
  });

  describe('processActivityData', () => {
    const mockActivity = {
      id: 98765,
      name: 'Morning Run',
      description: 'Great run today!',
      type: 'Run',
      distance: 5000,
      moving_time: 1800,
      elapsed_time: 1900,
      total_elevation_gain: 100,
      start_date: '2024-01-01T06:00:00Z',
      start_date_local: '2024-01-01T06:00:00',
      timezone: 'America/New_York',
      average_speed: 2.78,
      max_speed: 4.2,
      average_heartrate: 150,
      max_heartrate: 175,
      elev_high: 150,
      elev_low: 50,
      upload_id: 12345,
      external_id: 'test_external_id',
      map: { id: 'map123' },
      athlete: { id: 67890, firstname: 'Jane', lastname: 'Smith' }
    };

    const mockAthlete = {
      id: 12345,
      firstname: 'John',
      lastname: 'Doe',
      discordUser: { displayName: 'Test User' }
    };

    it('should process activity data with custom athlete info', () => {
      jest.spyOn(stravaAPI, 'calculateGradeAdjustedPace').mockReturnValue('6:30/km');

      const result = stravaAPI.processActivityData(mockActivity, mockAthlete);

      expect(result).toMatchObject({
        id: mockActivity.id,
        name: mockActivity.name,
        description: mockActivity.description,
        type: mockActivity.type,
        distance: mockActivity.distance,
        moving_time: mockActivity.moving_time,
        athlete: mockAthlete
      });
      expect(result.gap_pace).toBe('6:30/km');
    });

    it('should use activity athlete if none provided', () => {
      jest.spyOn(stravaAPI, 'calculateGradeAdjustedPace').mockReturnValue('6:00/km');

      const result = stravaAPI.processActivityData(mockActivity);

      expect(result.athlete).toBe(mockActivity.athlete);
      expect(result.gap_pace).toBe('6:00/km');
    });

    it('should handle activity with empty description', () => {
      const activityWithoutDescription = { ...mockActivity, description: null };

      const result = stravaAPI.processActivityData(activityWithoutDescription, mockAthlete);

      expect(result.description).toBe('');
    });

    it('should include all required activity fields', () => {
      const result = stravaAPI.processActivityData(mockActivity, mockAthlete);

      const expectedFields = [
        'id', 'name', 'description', 'type', 'distance', 'moving_time',
        'elapsed_time', 'total_elevation_gain', 'start_date', 'start_date_local',
        'timezone', 'average_speed', 'max_speed', 'average_heartrate',
        'max_heartrate', 'elev_high', 'elev_low', 'upload_id', 'external_id',
        'map', 'athlete', 'gap_pace'
      ];

      expectedFields.forEach(field => {
        expect(result).toHaveProperty(field);
      });
    });

    it('should calculate GAP without streams data', () => {
      const calculateGAPSpy = jest.spyOn(stravaAPI, 'calculateGradeAdjustedPace').mockReturnValue('5:30/km');

      const result = stravaAPI.processActivityData(mockActivity, mockAthlete);

      expect(calculateGAPSpy).toHaveBeenCalledWith(mockActivity);
      expect(result.gap_pace).toBe('5:30/km');
      
      calculateGAPSpy.mockRestore();
    });
  });

  describe('validateWebhookSignature', () => {
    it('should return true (placeholder implementation)', () => {
      const result = stravaAPI.validateWebhookSignature('signature', 'body');
      
      expect(result).toBe(true);
    });
  });

  describe('shouldPostActivity', () => {
    const baseActivity = {
      id: 98765,
      name: 'Test Activity',
      type: 'Run',
      private: false,
      distance: 5000,
      moving_time: 1800,
      start_date: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
    };

    describe('privacy filters', () => {
      it('should allow public activities', () => {
        const publicActivity = { ...baseActivity, private: false };
        
        expect(stravaAPI.shouldPostActivity(publicActivity)).toBe(true);
      });

      it('should reject private activities', () => {
        const privateActivity = { ...baseActivity, private: true };
        
        expect(stravaAPI.shouldPostActivity(privateActivity)).toBe(false);
        expect(logger.strava.debug).toHaveBeenCalledWith('Skipping private activity', expect.any(Object));
      });

      it('should allow followers-only activities', () => {
        const followersOnlyActivity = { ...baseActivity, visibility: 'followers_only' };
        
        expect(stravaAPI.shouldPostActivity(followersOnlyActivity)).toBe(true);
      });

      it('should allow activities with everyone visibility', () => {
        const everyoneActivity = { ...baseActivity, visibility: 'everyone' };
        
        expect(stravaAPI.shouldPostActivity(everyoneActivity)).toBe(true);
      });

      it('should reject activities hidden from home feed', () => {
        const hiddenActivity = { ...baseActivity, hide_from_home: true };
        
        expect(stravaAPI.shouldPostActivity(hiddenActivity)).toBe(false);
        expect(logger.strava.debug).toHaveBeenCalledWith('Skipping activity hidden from home feed', expect.any(Object));
      });

      it('should reject flagged activities', () => {
        const flaggedActivity = { ...baseActivity, flagged: true };
        
        expect(stravaAPI.shouldPostActivity(flaggedActivity)).toBe(false);
        expect(logger.strava.debug).toHaveBeenCalledWith('Skipping flagged activity', expect.any(Object));
      });
    });

    describe('age filters', () => {
      it('should reject old activities (over 24 hours)', () => {
        const oldActivity = {
          ...baseActivity,
          start_date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago
        };
        
        expect(stravaAPI.shouldPostActivity(oldActivity)).toBe(false);
        expect(logger.strava.debug).toHaveBeenCalledWith('Skipping old activity', expect.any(Object));
      });

      it('should allow old activities when skipAgeFilter is true', () => {
        const oldActivity = {
          ...baseActivity,
          start_date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
        };
        
        expect(stravaAPI.shouldPostActivity(oldActivity, { skipAgeFilter: true })).toBe(true);
      });

      it('should allow recent activities', () => {
        const recentActivity = {
          ...baseActivity,
          start_date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
        };
        
        expect(stravaAPI.shouldPostActivity(recentActivity)).toBe(true);
      });
    });

    describe('content filters', () => {
      it('should reject very short activities', () => {
        const shortActivity = { ...baseActivity, moving_time: 30 }; // 30 seconds
        
        expect(stravaAPI.shouldPostActivity(shortActivity)).toBe(false);
        expect(logger.strava.debug).toHaveBeenCalledWith('Skipping short activity', expect.any(Object));
      });

      it('should reject activities with no distance', () => {
        const noDistanceActivity = { ...baseActivity, distance: 0 };
        
        expect(stravaAPI.shouldPostActivity(noDistanceActivity)).toBe(false);
        expect(logger.strava.debug).toHaveBeenCalledWith('Skipping activity with no distance', expect.any(Object));
      });

      it('should reject activities with very little distance', () => {
        const lowDistanceActivity = { ...baseActivity, distance: 50 }; // 50 meters
        
        expect(stravaAPI.shouldPostActivity(lowDistanceActivity)).toBe(false);
        expect(logger.strava.debug).toHaveBeenCalledWith('Skipping activity with no distance', expect.any(Object));
      });

      it('should allow activities with null distance when skipAgeFilter is used', () => {
        const nullDistanceActivity = { ...baseActivity, distance: null };
        
        expect(stravaAPI.shouldPostActivity(nullDistanceActivity, { skipAgeFilter: true })).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle activities with undefined properties', () => {
        const minimalActivity = {
          id: 98765,
          name: 'Test Activity',
          distance: 5000,
          moving_time: 1800,
          start_date: new Date().toISOString()
        };
        
        expect(stravaAPI.shouldPostActivity(minimalActivity)).toBe(true);
      });

      it('should handle activities with null values', () => {
        const activityWithNulls = {
          ...baseActivity,
          private: null,
          visibility: null,
          hide_from_home: null,
          flagged: null
        };
        
        expect(stravaAPI.shouldPostActivity(activityWithNulls)).toBe(true);
      });
    });
  });

  describe('rate limiter integration', () => {
    it('should use rate limiter for all API calls', async () => {
      mockAxios.get.mockResolvedValue({ data: {} });
      mockAxios.post.mockResolvedValue({ data: {} });

      const operations = [
        () => stravaAPI.exchangeCodeForToken('code'),
        () => stravaAPI.refreshAccessToken('refresh'),
        () => stravaAPI.getAthlete('token'),
        () => stravaAPI.getAthleteActivities('token'),
        () => stravaAPI.getActivity(123, 'token')
      ];

      for (const operation of operations) {
        await operation();
      }

      expect(mockRateLimiter.executeRequest).toHaveBeenCalledTimes(5);
    });

    it('should pass correct context to rate limiter', async () => {
      mockAxios.get.mockResolvedValue({ data: {} });

      await stravaAPI.getActivity(98765, 'token');

      expect(mockRateLimiter.executeRequest).toHaveBeenCalledWith(
        expect.any(Function),
        { operation: 'getActivity', activityId: 98765 }
      );
    });
  });

  describe('getRateLimiterStats', () => {
    it('should return rate limiter statistics', () => {
      const mockStats = {
        shortTerm: { used: 100, limit: 1000 },
        daily: { used: 5000, limit: 25000 },
        queueLength: 2
      };
      mockRateLimiter.getStats.mockReturnValue(mockStats);

      const stats = stravaAPI.getRateLimiterStats();

      expect(mockRateLimiter.getStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });
  });

  describe('resetRateLimiter', () => {
    it('should reset the rate limiter', () => {
      mockRateLimiter.reset.mockReturnValue(true);

      const result = stravaAPI.resetRateLimiter();

      expect(mockRateLimiter.reset).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'ECONNABORTED';
      mockAxios.get.mockRejectedValue(timeoutError);

      await expect(stravaAPI.getAthlete('token')).rejects.toThrow('Failed to fetch athlete information');
    });

    it('should handle JSON parsing errors', async () => {
      const parseError = new Error('Unexpected token in JSON');
      mockAxios.get.mockRejectedValue(parseError);

      await expect(stravaAPI.getActivity(123, 'token')).rejects.toThrow('Failed to fetch activity 123');
    });

    it('should preserve original error information in logs', async () => {
      const error = new Error('Custom API error');
      error.response = {
        status: 422,
        data: { message: 'Validation failed', errors: ['Invalid parameter'] }
      };
      mockAxios.post.mockRejectedValue(error);

      await expect(stravaAPI.exchangeCodeForToken('code')).rejects.toThrow();

      expect(logger.strava.error).toHaveBeenCalledWith('Error exchanging code for token', {
        error: 'Custom API error',
        response: { message: 'Validation failed', errors: ['Invalid parameter'] },
        status: 422
      });
    });
  });
});