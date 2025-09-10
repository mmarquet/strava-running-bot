const { EmbedBuilder } = require('discord.js');
const config = require('../../config/config');
const ActivityEmbedBuilder = require('../../src/utils/EmbedBuilder');
const ActivityFormatter = require('../../src/utils/ActivityFormatter');


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

// Mock EmbedBuilder methods
const mockEmbedBuilder = {
  setTitle: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setURL: jest.fn().mockReturnThis(),
  setAuthor: jest.fn().mockReturnThis(),
  setFooter: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  setImage: jest.fn().mockReturnThis()
};

// Mock dependencies  
jest.mock('discord.js', () => ({
  EmbedBuilder: jest.fn().mockImplementation(() => mockEmbedBuilder)
}));
jest.mock('../../src/utils/ActivityFormatter');

describe('ActivityEmbedBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    ActivityFormatter.escapeDiscordMarkdown.mockImplementation(text => text);
    ActivityFormatter.getActivityTypeColor.mockReturnValue('#FC4C02');
    ActivityFormatter.getActivityTypeIcon.mockReturnValue('🏃');
    ActivityFormatter.formatDistance.mockReturnValue('5.00 km');
    ActivityFormatter.formatTime.mockReturnValue('30:00');
    ActivityFormatter.formatPace.mockReturnValue('6:00/km');
    ActivityFormatter.generateStaticMapUrl.mockReturnValue('https://maps.googleapis.com/maps/api/staticmap?test');
  });

  describe('createActivityEmbed', () => {
    const mockActivity = {
      id: 12345,
      name: 'Morning Run',
      type: 'Run',
      description: 'Great run in the park',
      distance: 5000,
      moving_time: 1800,
      elapsed_time: 2100,
      total_elevation_gain: 150,
      average_heartrate: 145,
      start_date: '2024-01-01T10:00:00Z',
      map: {
        summary_polyline: 'encoded_polyline_data'
      },
      athlete: {
        id: 67890,
        firstname: 'John',
        lastname: 'Doe',
        discordUser: {
          username: 'johndoe',
          displayName: 'John Doe',
          avatarURL: 'https://cdn.discordapp.com/avatars/123/avatar.png'
        }
      }
    };

    it('should create basic embed with default options', () => {
      const embed = ActivityEmbedBuilder.createActivityEmbed(mockActivity);

      expect(EmbedBuilder).toHaveBeenCalledTimes(1);
      expect(mockEmbedBuilder.setTitle).toHaveBeenCalledWith('🏃 Morning Run');
      expect(mockEmbedBuilder.setColor).toHaveBeenCalledWith('#FC4C02');
      expect(mockEmbedBuilder.setTimestamp).toHaveBeenCalledWith(new Date('2024-01-01T10:00:00Z'));
      expect(mockEmbedBuilder.setURL).toHaveBeenCalledWith('https://www.strava.com/activities/12345');
      expect(ActivityFormatter.escapeDiscordMarkdown).toHaveBeenCalledWith('Morning Run');
      expect(ActivityFormatter.getActivityTypeColor).toHaveBeenCalledWith('Run');
    });

    it('should create embed with posted type', () => {
      ActivityEmbedBuilder.createActivityEmbed(mockActivity, { type: 'posted' });

      expect(mockEmbedBuilder.setAuthor).toHaveBeenCalledWith({
        name: 'John Doe',
        iconURL: 'https://cdn.discordapp.com/avatars/123/avatar.png'
      });
      expect(mockEmbedBuilder.setFooter).toHaveBeenCalledWith({
        iconURL: 'https://cdn.worldvectorlogo.com/logos/strava-1.svg',
        text: 'Powered by Strava'
      });
    });

    it('should create embed with latest type', () => {
      ActivityEmbedBuilder.createActivityEmbed(mockActivity, { type: 'latest' });

      expect(mockEmbedBuilder.setAuthor).toHaveBeenCalledWith({
        name: 'John Doe - Last Activity',
        iconURL: 'https://cdn.discordapp.com/avatars/123/avatar.png'
      });
      expect(mockEmbedBuilder.setFooter).toHaveBeenCalledWith({
        iconURL: 'https://cdn.worldvectorlogo.com/logos/strava-1.svg',
        text: 'Latest Activity • Powered by Strava'
      });
    });

    it('should handle activity with description', () => {
      ActivityEmbedBuilder.createActivityEmbed(mockActivity);

      expect(mockEmbedBuilder.setDescription).toHaveBeenCalledWith('Great run in the park');
      expect(ActivityFormatter.escapeDiscordMarkdown).toHaveBeenCalledWith('Great run in the park');
    });

    it('should handle activity without description', () => {
      const activityWithoutDescription = { ...mockActivity };
      delete activityWithoutDescription.description;

      ActivityEmbedBuilder.createActivityEmbed(activityWithoutDescription);

      expect(mockEmbedBuilder.setDescription).not.toHaveBeenCalled();
    });

    it('should handle empty description', () => {
      const activityWithEmptyDescription = { ...mockActivity, description: '' };

      ActivityEmbedBuilder.createActivityEmbed(activityWithEmptyDescription);

      expect(mockEmbedBuilder.setDescription).not.toHaveBeenCalled();
    });

    it('should add core activity fields', () => {
      ActivityEmbedBuilder.createActivityEmbed(mockActivity);

      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(1,[
        { name: '📏 Distance', value: '5.00 km', inline: true },
        { name: '⏱️ Time', value: '30:00', inline: true }
      ]);

      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(2, [ 
        { name: '🏃 Pace', value: '6:00/km', inline: true } 
      ]);
      expect(ActivityFormatter.formatDistance).toHaveBeenCalledWith(5000);
      expect(ActivityFormatter.formatTime).toHaveBeenCalledWith(1800);
      expect(ActivityFormatter.formatPace).toHaveBeenCalledWith(5000, 1800);
    });

    it('should add optional elevation field when present', () => {
      // Create activity with only elevation data
      const activityWithElevation = {
        ...mockActivity,
        average_heartrate: undefined
      };

      ActivityEmbedBuilder.createActivityEmbed(activityWithElevation);

      // Should be called 3 times - twice for core fields, once for elevation
      expect(mockEmbedBuilder.addFields).toHaveBeenCalledTimes(3);
      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(3, [
        { name: '⛰️ Elevation Gain', value: '150m', inline: true }
      ]);
    });

    it('should add optional heart rate field when present', () => {
      const activityWithHR = { ...mockActivity, average_heartrate: 145 };
      ActivityEmbedBuilder.createActivityEmbed(activityWithHR);

      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(3, [{
        name: '❤️ Avg Heart Rate',
        value: '145 bpm',
        inline: true,
      }]);
    });

    it('should handle activity without optional fields', () => {
      const minimalActivity = {
        ...mockActivity,
        total_elevation_gain: 0,
        average_heartrate: null
      };

      ActivityEmbedBuilder.createActivityEmbed(minimalActivity);

      // Only core fields should be added
      expect(mockEmbedBuilder.addFields).toHaveBeenCalledTimes(2);
    });

    it('should add map image when available', () => {
      ActivityFormatter.generateStaticMapUrl.mockReturnValue('https://maps.test.com/map.png');
      
      ActivityEmbedBuilder.createActivityEmbed(mockActivity);

      expect(mockEmbedBuilder.setImage).toHaveBeenCalledWith('https://maps.test.com/map.png');
      expect(ActivityFormatter.generateStaticMapUrl).toHaveBeenCalledWith('encoded_polyline_data');
    });

    it('should handle activity without map', () => {
      const activityWithoutMap = { ...mockActivity };
      delete activityWithoutMap.map;

      ActivityEmbedBuilder.createActivityEmbed(activityWithoutMap);

      expect(mockEmbedBuilder.setImage).not.toHaveBeenCalled();
      expect(ActivityFormatter.generateStaticMapUrl).not.toHaveBeenCalled();
    });

    it('should handle map without polyline', () => {
      const activityWithEmptyMap = { ...mockActivity, map: {} };

      ActivityEmbedBuilder.createActivityEmbed(activityWithEmptyMap);

      expect(mockEmbedBuilder.setImage).not.toHaveBeenCalled();
    });

    it('should handle null map URL response', () => {
      ActivityFormatter.generateStaticMapUrl.mockReturnValue(null);
      
      ActivityEmbedBuilder.createActivityEmbed(mockActivity);

      expect(mockEmbedBuilder.setImage).not.toHaveBeenCalled();
    });

    it('should handle activity with athlete but no Discord user', () => {
      const activityWithoutDiscordUser = {
        ...mockActivity,
        athlete: {
          ...mockActivity.athlete,
          discordUser: null
        }
      };

      ActivityEmbedBuilder.createActivityEmbed(activityWithoutDiscordUser);

      expect(mockEmbedBuilder.setAuthor).toHaveBeenCalledWith({
        name: 'John Doe',
        iconURL: undefined
      });
    });

    it('should handle activity without athlete', () => {
      const activityWithoutAthlete = { ...mockActivity };
      delete activityWithoutAthlete.athlete;

      ActivityEmbedBuilder.createActivityEmbed(activityWithoutAthlete);

      expect(mockEmbedBuilder.setAuthor).toHaveBeenCalledWith({
        name: 'Unknown Athlete',
        iconURL: undefined
      });
    });

    it('should handle different activity types', () => {
      const rideActivity = { ...mockActivity, type: 'Ride' };
      ActivityFormatter.getActivityTypeColor.mockReturnValue('#0074D9');

      ActivityEmbedBuilder.createActivityEmbed(rideActivity);

      expect(ActivityFormatter.getActivityTypeColor).toHaveBeenCalledWith('Ride');
      expect(mockEmbedBuilder.setColor).toHaveBeenCalledWith('#0074D9');
    });

    it('should escape markdown in activity name', () => {
      const activityWithMarkdown = { ...mockActivity, name: 'Run with *bold* text' };
      ActivityFormatter.escapeDiscordMarkdown.mockReturnValue('Run with \\*bold\\* text');

      ActivityEmbedBuilder.createActivityEmbed(activityWithMarkdown);

      expect(mockEmbedBuilder.setTitle).toHaveBeenCalledWith('🏃 Run with \\*bold\\* text');
      expect(ActivityFormatter.escapeDiscordMarkdown).toHaveBeenCalledWith('Run with *bold* text');
    });

    it('should escape markdown in description', () => {
      const activityWithMarkdownDesc = { ...mockActivity, description: 'Great **run** in the park' };
      ActivityFormatter.escapeDiscordMarkdown.mockReturnValue('Great \\*\\*run\\*\\* in the park');

      ActivityEmbedBuilder.createActivityEmbed(activityWithMarkdownDesc);

      expect(mockEmbedBuilder.setDescription).toHaveBeenCalledWith('Great \\*\\*run\\*\\* in the park');
    });

    it('should return the embed instance', () => {
      const result = ActivityEmbedBuilder.createActivityEmbed(mockActivity);
      
      expect(result).toBe(mockEmbedBuilder);
    });

    it('should handle activities with zero values', () => {
      const zeroActivity = {
        ...mockActivity,
        distance: 0,
        moving_time: 0,
        total_elevation_gain: 0,
        average_heartrate: 0
      };

      ActivityFormatter.formatDistance.mockReturnValue('0.00 km');
      ActivityFormatter.formatTime.mockReturnValue('0:00');
      ActivityFormatter.formatPace.mockReturnValue('N/A');

      ActivityEmbedBuilder.createActivityEmbed(zeroActivity);

      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(1,[
        { name: '📏 Distance', value: '0.00 km', inline: true },
        { name: '⏱️ Time', value: '0:00', inline: true }
      ]);
      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(2, [
        { name: '🏃 Pace', value: 'N/A', inline: true }
      ]);
    });
  });

  describe('private methods behavior through createActivityEmbed', () => {
    const mockActivity = {
      id: 12345,
      name: 'Test Activity',
      type: 'Run',
      distance: 5000,
      moving_time: 1800,
      start_date: '2024-01-01T10:00:00Z',
      athlete: {
        firstname: 'Jane',
        lastname: 'Smith',
        discordUser: {
          displayName: 'Jane Smith',
          avatarURL: 'https://example.com/avatar.png'
        }
      }
    };

    it('should handle all combinations of optional fields', () => {
      // Test with elevation but no heart rate
      const activityWithElevation = {
        ...mockActivity,
        total_elevation_gain: 200,
        average_heartrate: null
      };

      ActivityEmbedBuilder.createActivityEmbed(activityWithElevation);
      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(3, [
        { name: '⛰️ Elevation Gain', value: '200m', inline: true }
      ]);
    });

    it('should handle heart rate but no elevation', () => {
      const activityWithHR = {
        ...mockActivity,
        total_elevation_gain: 0,
        average_heartrate: 160
      };

      ActivityEmbedBuilder.createActivityEmbed(activityWithHR);
      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(3, [
        { name: '❤️ Avg Heart Rate', value: '160 bpm', inline: true }
      ]);
    });

    it('should handle both elevation and heart rate', () => {
      const activityWithBoth = {
        ...mockActivity,
        total_elevation_gain: 300,
        average_heartrate: 155
      };

      ActivityEmbedBuilder.createActivityEmbed(activityWithBoth);
      // Heart rate is added first
      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(3, [
        { name: '❤️ Avg Heart Rate', value: '155 bpm', inline: true }
      ]);

      // Then elevation
      expect(mockEmbedBuilder.addFields).toHaveBeenNthCalledWith(4, [
        { name: '⛰️ Elevation Gain', value: '300m', inline: true }
      ]);
    });
  });
});