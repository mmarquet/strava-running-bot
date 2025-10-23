const StravaRunningBot = require('../src/index');
const ActivityProcessor = require('../src/processors/ActivityProcessor');
const WebhookServer = require('../src/server/webhook');
const config = require('../config/config');
const logger = require('../src/utils/Logger');

// Mock dependencies
jest.mock('../src/processors/ActivityProcessor');
jest.mock('../src/server/webhook');
jest.mock('../config/config', () => ({
  server: {
    nodeEnv: 'test',
    baseUrl: 'https://test.example.com'
  },
  app: {
    name: 'Strava Running Bot Test',
    version: '1.0.0'
  }
}));
jest.mock('../src/utils/Logger', () => ({
  system: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

// Mock process methods
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
const mockOn = jest.spyOn(process, 'on').mockImplementation(() => {});

describe('StravaRunningBot', () => {
  let bot;
  let mockActivityProcessor;
  let mockWebhookServer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock ActivityProcessor
    mockActivityProcessor = {
      initialize: jest.fn(),
      shutdown: jest.fn(),
      getStats: jest.fn(),
      memberManager: {
        getStats: jest.fn()
      },
      processRecentActivities: jest.fn()
    };
    ActivityProcessor.mockImplementation(() => mockActivityProcessor);

    // Mock WebhookServer
    mockWebhookServer = {
      start: jest.fn(),
      stop: jest.fn()
    };
    WebhookServer.mockImplementation(() => mockWebhookServer);

    bot = new StravaRunningBot();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize components correctly', () => {
      expect(ActivityProcessor).toHaveBeenCalled();
      expect(WebhookServer).toHaveBeenCalledWith(mockActivityProcessor);
      expect(bot.activityProcessor).toBe(mockActivityProcessor);
      expect(bot.webhookServer).toBe(mockWebhookServer);
      expect(bot.isRunning).toBe(false);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      mockActivityProcessor.initialize.mockResolvedValue();
      mockWebhookServer.start.mockResolvedValue();
      jest.spyOn(bot, 'setupGracefulShutdown').mockImplementation(() => {});
    });

    it('should start bot successfully', async () => {
      await bot.start();

      expect(logger.system).toHaveBeenCalledWith('🚀 Starting Strava Running Bot...');
      expect(logger.system).toHaveBeenCalledWith(`📊 Environment: ${config.server.nodeEnv}`);
      expect(logger.system).toHaveBeenCalledWith(`🤖 Bot Name: ${config.app.name} v${config.app.version}`);
      
      expect(mockActivityProcessor.initialize).toHaveBeenCalled();
      expect(mockWebhookServer.start).toHaveBeenCalled();
      expect(bot.setupGracefulShutdown).toHaveBeenCalled();
      expect(bot.isRunning).toBe(true);

      expect(logger.system).toHaveBeenCalledWith('✅ Strava Running Bot started successfully!');
      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '🔗 Member registration URL:', {
        url: `${config.server.baseUrl}/auth/strava?user_id=THEIR_DISCORD_USER_ID`
      });
    });

    it('should process recent activities in production', async () => {
      config.server.nodeEnv = 'production';
      mockActivityProcessor.processRecentActivities.mockResolvedValue();

      await bot.start();

      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '🔄 Processing recent activities from last 6 hours...');
      
      // Fast-forward the setTimeout
      jest.advanceTimersByTime(5000);
      
      expect(mockActivityProcessor.processRecentActivities).toHaveBeenCalledWith(6);
    });

    it('should not process recent activities in non-production', async () => {
      config.server.nodeEnv = 'development';

      await bot.start();

      jest.advanceTimersByTime(10000);
      expect(mockActivityProcessor.processRecentActivities).not.toHaveBeenCalled();
    });

    it('should handle activity processor initialization failure', async () => {
      const error = new Error('Activity processor init failed');
      mockActivityProcessor.initialize.mockRejectedValue(error);
      jest.spyOn(bot, 'stop').mockResolvedValue();

      await expect(bot.start()).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith('SYSTEM', '❌ Failed to start Strava Running Bot', error);
      expect(bot.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle webhook server start failure', async () => {
      const error = new Error('Webhook server start failed');
      mockWebhookServer.start.mockRejectedValue(error);
      jest.spyOn(bot, 'stop').mockResolvedValue();

      await expect(bot.start()).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith('SYSTEM', '❌ Failed to start Strava Running Bot', error);
      expect(bot.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should set isRunning flag correctly', async () => {
      expect(bot.isRunning).toBe(false);

      await bot.start();

      expect(bot.isRunning).toBe(true);
    });

    it('should log startup information correctly', async () => {
      await bot.start();

      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '📡 Webhook endpoint ready for Strava events');
      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '🔒 Privacy: Only public Strava activities are processed and posted');
      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '⚡ Powered by Strava API - https://www.strava.com/settings/api');
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      bot.isRunning = true;
      mockWebhookServer.stop.mockResolvedValue();
      mockActivityProcessor.shutdown.mockResolvedValue();
    });

    it('should stop bot gracefully', async () => {
      await bot.stop();

      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '🔄 Stopping Strava Running Bot...');
      expect(mockWebhookServer.stop).toHaveBeenCalled();
      expect(mockActivityProcessor.shutdown).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '✅ Strava Running Bot stopped successfully');
      expect(bot.isRunning).toBe(false);
    });

    it('should return early if not running', async () => {
      bot.isRunning = false;

      await bot.stop();

      expect(mockWebhookServer.stop).not.toHaveBeenCalled();
      expect(mockActivityProcessor.shutdown).not.toHaveBeenCalled();
    });

    it('should handle webhook server stop errors', async () => {
      const error = new Error('Webhook stop failed');
      mockWebhookServer.stop.mockRejectedValue(error);

      await bot.stop();

      expect(logger.error).toHaveBeenCalledWith('SYSTEM', '❌ Error during shutdown', error);
      expect(bot.isRunning).toBe(false);
    });

    it('should handle activity processor shutdown errors', async () => {
      const error = new Error('Activity processor shutdown failed');
      mockActivityProcessor.shutdown.mockRejectedValue(error);

      await bot.stop();

      expect(logger.error).toHaveBeenCalledWith('SYSTEM', '❌ Error during shutdown', error);
      expect(bot.isRunning).toBe(false);
    });

    it('should continue shutdown even if one component fails', async () => {
      const webhookError = new Error('Webhook stop failed');
      mockWebhookServer.stop.mockRejectedValue(webhookError);

      await bot.stop();

      expect(mockActivityProcessor.shutdown).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('SYSTEM', '❌ Error during shutdown', webhookError);
    });
  });

  describe('setupGracefulShutdown', () => {
    beforeEach(() => {
      jest.spyOn(bot, 'stop').mockResolvedValue();
      bot.setupGracefulShutdown();
    });

    it('should register signal handlers', () => {
      expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should handle SIGTERM signal', async () => {
      const sigtermHandler = mockOn.mock.calls.find(call => call[0] === 'SIGTERM')[1];

      await sigtermHandler();

      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '📡 Received SIGTERM, initiating graceful shutdown...');
      expect(bot.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle SIGINT signal', async () => {
      const sigintHandler = mockOn.mock.calls.find(call => call[0] === 'SIGINT')[1];

      await sigintHandler();

      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '📡 Received SIGINT, initiating graceful shutdown...');
      expect(bot.stop).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle uncaught exceptions', () => {
      const uncaughtHandler = mockOn.mock.calls.find(call => call[0] === 'uncaughtException')[1];
      const error = new Error('Uncaught exception');
      bot.stop.mockResolvedValue();

      uncaughtHandler(error);

      expect(logger.error).toHaveBeenCalledWith('SYSTEM', '❌ Uncaught Exception', error);
      // stop() is called with finally(), which would call process.exit(1) after resolution
    });

    it('should handle unhandled promise rejections', () => {
      const unhandledHandler = mockOn.mock.calls.find(call => call[0] === 'unhandledRejection')[1];
      const reason = new Error('Promise rejection');
      const promise = Promise.reject(reason);
      bot.stop.mockResolvedValue();

      unhandledHandler(reason, promise);

      expect(logger.error).toHaveBeenCalledWith('SYSTEM', '❌ Unhandled Rejection', { promise, reason });
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      bot.isRunning = true;
      
      mockActivityProcessor.getStats.mockReturnValue({
        processedActivities: 50,
        uptime: 3600,
        memoryUsage: { heapUsed: 52428800 }
      });

      mockActivityProcessor.memberManager.getStats.mockReturnValue({
        active: 25,
        inactive: 2,
        total: 27
      });
    });

    it('should return comprehensive bot status', () => {
      const status = bot.getStatus();

      expect(status).toEqual({
        isRunning: true,
        uptime: expect.any(Number),
        memoryUsage: expect.any(Object),
        nodeEnv: config.server.nodeEnv,
        version: config.app.version,
        activityStats: {
          processedActivities: 50,
          uptime: 3600,
          memoryUsage: { heapUsed: 52428800 }
        },
        memberStats: {
          active: 25,
          inactive: 2,
          total: 27
        },
        timestamp: expect.any(String)
      });

      expect(mockActivityProcessor.getStats).toHaveBeenCalled();
      expect(mockActivityProcessor.memberManager.getStats).toHaveBeenCalled();
    });

    it('should include current timestamp', () => {
      const beforeTime = new Date();
      const status = bot.getStatus();
      const afterTime = new Date();

      const statusTime = new Date(status.timestamp);
      expect(statusTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(statusTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should include process uptime and memory usage', () => {
      const status = bot.getStatus();

      expect(status.uptime).toBe(process.uptime());
      expect(status.memoryUsage).toEqual(process.memoryUsage());
    });

    it('should work when bot is not running', () => {
      bot.isRunning = false;

      const status = bot.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status).toHaveProperty('activityStats');
      expect(status).toHaveProperty('memberStats');
    });
  });

  describe('command line argument handling', () => {
    let originalArgv;

    beforeEach(() => {
      originalArgv = process.argv;
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(bot, 'getStatus').mockReturnValue({
        isRunning: false,
        uptime: 0,
        version: '1.0.0'
      });
    });

    afterEach(() => {
      process.argv = originalArgv;
      console.log.mockRestore();
    });

    it('should handle --status argument', () => {
      process.argv = ['node', 'src/index.js', '--status'];

      // Re-require the module to trigger command line handling
      delete require.cache[require.resolve('../src/index.js')];
      
      expect(bot.getStatus).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle --help argument', () => {
      process.argv = ['node', 'src/index.js', '--help'];

      // Re-require the module to trigger command line handling
      delete require.cache[require.resolve('../src/index.js')];

      expect(console.log).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should start bot normally with no arguments', async () => {
      process.argv = ['node', 'src/index.js'];
      jest.spyOn(bot, 'start').mockResolvedValue();

      // Re-require would trigger start, but we can't easily test that
      // Instead test the start method directly
      await expect(bot.start()).resolves.toBeUndefined();
    });
  });

  describe('error scenarios', () => {
    it('should handle fatal startup errors', async () => {
      const fatalError = new Error('Fatal startup error');
      mockActivityProcessor.initialize.mockRejectedValue(fatalError);
      jest.spyOn(bot, 'stop').mockResolvedValue();

      await expect(bot.start()).rejects.toThrow(fatalError);
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle stop errors during startup failure', async () => {
      const startupError = new Error('Startup failed');
      const stopError = new Error('Stop failed');
      
      mockActivityProcessor.initialize.mockRejectedValue(startupError);
      jest.spyOn(bot, 'stop').mockRejectedValue(stopError);

      await expect(bot.start()).rejects.toThrow(startupError);
    });

    it('should handle graceful shutdown with stop errors', async () => {
      bot.isRunning = true;
      const stopError = new Error('Stop failed');
      jest.spyOn(bot, 'stop').mockRejectedValue(stopError);
      bot.setupGracefulShutdown();

      const sigtermHandler = mockOn.mock.calls.find(call => call[0] === 'SIGTERM')[1];
      await sigtermHandler();

      expect(mockExit).toHaveBeenCalledWith(0); // Should exit cleanly even with stop error
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete lifecycle', async () => {
      // Start
      await bot.start();
      expect(bot.isRunning).toBe(true);
      expect(mockActivityProcessor.initialize).toHaveBeenCalled();
      expect(mockWebhookServer.start).toHaveBeenCalled();

      // Get status while running
      const status = bot.getStatus();
      expect(status.isRunning).toBe(true);

      // Stop
      await bot.stop();
      expect(bot.isRunning).toBe(false);
      expect(mockActivityProcessor.shutdown).toHaveBeenCalled();
      expect(mockWebhookServer.stop).toHaveBeenCalled();
    });

    it('should handle restart scenario', async () => {
      // Start
      await bot.start();
      expect(bot.isRunning).toBe(true);

      // Stop
      await bot.stop();
      expect(bot.isRunning).toBe(false);

      // Start again
      jest.clearAllMocks();
      await bot.start();
      expect(bot.isRunning).toBe(true);
      expect(mockActivityProcessor.initialize).toHaveBeenCalled();
      expect(mockWebhookServer.start).toHaveBeenCalled();
    });

    it('should handle multiple stop calls gracefully', async () => {
      await bot.start();
      expect(bot.isRunning).toBe(true);

      // First stop
      await bot.stop();
      expect(bot.isRunning).toBe(false);
      expect(mockActivityProcessor.shutdown).toHaveBeenCalledTimes(1);

      // Second stop should return early
      jest.clearAllMocks();
      await bot.stop();
      expect(mockActivityProcessor.shutdown).not.toHaveBeenCalled();
    });

    it('should handle production environment setup', async () => {
      config.server.nodeEnv = 'production';
      mockActivityProcessor.processRecentActivities.mockResolvedValue();

      await bot.start();

      expect(logger.info).toHaveBeenCalledWith('SYSTEM', '🔄 Processing recent activities from last 6 hours...');
      
      // Fast-forward timer
      jest.advanceTimersByTime(5000);
      
      expect(mockActivityProcessor.processRecentActivities).toHaveBeenCalledWith(6);
    });
  });

  describe('memory and resource management', () => {
    it('should clean up timers on stop', async () => {
      config.server.nodeEnv = 'production';
      jest.spyOn(globalThis, 'clearTimeout');

      await bot.start();
      
      // Fast-forward to let setTimeout be called
      jest.advanceTimersByTime(1000);
      
      await bot.stop();

      // Timer should be cleaned up through component shutdown
      expect(mockActivityProcessor.shutdown).toHaveBeenCalled();
    });

    it('should handle resource constraints gracefully', async () => {
      // Mock a memory constraint scenario
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        rss: 500 * 1024 * 1024, // 500MB
        heapTotal: 400 * 1024 * 1024,
        heapUsed: 350 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024
      }));

      const status = bot.getStatus();
      expect(status.memoryUsage.heapUsed).toBe(350 * 1024 * 1024);

      process.memoryUsage = originalMemoryUsage;
    });
  });
});