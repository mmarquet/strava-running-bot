const ActivityFormatter = require('../../src/utils/ActivityFormatter');

describe('ActivityFormatter', () => {
  describe('getActivityTypeColor', () => {
    it('should return correct color for Run activity', () => {
      const color = ActivityFormatter.getActivityTypeColor('Run');
      expect(color).toBe('#FC4C02');
    });

    it('should return correct color for Ride activity', () => {
      const color = ActivityFormatter.getActivityTypeColor('Ride');
      expect(color).toBe('#0074D9');
    });

    it('should return correct color for VirtualRide activity', () => {
      const color = ActivityFormatter.getActivityTypeColor('VirtualRide');
      expect(color).toBe('#0074D9');
    });

    it('should return default color for unknown activity', () => {
      const color = ActivityFormatter.getActivityTypeColor('UnknownActivity');
      expect(color).toBe('#FC4C02');
    });
  });

  describe('getActivityTypeIcon', () => {
    it('should return correct icon for Run activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('Run');
      expect(icon).toBe('🏃');
    });

    it('should return correct icon for Ride activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('Ride');
      expect(icon).toBe('🚴');
    });

    it('should return correct icon for VirtualRide activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('VirtualRide');
      expect(icon).toBe('🎮');
    });

    it('should return correct icon for Swim activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('Swim');
      expect(icon).toBe('🏊');
    });

    it('should return correct icon for Walk activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('Walk');
      expect(icon).toBe('🚶');
    });

    it('should return correct icon for Hike activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('Hike');
      expect(icon).toBe('🥾');
    });

    it('should return correct icon for Workout activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('Workout');
      expect(icon).toBe('🏋️');
    });

    it('should return default icon for unknown activity', () => {
      const icon = ActivityFormatter.getActivityTypeIcon('UnknownActivity');
      expect(icon).toBe('🏃');
    });
  });

  describe('isVirtualRide', () => {
    it('should return true for activity with type VirtualRide', () => {
      const activity = { type: 'VirtualRide' };
      expect(ActivityFormatter.isVirtualRide(activity)).toBe(true);
    });

    it('should return true for Ride with trainer flag', () => {
      const activity = { type: 'Ride', trainer: true };
      expect(ActivityFormatter.isVirtualRide(activity)).toBe(true);
    });

    it('should return false for regular Ride without trainer flag', () => {
      const activity = { type: 'Ride', trainer: false };
      expect(ActivityFormatter.isVirtualRide(activity)).toBe(false);
    });

    it('should return false for Ride without trainer property', () => {
      const activity = { type: 'Ride' };
      expect(ActivityFormatter.isVirtualRide(activity)).toBe(false);
    });

    it('should return false for Run activity', () => {
      const activity = { type: 'Run' };
      expect(ActivityFormatter.isVirtualRide(activity)).toBe(false);
    });

    it('should return false for Run with trainer flag', () => {
      const activity = { type: 'Run', trainer: true };
      expect(ActivityFormatter.isVirtualRide(activity)).toBe(false);
    });

    it('should return false for null activity', () => {
      expect(ActivityFormatter.isVirtualRide(null)).toBe(false);
    });

    it('should return false for undefined activity', () => {
      expect(ActivityFormatter.isVirtualRide(undefined)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(ActivityFormatter.isVirtualRide({})).toBe(false);
    });
  });

  describe('formatDistance', () => {
    it('should format distance in meters to km', () => {
      const formatted = ActivityFormatter.formatDistance(5000);
      expect(formatted).toBe('5.00 km');
    });

    it('should handle zero distance', () => {
      const formatted = ActivityFormatter.formatDistance(0);
      expect(formatted).toBe('0.00 km');
    });

    it('should handle null distance', () => {
      const formatted = ActivityFormatter.formatDistance(null);
      expect(formatted).toBe('0.00 km');
    });
  });

  describe('formatTime', () => {
    it('should format seconds to HH:MM:SS', () => {
      const formatted = ActivityFormatter.formatTime(3661); // 1:01:01
      expect(formatted).toBe('1:01:01');
    });

    it('should format minutes to MM:SS', () => {
      const formatted = ActivityFormatter.formatTime(61); // 1:01
      expect(formatted).toBe('1:01');
    });

    it('should handle zero time', () => {
      const formatted = ActivityFormatter.formatTime(0);
      expect(formatted).toBe('0:00');
    });
  });

  describe('formatPace', () => {
    it('should calculate pace correctly', () => {
      const pace = ActivityFormatter.formatPace(5000, 1800); // 5km in 30 minutes
      expect(pace).toBe('6:00/km');
    });

    it('should handle zero distance', () => {
      const pace = ActivityFormatter.formatPace(0, 1800);
      expect(pace).toBe('N/A');
    });

    it('should handle zero time', () => {
      const pace = ActivityFormatter.formatPace(5000, 0);
      expect(pace).toBe('0:00/km');
    });
  });

  describe('escapeDiscordMarkdown', () => {
    it('should escape asterisks', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('*bold text*');
      expect(result).toBe('\\*bold text\\*');
    });

    it('should escape underscores', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('_italic text_');
      expect(result).toBe('\\_italic text\\_');
    });

    it('should escape tildes', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('~strikethrough~');
      expect(result).toBe('\\~strikethrough\\~');
    });

    it('should escape backticks', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('`code block`');
      expect(result).toBe('\\`code block\\`');
    });

    it('should escape pipes', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('||spoiler||');
      expect(result).toBe('\\|\\|spoiler\\|\\|');
    });

    it('should escape greater than symbols', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('> quote');
      expect(result).toBe('\\> quote');
    });

    it('should escape @ symbols', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('@everyone');
      expect(result).toBe('\\@everyone');
    });

    it('should escape all markdown characters in one string', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('*bold* _italic_ ~strike~ `code` ||spoiler|| > quote @user');
      expect(result).toBe('\\*bold\\* \\_italic\\_ \\~strike\\~ \\`code\\` \\|\\|spoiler\\|\\| \\> quote \\@user');
    });

    it('should return original value for null input', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown(null);
      expect(result).toBe(null);
    });

    it('should return original value for undefined input', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown(undefined);
      expect(result).toBe(undefined);
    });

    it('should return original value for empty string', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('');
      expect(result).toBe('');
    });

    it('should return original value for non-string input', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown(123);
      expect(result).toBe(123);
    });

    it('should handle strings without markdown characters', () => {
      const result = ActivityFormatter.escapeDiscordMarkdown('normal text');
      expect(result).toBe('normal text');
    });
  });

  describe('generateStaticMapUrl', () => {
    const originalEnv = process.env.GOOGLE_MAPS_API_KEY;

    beforeEach(() => {
      // Set API key for tests
      process.env.GOOGLE_MAPS_API_KEY = 'test_api_key';
    });

    afterEach(() => {
      // Restore original environment
      process.env.GOOGLE_MAPS_API_KEY = originalEnv;
    });

    it('should generate map URL with polyline', () => {
      const polyline = 'encoded_polyline_data';
      const result = ActivityFormatter.generateStaticMapUrl(polyline);
      
      expect(result).toContain('https://maps.googleapis.com/maps/api/staticmap');
      expect(result).toContain('size=600x400');
      expect(result).toContain('maptype=roadmap');
      expect(result).toContain('path=enc%3Aencoded_polyline_data');
      expect(result).toContain('key=test_api_key');
    });

    it('should return null when no API key is set', () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      
      const result = ActivityFormatter.generateStaticMapUrl('test_polyline');
      expect(result).toBe(null);
    });

    it('should return null when API key is empty string', () => {
      process.env.GOOGLE_MAPS_API_KEY = '';
      
      const result = ActivityFormatter.generateStaticMapUrl('test_polyline');
      expect(result).toBe(null);
    });

    it('should handle special characters in polyline', () => {
      const polyline = 'encoded_data_with_special+chars&symbols';
      const result = ActivityFormatter.generateStaticMapUrl(polyline);
      
      expect(result).toContain('path=enc%3Aencoded_data_with_special%2Bchars%26symbols');
    });

    it('should create proper URLSearchParams encoding', () => {
      const polyline = 'test=value&other=param';
      const result = ActivityFormatter.generateStaticMapUrl(polyline);
      
      // Should be properly URL encoded
      expect(result).toContain('path=enc%3Atest%3Dvalue%26other%3Dparam');
      expect(result).not.toContain('path=enc:test=value&other=param');
    });

    it('should handle empty polyline', () => {
      const result = ActivityFormatter.generateStaticMapUrl('');
      
      expect(result).toContain('path=enc%3A');
      expect(result).toContain('key=test_api_key');
    });
  });
});