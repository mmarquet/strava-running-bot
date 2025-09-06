const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const DiscordBot = require('../../src/discord/bot');
const config = require('../../config/config');
const DiscordCommands = require('../../src/discord/commands');
const ActivityEmbedBuilder = require('../../src/utils/EmbedBuilder');
const logger = require('../../src/utils/Logger');

// Mock dependencies
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    user: { id: 'bot_user_id', tag: 'TestBot#1234' },
    guilds: {
      cache: new Map([['test_guild_id', { name: 'Test Guild' }]])
    }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4
  },
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue()
  })),
  Routes: {
    applicationCommands: jest.fn((appId) => `/applications/${appId}/commands`),
    applicationGuildCommands: jest.fn((appId, guildId) => `/applications/${appId}/guilds/${guildId}/commands`)
  }
}));
jest.mock('../../config/config', () => ({
  discord: {
    token: 'test_discord_token',
    channelId: 'test_channel_id'
  }
}));
jest.mock('../../src/discord/commands');
jest.mock('../../src/utils/EmbedBuilder');
jest.mock('../../src/utils/Logger', () => ({
  discord: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('DiscordBot', () => {
  let discordBot;
  let mockActivityProcessor;
  let mockClient;
  let mockCommands;
  let mockRest;

  const mockActivityData = {
    id: 98765,
    name: 'Morning Run',
    type: 'Run',
    distance: 5000,
    athlete: {
      firstname: 'John',
      lastname: 'Doe'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Discord Client
    mockClient = {
      once: jest.fn(),
      on: jest.fn(),
      login: jest.fn(),
      destroy: jest.fn(),
      user: {
        tag: 'TestBot#1234',
        id: 'bot_user_id'
      },
      guilds: {
        cache: { size: 1 }
      },
      users: {
        cache: { size: 10 }
      },
      channels: {
        fetch: jest.fn()
      }
    };

    Client.mockImplementation(() => mockClient);

    // Mock DiscordCommands
    const mockGetCommands = jest.fn().mockReturnValue([]);
    const mockHandleCommand = jest.fn();
    const mockHandleAutocomplete = jest.fn();
    
    mockCommands = {
      getCommands: mockGetCommands,
      handleCommand: mockHandleCommand,
      handleAutocomplete: mockHandleAutocomplete
    };
    DiscordCommands.mockImplementation(() => mockCommands);

    // Mock REST API
    mockRest = {
      setToken: jest.fn().mockReturnThis(),
      put: jest.fn().mockResolvedValue([])
    };
    REST.mockImplementation(() => mockRest);

    // Mock activity processor
    mockActivityProcessor = {
      memberManager: {},
      stravaAPI: {}
    };

    // Mock ActivityEmbedBuilder
    ActivityEmbedBuilder.createActivityEmbed.mockReturnValue({
      title: 'Test Activity Embed'
    });

    discordBot = new DiscordBot(mockActivityProcessor);
  });

  describe('constructor', () => {
    it('should initialize Discord client with correct intents', () => {
      expect(Client).toHaveBeenCalledWith({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages
        ]
      });
    });

    it('should initialize with activity processor and commands', () => {
      expect(discordBot.activityProcessor).toBe(mockActivityProcessor);
      expect(discordBot.client).toBe(mockClient);
      expect(DiscordCommands).toHaveBeenCalledWith(mockActivityProcessor);
      expect(discordBot.commands).toBe(mockCommands);
    });

    it('should set up event handlers', () => {
      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('event handlers', () => {
    describe('ready event', () => {
      it('should log bot information and register commands', async () => {
        const readyHandler = mockClient.once.mock.calls.find(call => call[0] === 'ready')[1];
        jest.spyOn(discordBot, 'registerCommands').mockResolvedValue();

        await readyHandler();

        expect(logger.discord.info).toHaveBeenCalledWith('Bot logged in', {
          tag: 'TestBot#1234',
          id: 'bot_user_id',
          guilds: 1,
          users: 10
        });
        expect(discordBot.registerCommands).toHaveBeenCalled();
      });

      it('should handle registerCommands errors gracefully', async () => {
        const readyHandler = mockClient.once.mock.calls.find(call => call[0] === 'ready')[1];
        const error = new Error('Command registration failed');
        jest.spyOn(discordBot, 'registerCommands').mockRejectedValue(error);

        await expect(readyHandler()).resolves.toBeUndefined();
        // Should not throw, error handling is internal to registerCommands
      });
    });

    describe('interactionCreate event', () => {
      let interactionHandler;

      beforeEach(() => {
        interactionHandler = mockClient.on.mock.calls.find(call => call[0] === 'interactionCreate')[1];
      });

      it('should handle chat input commands', async () => {
        const mockInteraction = {
          isChatInputCommand: () => true,
          isAutocomplete: () => false
        };

        await interactionHandler(mockInteraction);

        expect(mockCommands.handleCommand).toHaveBeenCalledWith(mockInteraction);
      });

      it('should handle autocomplete interactions', async () => {
        const mockInteraction = {
          isChatInputCommand: () => false,
          isAutocomplete: () => true
        };

        await interactionHandler(mockInteraction);

        expect(mockCommands.handleAutocomplete).toHaveBeenCalledWith(mockInteraction);
      });

      it('should ignore other interaction types', async () => {
        const mockInteraction = {
          isChatInputCommand: () => false,
          isAutocomplete: () => false
        };

        await interactionHandler(mockInteraction);

        expect(mockCommands.handleCommand).not.toHaveBeenCalled();
        expect(mockCommands.handleAutocomplete).not.toHaveBeenCalled();
      });

      it('should handle command errors gracefully', async () => {
        const mockInteraction = {
          isChatInputCommand: () => true,
          isAutocomplete: () => false
        };
        const error = new Error('Command failed');
        mockCommands.handleCommand.mockRejectedValue(error);

        await expect(interactionHandler(mockInteraction)).resolves.toBeUndefined();
        // Errors should be handled within the commands, not bubble up
      });

      it('should handle autocomplete errors gracefully', async () => {
        const mockInteraction = {
          isChatInputCommand: () => false,
          isAutocomplete: () => true
        };
        const error = new Error('Autocomplete failed');
        mockCommands.handleAutocomplete.mockRejectedValue(error);

        await expect(interactionHandler(mockInteraction)).resolves.toBeUndefined();
      });
    });

    describe('error event', () => {
      it('should log Discord client errors', () => {
        const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];
        const error = new Error('WebSocket connection failed');

        errorHandler(error);

        expect(logger.discord.error).toHaveBeenCalledWith('Discord client error', error);
      });
    });
  });

  describe('registerCommands', () => {
    const mockCommands = [
      { toJSON: () => ({ name: 'test1', description: 'Test command 1' }) },
      { toJSON: () => ({ name: 'test2', description: 'Test command 2' }) }
    ];

    beforeEach(() => {
      discordBot.commands.getCommands.mockReturnValue(mockCommands);
      mockRest.put.mockResolvedValue([
        { name: 'test1' },
        { name: 'test2' }
      ]);
    });

    it('should register commands globally when no guild ID is set', async () => {
      delete process.env.DISCORD_GUILD_ID;

      await discordBot.registerCommands();

      expect(REST).toHaveBeenCalledWith({ version: '10' });
      expect(mockRest.setToken).toHaveBeenCalledWith(config.discord.token);
      expect(mockRest.put).toHaveBeenCalledWith(
        Routes.applicationCommands('bot_user_id'),
        { body: [
          { name: 'test1', description: 'Test command 1' },
          { name: 'test2', description: 'Test command 2' }
        ]}
      );

      expect(logger.discord.warn).toHaveBeenCalledWith('No DISCORD_GUILD_ID set, registering globally (may take up to 1 hour)');
      expect(logger.discord.info).toHaveBeenCalledWith('Successfully registered Discord slash commands', {
        count: 2,
        commands: ['test1', 'test2']
      });
    });

    it('should register commands to specific guild when guild ID is set', async () => {
      process.env.DISCORD_GUILD_ID = 'test_guild_id';

      await discordBot.registerCommands();

      expect(mockRest.put).toHaveBeenCalledWith(
        Routes.applicationGuildCommands('bot_user_id', 'test_guild_id'),
        { body: [
          { name: 'test1', description: 'Test command 1' },
          { name: 'test2', description: 'Test command 2' }
        ]}
      );

      expect(logger.discord.info).toHaveBeenCalledWith('Registering commands to guild for testing', { guildId: 'test_guild_id' });
    });

    it('should handle command registration errors', async () => {
      // Create command mock
      const mockCommand = {
        toJSON: () => ({ name: 'test', description: 'test command' })
      };

      // Setup commands to be registered
      mockCommands.getCommands = jest.fn().mockReturnValue([mockCommand]);

      // Create Discord API error
      const error = {
        name: 'DiscordAPIError',
        code: 429,
        message: 'Rate limited',
        method: 'PUT',
        url: '/api/v10/applications/123/commands',
        status: 429,
        requestBody: { files: undefined, json: [] }
      };

      // Mock the REST put method to reject with our error
      mockRest.put.mockRejectedValueOnce(error);

      // Verify the error is thrown
      await expect(discordBot.registerCommands())
        .rejects
        .toEqual(error);

      // Verify error was logged
      expect(logger.discord.error).toHaveBeenCalledWith('Error registering Discord commands', error);
    });

    it('should log registration start', async () => {
      await discordBot.registerCommands();

      expect(logger.discord.info).toHaveBeenCalledWith('Registering Discord slash commands...');
    });

    it('should handle empty commands array', async () => {
      discordBot.commands.getCommands.mockReturnValue([]);
      mockRest.put.mockResolvedValue([]);

      await discordBot.registerCommands();

      expect(mockRest.put).toHaveBeenCalledWith(
        expect.any(String),
        { body: [] }
      );
      expect(logger.discord.info).toHaveBeenCalledWith('Successfully registered Discord slash commands', {
        count: 0,
        commands: []
      });
    });
  });

  describe('start', () => {
    it('should login to Discord successfully', async () => {
      mockClient.login.mockResolvedValue('Ready!');

      await discordBot.start();

      expect(mockClient.login).toHaveBeenCalledWith(config.discord.token);
    });

    it('should handle login errors', async () => {
      const error = new Error('Invalid token');
      mockClient.login.mockRejectedValue(error);

      await expect(discordBot.start()).rejects.toThrow(error);
      expect(logger.discord.error).toHaveBeenCalledWith('Failed to start Discord bot', error);
    });

    it('should propagate login errors', async () => {
      const error = new Error('Connection failed');
      mockClient.login.mockRejectedValue(error);

      await expect(discordBot.start()).rejects.toThrow(error);
    });
  });

  describe('postActivity', () => {
    const mockChannel = {
      send: jest.fn()
    };

    beforeEach(() => {
      mockClient.channels.fetch.mockResolvedValue(mockChannel);
      mockChannel.send.mockResolvedValue({ id: 'message_id' });
    });

    it('should post activity to Discord channel', async () => {
      const mockEmbed = { title: 'Test Activity Embed' };
      ActivityEmbedBuilder.createActivityEmbed.mockReturnValue(mockEmbed);

      await discordBot.postActivity(mockActivityData);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith(config.discord.channelId);
      expect(ActivityEmbedBuilder.createActivityEmbed).toHaveBeenCalledWith(mockActivityData, { type: 'posted' });
      expect(mockChannel.send).toHaveBeenCalledWith({ embeds: [mockEmbed] });

      expect(logger.discord.info).toHaveBeenCalledWith('Posted activity to Discord', {
        activityName: mockActivityData.name,
        activityType: mockActivityData.type,
        distance: mockActivityData.distance,
        athleteName: `${mockActivityData.athlete.firstname} ${mockActivityData.athlete.lastname}`,
        channelId: config.discord.channelId,
        hasAchievements: undefined,
        achievementCount: 0
      });
    });

    it('should handle channel not found error', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(discordBot.postActivity(mockActivityData)).rejects.toThrow('Discord channel not found');

      expect(logger.discord.error).toHaveBeenCalledWith('Failed to post activity to Discord', {
        activityData: {
          id: mockActivityData.id,
          name: mockActivityData.name,
          athlete: `${mockActivityData.athlete.firstname} ${mockActivityData.athlete.lastname}`
        },
        error: 'Discord channel not found'
      });
    });

    it('should handle channel fetch errors', async () => {
      const error = new Error('Channel fetch failed');
      mockClient.channels.fetch.mockRejectedValue(error);

      await expect(discordBot.postActivity(mockActivityData)).rejects.toThrow(error);

      expect(logger.discord.error).toHaveBeenCalledWith('Failed to post activity to Discord', {
        activityData: {
          id: mockActivityData.id,
          name: mockActivityData.name,
          athlete: `${mockActivityData.athlete.firstname} ${mockActivityData.athlete.lastname}`
        },
        error: error.message
      });
    });

    it('should handle message send errors', async () => {
      const error = new Error('Missing permissions');
      mockChannel.send.mockRejectedValue(error);

      await expect(discordBot.postActivity(mockActivityData)).rejects.toThrow(error);

      expect(logger.discord.error).toHaveBeenCalledWith('Failed to post activity to Discord', expect.any(Object));
    });

    it('should handle activities with missing athlete data', async () => {
      const activityWithoutAthlete = {
        ...mockActivityData,
        athlete: null
      };

      await expect(discordBot.postActivity(activityWithoutAthlete)).rejects.toThrow();
    });

    it('should handle activities with partial athlete data', async () => {
      const activityWithPartialAthlete = {
        ...mockActivityData,
        athlete: {
          firstname: 'John'
          // missing lastname
        }
      };

      await discordBot.postActivity(activityWithPartialAthlete);

      expect(logger.discord.info).toHaveBeenCalledWith('Posted activity to Discord', 
        expect.objectContaining({
          athleteName: 'John undefined'
        })
      );
    });

    it('should create embed with correct parameters', async () => {
      await discordBot.postActivity(mockActivityData);

      expect(ActivityEmbedBuilder.createActivityEmbed).toHaveBeenCalledWith(mockActivityData, { type: 'posted' });
    });

    it('should send special message for activities with achievements', async () => {
      const mockEmbed = { title: 'Test Activity Embed' };
      ActivityEmbedBuilder.createActivityEmbed.mockReturnValue(mockEmbed);

      const activityWithAchievements = {
        ...mockActivityData,
        achievements: [
          { type: 'kom', segmentName: 'Big Hill' },
          { type: 'local_legend', segmentName: 'Local Loop' }
        ]
      };

      await discordBot.postActivity(activityWithAchievements);

      const expectedMessage = '🚨 **ACHIEVEMENT ALERT!** 🚨\n**John Doe** just earned ! 🔥💪';
      
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: expect.stringContaining('🚨 **ACHIEVEMENT ALERT!** 🚨'),
        embeds: [mockEmbed]
      });

      expect(logger.discord.info).toHaveBeenCalledWith('Posted activity to Discord', 
        expect.objectContaining({
          hasAchievements: true,
          achievementCount: 2
        })
      );
    });

    it('should use Discord display name for achievement message when available', async () => {
      const activityWithAchievements = {
        ...mockActivityData,
        athlete: {
          ...mockActivityData.athlete,
          discordUser: {
            displayName: 'JohnDoe123'
          }
        },
        achievements: [
          { type: 'kom', segmentName: 'Test Segment' }
        ]
      };

      await discordBot.postActivity(activityWithAchievements);

      const sentMessage = mockChannel.send.mock.calls[0][0];
      expect(sentMessage.content).toContain('**JohnDoe123**');
      expect(sentMessage.content).toContain('🚨 **ACHIEVEMENT ALERT!** 🚨');
    });

    it('should send regular message for activities without achievements', async () => {
      const mockEmbed = { title: 'Test Activity Embed' };
      ActivityEmbedBuilder.createActivityEmbed.mockReturnValue(mockEmbed);

      const activityWithoutAchievements = {
        ...mockActivityData,
        achievements: []
      };

      await discordBot.postActivity(activityWithoutAchievements);

      expect(mockChannel.send).toHaveBeenCalledWith({ embeds: [mockEmbed] });

      expect(logger.discord.info).toHaveBeenCalledWith('Posted activity to Discord', 
        expect.objectContaining({
          hasAchievements: false,
          achievementCount: 0
        })
      );
    });
  });

  describe('stop', () => {
    it('should destroy Discord client', async () => {
      mockClient.destroy.mockResolvedValue();

      await discordBot.stop();

      expect(mockClient.destroy).toHaveBeenCalled();
      expect(logger.discord.info).toHaveBeenCalledWith('Discord bot stopped');
    });

    it('should handle destroy errors gracefully', async () => {
      const error = new Error('Destroy failed');
      mockClient.destroy.mockRejectedValue(error);

      await expect(discordBot.stop()).resolves.toBeUndefined();
      expect(logger.discord.info).toHaveBeenCalledWith('Discord bot stopped');
    });

    it('should handle null client gracefully', async () => {
      discordBot.client = null;

      await expect(discordBot.stop()).resolves.toBeUndefined();
      expect(logger.discord.info).toHaveBeenCalledWith('Discord bot stopped');
    });

    it('should handle undefined client gracefully', async () => {
      discordBot.client = undefined;

      await expect(discordBot.stop()).resolves.toBeUndefined();
      expect(logger.discord.info).toHaveBeenCalledWith('Discord bot stopped');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete bot lifecycle', async () => {
      mockClient.login.mockResolvedValue('Ready!');
      mockClient.destroy.mockResolvedValue();

      // Start bot
      await discordBot.start();
      expect(mockClient.login).toHaveBeenCalled();

      // Simulate ready event
      const readyHandler = mockClient.once.mock.calls.find(call => call[0] === 'ready')[1];
      jest.spyOn(discordBot, 'registerCommands').mockResolvedValue();
      await readyHandler();
      expect(discordBot.registerCommands).toHaveBeenCalled();

      // Stop bot
      await discordBot.stop();
      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it('should handle interaction events after startup', async () => {
      mockClient.login.mockResolvedValue('Ready!');

      await discordBot.start();

      // Simulate command interaction
      const interactionHandler = mockClient.on.mock.calls.find(call => call[0] === 'interactionCreate')[1];
      const mockInteraction = {
        isChatInputCommand: () => true,
        isAutocomplete: () => false
      };

      await interactionHandler(mockInteraction);
      expect(mockCommands.handleCommand).toHaveBeenCalledWith(mockInteraction);
    });

    it('should handle activity posting workflow', async () => {
      const mockChannel = { send: jest.fn().mockResolvedValue({ id: 'msg_id' }) };
      mockClient.channels.fetch.mockResolvedValue(mockChannel);

      await discordBot.postActivity(mockActivityData);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith(config.discord.channelId);
      expect(ActivityEmbedBuilder.createActivityEmbed).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalled();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle Discord client initialization errors', () => {
      Client.mockImplementation(() => {
        throw new Error('Discord.js initialization failed');
      });

      expect(() => new DiscordBot(mockActivityProcessor)).toThrow('Discord.js initialization failed');
    });

    it('should handle commands initialization errors', () => {
      DiscordCommands.mockImplementation(() => {
        throw new Error('Commands initialization failed');
      });

      expect(() => new DiscordBot(mockActivityProcessor)).toThrow('Commands initialization failed');
    });

    it('should handle missing activity processor', () => {
      expect(() => new DiscordBot(null)).not.toThrow();
      // Should create bot but may have issues later
    });

    it('should handle malformed activity data', async () => {
      const malformedActivity = {
        id: null,
        name: undefined,
        athlete: {}
      };

      const mockChannel = { send: jest.fn().mockResolvedValue({}) };
      mockClient.channels.fetch.mockResolvedValue(mockChannel);

      await expect(discordBot.postActivity(malformedActivity)).resolves.toBeUndefined();
      // Should handle gracefully with logging
    });

    it('should handle Discord API rate limiting', async () => {
      const rateLimitError = new Error('Rate limited');
      rateLimitError.code = 429;
      
      const mockChannel = { send: jest.fn().mockRejectedValue(rateLimitError) };
      mockClient.channels.fetch.mockResolvedValue(mockChannel);

      await expect(discordBot.postActivity(mockActivityData)).rejects.toThrow(rateLimitError);
      expect(logger.discord.error).toHaveBeenCalled();
    });

    it('should handle network connectivity issues', async () => {
      const networkError = new Error('Network is unreachable');
      networkError.code = 'ENETUNREACH';
      mockClient.login.mockRejectedValue(networkError);

      await expect(discordBot.start()).rejects.toThrow(networkError);
      expect(logger.discord.error).toHaveBeenCalledWith('Failed to start Discord bot', networkError);
    });
  });

  describe('environment-specific behavior', () => {
    it('should use different registration based on environment', async () => {
      // Test with guild ID
      process.env.DISCORD_GUILD_ID = 'test_guild';
      discordBot.commands.getCommands.mockReturnValue([]);
      mockRest.put.mockResolvedValue([]);

      await discordBot.registerCommands();
      expect(mockRest.put).toHaveBeenCalledWith(
        Routes.applicationGuildCommands('bot_user_id', 'test_guild'),
        { body: [] }
      );

      // Test without guild ID
      delete process.env.DISCORD_GUILD_ID;
      jest.clearAllMocks();
      mockRest.put.mockResolvedValue([]);

      await discordBot.registerCommands();
      expect(mockRest.put).toHaveBeenCalledWith(
        Routes.applicationCommands('bot_user_id'),
        { body: [] }
      );
    });

    it('should handle missing environment variables gracefully', async () => {
      const originalToken = config.discord.token;
      const originalChannelId = config.discord.channelId;

      try {
        config.discord.token = undefined;
        config.discord.channelId = undefined;

        await expect(discordBot.start()).rejects.toThrow();
        await expect(discordBot.postActivity(mockActivityData)).rejects.toThrow();
      } finally {
        config.discord.token = originalToken;
        config.discord.channelId = originalChannelId;
      }
    });
  });
});