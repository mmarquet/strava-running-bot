const AchievementDetector = require('../../src/utils/AchievementDetector');

describe('AchievementDetector', () => {
  describe('detectAchievements', () => {
    it('should detect KOM achievements', () => {
      const activity = {
        id: 12345,
        segment_efforts: [
          {
            id: 123,
            segment: {
              id: 456,
              name: 'Big Hill Climb'
            },
            achievements: ['kom'],
            elapsed_time: 600,
            moving_time: 580,
            distance: 1500,
            kom_rank: 1,
            pr_rank: 1
          }
        ]
      };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(1);
      expect(achievements[0]).toMatchObject({
        type: 'kom',
        emoji: '👑',
        title: 'King of the Mountain!',
        segmentName: 'Big Hill Climb',
        segmentId: 456,
        segmentUrl: 'https://www.strava.com/segments/456'
      });
      expect(achievements[0].gif).toMatch(/giphy\.gif$/);
      expect(typeof achievements[0].gifDescription).toBe('string');
    });

    it('should detect QOM achievements', () => {
      const activity = {
        id: 12345,
        segment_efforts: [
          {
            id: 124,
            segment: {
              id: 457,
              name: 'Sprint Section'
            },
            achievements: ['qom'],
            elapsed_time: 120,
            moving_time: 115,
            distance: 400
          }
        ]
      };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(1);
      expect(achievements[0]).toMatchObject({
        type: 'qom',
        emoji: '👸',
        title: 'Queen of the Mountain!',
        segmentName: 'Sprint Section',
        segmentId: 457
      });
    });

    it('should detect Local Legend achievements', () => {
      const activity = {
        id: 12345,
        segment_efforts: [
          {
            id: 125,
            segment: {
              id: 458,
              name: 'Local Loop'
            },
            achievements: ['local_legend'],
            elapsed_time: 300,
            moving_time: 290,
            distance: 800
          }
        ]
      };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(1);
      expect(achievements[0]).toMatchObject({
        type: 'local_legend',
        emoji: '🏆',
        title: 'Local Legend!',
        segmentName: 'Local Loop',
        segmentId: 458
      });
    });

    it('should detect multiple achievements', () => {
      const activity = {
        id: 12345,
        segment_efforts: [
          {
            id: 123,
            segment: { id: 456, name: 'Hill 1' },
            achievements: ['kom'],
            elapsed_time: 600,
            moving_time: 580,
            distance: 1500
          },
          {
            id: 124,
            segment: { id: 457, name: 'Hill 2' },
            achievements: ['local_legend'],
            elapsed_time: 400,
            moving_time: 380,
            distance: 1200
          }
        ]
      };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(2);
      expect(achievements[0].type).toBe('kom');
      expect(achievements[1].type).toBe('local_legend');
    });

    it('should handle activity without segment_efforts', () => {
      const activity = { id: 12345 };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(0);
    });

    it('should handle empty segment_efforts array', () => {
      const activity = {
        id: 12345,
        segment_efforts: []
      };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(0);
    });

    it('should handle segment efforts without achievements', () => {
      const activity = {
        id: 12345,
        segment_efforts: [
          {
            id: 123,
            segment: { id: 456, name: 'Regular Segment' },
            elapsed_time: 600,
            moving_time: 580,
            distance: 1500
          }
        ]
      };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(0);
    });

    it('should ignore unknown achievement types', () => {
      const activity = {
        id: 12345,
        segment_efforts: [
          {
            id: 123,
            segment: { id: 456, name: 'Test Segment' },
            achievements: ['unknown_achievement', 'kom'],
            elapsed_time: 600,
            moving_time: 580,
            distance: 1500
          }
        ]
      };

      const achievements = AchievementDetector.detectAchievements(activity);

      expect(achievements).toHaveLength(1);
      expect(achievements[0].type).toBe('kom');
    });
  });

  describe('formatAchievementForDiscord', () => {
    it('should format achievement correctly', () => {
      const achievement = {
        type: 'kom',
        emoji: '👑',
        title: 'King of the Mountain!',
        description: 'Claimed the crown on',
        segmentName: 'Big Hill',
        segmentUrl: 'https://www.strava.com/segments/456',
        effort: {
          movingTime: 600,
          distance: 1500
        }
      };

      const formatted = AchievementDetector.formatAchievementForDiscord(achievement);

      expect(formatted).toMatchObject({
        name: '👑 King of the Mountain!',
        value: expect.stringContaining('**Big Hill**'),
        inline: false
      });
      expect(formatted.value).toContain('Time: 10:00');
      expect(formatted.value).toContain('Distance: 1.50km');
      expect(formatted.value).toContain('[View Segment](https://www.strava.com/segments/456)');
    });
  });

  describe('formatEffortTime', () => {
    it('should format time correctly', () => {
      expect(AchievementDetector.formatEffortTime(65)).toBe('1:05');
      expect(AchievementDetector.formatEffortTime(600)).toBe('10:00');
      expect(AchievementDetector.formatEffortTime(3661)).toBe('61:01');
    });

    it('should handle edge cases', () => {
      expect(AchievementDetector.formatEffortTime(0)).toBe('N/A');
      expect(AchievementDetector.formatEffortTime(null)).toBe('N/A');
      expect(AchievementDetector.formatEffortTime(undefined)).toBe('N/A');
    });
  });

  describe('getMostImpressiveAchievement', () => {
    it('should prioritize KOM over Local Legend', () => {
      const achievements = [
        { type: 'local_legend', segmentName: 'Local' },
        { type: 'kom', segmentName: 'KOM' }
      ];

      const result = AchievementDetector.getMostImpressiveAchievement(achievements);

      expect(result.type).toBe('kom');
    });

    it('should prioritize QOM over Local Legend', () => {
      const achievements = [
        { type: 'local_legend', segmentName: 'Local' },
        { type: 'qom', segmentName: 'QOM' }
      ];

      const result = AchievementDetector.getMostImpressiveAchievement(achievements);

      expect(result.type).toBe('qom');
    });

    it('should return null for empty array', () => {
      const result = AchievementDetector.getMostImpressiveAchievement([]);

      expect(result).toBeNull();
    });
  });

  describe('getAchievementSummary', () => {
    it('should create summary for single achievement', () => {
      const achievements = [{ type: 'kom' }];

      const summary = AchievementDetector.getAchievementSummary(achievements);

      expect(summary).toBe('1 KOM');
    });

    it('should create summary for multiple achievements', () => {
      const achievements = [
        { type: 'kom' },
        { type: 'kom' },
        { type: 'local_legend' }
      ];

      const summary = AchievementDetector.getAchievementSummary(achievements);

      expect(summary).toBe('2 KOMs, 1 Local Legend');
    });

    it('should handle mixed achievement types', () => {
      const achievements = [
        { type: 'kom' },
        { type: 'qom' },
        { type: 'local_legend' },
        { type: 'local_legend' }
      ];

      const summary = AchievementDetector.getAchievementSummary(achievements);

      expect(summary).toBe('1 KOM, 1 QOM, 2 Local Legends');
    });

    it('should return empty string for no achievements', () => {
      const summary = AchievementDetector.getAchievementSummary([]);

      expect(summary).toBe('');
    });
  });

  describe('hasAchievements', () => {
    it('should return true for activity with achievements', () => {
      const activity = {
        segment_efforts: [
          {
            segment: { id: 456, name: 'Test' },
            achievements: ['kom']
          }
        ]
      };

      const result = AchievementDetector.hasAchievements(activity);

      expect(result).toBe(true);
    });

    it('should return false for activity without achievements', () => {
      const activity = {
        segment_efforts: [
          {
            segment: { id: 456, name: 'Test' }
          }
        ]
      };

      const result = AchievementDetector.hasAchievements(activity);

      expect(result).toBe(false);
    });
  });

  describe('getRandomGif', () => {
    it('should return a gif URL', () => {
      const gif = AchievementDetector.getRandomGif('kom');

      expect(gif).toMatch(/https:\/\/.*\.gif$/);
    });

    it('should return null for unknown achievement type', () => {
      const gif = AchievementDetector.getRandomGif('unknown');

      expect(gif).toBeNull();
    });
  });

  describe('getRandomGifWithDescription', () => {
    it('should return gif object with url and description', () => {
      const gifData = AchievementDetector.getRandomGifWithDescription('kom');

      expect(gifData).toHaveProperty('url');
      expect(gifData).toHaveProperty('description');
      expect(gifData.url).toMatch(/https:\/\/.*\.gif$/);
      expect(typeof gifData.description).toBe('string');
    });

    it('should return null for unknown achievement type', () => {
      const gifData = AchievementDetector.getRandomGifWithDescription('unknown');

      expect(gifData).toBeNull();
    });
  });

  describe('getGifDescriptions', () => {
    it('should return array of descriptions for KOM', () => {
      const descriptions = AchievementDetector.getGifDescriptions('kom');

      expect(Array.isArray(descriptions)).toBe(true);
      expect(descriptions.length).toBeGreaterThan(0);
      expect(descriptions).toContain('Crown celebration');
      expect(descriptions).toContain('Victory dance');
    });

    it('should return empty array for unknown achievement type', () => {
      const descriptions = AchievementDetector.getGifDescriptions('unknown');

      expect(descriptions).toEqual([]);
    });
  });

  describe('getGifCount', () => {
    it('should return correct count for each achievement type', () => {
      expect(AchievementDetector.getGifCount('kom')).toBe(20);
      expect(AchievementDetector.getGifCount('qom')).toBe(20);
      expect(AchievementDetector.getGifCount('local_legend')).toBe(20);
    });

    it('should return 0 for unknown achievement type', () => {
      expect(AchievementDetector.getGifCount('unknown')).toBe(0);
    });
  });
});
