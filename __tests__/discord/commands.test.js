const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const DiscordCommands = require('../../src/discord/commands');
const ActivityEmbedBuilder = require('../../src/utils/EmbedBuilder');
const DiscordUtils = require('../../src/utils/DiscordUtils');
const logger = require('../../src/utils/Logger');
const config = require('../../config/config');

// Mock dependencies
jest.mock('discord.js', () => {
  const mockSlashCommandBuilder = jest.fn().mockImplementation(() => {
    const mockCmd = {
      name: '',
      description: '',
      options: [],
      default_member_permissions: null,
      setName: jest.fn().mockImplementation((name) => {
        mockCmd.name = name;
        return mockCmd;
      }),
      setDescription: jest.fn().mockImplementation((desc) => {
        mockCmd.description = desc;
        return mockCmd;
      }),
      addSubcommand: jest.fn().mockImplementation((callback) => {
        const subcommand = {
          name: '',
          options: [],
          setName: jest.fn().mockImplementation((name) => {
            subcommand.name = name;
            return subcommand;
          }),
          setDescription: jest.fn().mockReturnThis(),
          addStringOption: jest.fn().mockImplementation((optionCallback) => {
            const option = {
              setName: jest.fn().mockReturnThis(),
              setDescription: jest.fn().mockReturnThis(),
              setRequired: jest.fn().mockReturnThis(),
              setAutocomplete: jest.fn().mockReturnThis()
            };
            optionCallback(option);
            subcommand.options.push(option);
            return subcommand;
          })
        };
        callback(subcommand);
        mockCmd.options.push(subcommand);
        return mockCmd;
      }),
      addStringOption: jest.fn().mockImplementation((callback) => {
        const option = {
          autocomplete: false,
          setName: jest.fn().mockReturnThis(),
          setDescription: jest.fn().mockReturnThis(),
          setRequired: jest.fn().mockReturnThis(),
          setAutocomplete: jest.fn().mockImplementation((auto) => {
            option.autocomplete = auto;
            return option;
          })
        };
        callback(option);
        mockCmd.options.push(option);
        return mockCmd;
      }),
      setDefaultMemberPermissions: jest.fn().mockImplementation((perms) => {
        mockCmd.default_member_permissions = String(perms);
        return mockCmd;
      }),
      setAutocomplete: jest.fn().mockImplementation(function() { return this; }),
      toJSON: jest.fn().mockImplementation(() => ({
        name: mockCmd.name,
        description: mockCmd.description,
        options: mockCmd.options
      }))
    };
    // Make it appear as instanceof SlashCommandBuilder
    Object.setPrototypeOf(mockCmd, mockSlashCommandBuilder.prototype);
    return mockCmd;
  });

  return {
    SlashCommandBuilder: mockSlashCommandBuilder,
    EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis()
  })),
    PermissionFlagsBits: {
      ManageGuild: 32n
    }
  };
});
jest.mock('../../src/utils/EmbedBuilder');
jest.mock('../../src/utils/DiscordUtils');
jest.mock('../../src/utils/Logger', () => ({
  discord: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));
jest.mock('../../config/config', () => ({
  server: {
    baseUrl: 'https://test.example.com'
  }
}));

describe('DiscordCommands', () => {
  let discordCommands;
  let mockActivityProcessor;
  let mockMemberManager;
  let mockStravaAPI;
  let mockInteraction;

  const mockMember = {
    discordUserId: '123456789',
    discordUser: {
      displayName: 'Test User',
      username: 'testuser'
    },
    athlete: {
      id: 12345,
      firstname: 'John',
      lastname: 'Doe'
    },
    tokens: {
      access_token: 'test_token'
    },
    registeredAt: '2024-01-01T00:00:00Z',
    isActive: true
  };

  const mockActivity = {
    id: 98765,
    name: 'Morning Run',
    type: 'Run',
    distance: 5000,
    moving_time: 1800,
    athlete: mockMember.athlete
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock MemberManager
    mockMemberManager = {
      getAllMembers: jest.fn(),
      getMemberByDiscordId: jest.fn(),
      removeMemberByDiscordId: jest.fn(),
      deactivateMember: jest.fn(),
      reactivateMember: jest.fn(),
      getValidAccessToken: jest.fn(),
      getStats: jest.fn(),
      members: new Map([['12345', mockMember]]),
      discordToStrava: new Map([['123456789', '12345']])
    };

    // Mock StravaAPI
    mockStravaAPI = {
      getAthleteActivities: jest.fn(),
      getActivity: jest.fn(),
      shouldPostActivity: jest.fn(),
      processActivityWithStreams: jest.fn(),
      getRateLimiterStats: jest.fn()
    };

    // Mock ActivityProcessor
    mockActivityProcessor = {
      memberManager: mockMemberManager,
      stravaAPI: mockStravaAPI,
      getStats: jest.fn()
    };

    discordCommands = new DiscordCommands(mockActivityProcessor);

    // Mock Discord interaction
    mockInteraction = {
      commandName: 'test',
      options: {
        getSubcommand: jest.fn(),
        getString: jest.fn(),
        getFocused: jest.fn()
      },
      user: {
        tag: 'TestUser#1234',
        id: '123456789'
      },
      guild: {
        name: 'Test Guild',
        members: {
          cache: new Map([
            ['123456789', { displayName: 'Test User' }]
          ])
        }
      },
      channel: {
        name: 'test-channel'
      },
      reply: jest.fn(),
      editReply: jest.fn(),
      deferReply: jest.fn(),
      followUp: jest.fn(),
      respond: jest.fn(),
      replied: false,
      deferred: false
    };

    // Mock EmbedBuilder
    EmbedBuilder.mockImplementation(() => ({
      setTitle: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      setTimestamp: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis()
    }));

    ActivityEmbedBuilder.createActivityEmbed.mockReturnValue({ title: 'Test Activity Embed' });
    DiscordUtils.extractUserId.mockReturnValue('123456789');
    DiscordUtils.chunkArray.mockReturnValue([[mockMember]]);
  });

  describe('constructor', () => {
    it('should initialize with activity processor', () => {
      expect(discordCommands.activityProcessor).toBe(mockActivityProcessor);
    });
  });

  describe('getCommands', () => {
    it('should return array of slash commands', () => {
      const commands = discordCommands.getCommands();

      expect(commands).toHaveLength(4);
      expect(commands.every(cmd => cmd instanceof SlashCommandBuilder)).toBe(true);
    });

    it('should include members command with subcommands', () => {
      const commands = discordCommands.getCommands();
      const membersCommand = commands.find(cmd => cmd.name === 'members');

      expect(membersCommand).toBeDefined();
      expect(membersCommand.options).toHaveLength(4); // list, remove, deactivate, reactivate
    });

    it('should include register command', () => {
      const commands = discordCommands.getCommands();
      const registerCommand = commands.find(cmd => cmd.name === 'register');

      expect(registerCommand).toBeDefined();
    });

    it('should include botstatus command with admin permissions', () => {
      const commands = discordCommands.getCommands();
      const statusCommand = commands.find(cmd => cmd.name === 'botstatus');

      expect(statusCommand).toBeDefined();
      expect(statusCommand.default_member_permissions).toBe(String(PermissionFlagsBits.ManageGuild));
    });

    it('should include last command with autocomplete', () => {
      const commands = discordCommands.getCommands();
      const lastCommand = commands.find(cmd => cmd.name === 'last');

      expect(lastCommand).toBeDefined();
      expect(lastCommand.options[0].autocomplete).toBe(true);
    });
  });

  describe('handleCommand', () => {
    it('should handle members command', async () => {
      mockInteraction.commandName = 'members';
      mockInteraction.options.getSubcommand.mockReturnValue('list');
      jest.spyOn(discordCommands, 'handleMembersCommand').mockResolvedValue();

      await discordCommands.handleCommand(mockInteraction);

      expect(discordCommands.handleMembersCommand).toHaveBeenCalledWith(mockInteraction, mockInteraction.options);
      expect(logger.discord.info).toHaveBeenCalledWith('Command received', expect.any(Object));
    });

    it('should handle register command', async () => {
      mockInteraction.commandName = 'register';
      jest.spyOn(discordCommands, 'handleRegisterCommand').mockResolvedValue();

      await discordCommands.handleCommand(mockInteraction);

      expect(discordCommands.handleRegisterCommand).toHaveBeenCalledWith(mockInteraction);
    });

    it('should handle botstatus command', async () => {
      mockInteraction.commandName = 'botstatus';
      jest.spyOn(discordCommands, 'handleBotStatusCommand').mockResolvedValue();

      await discordCommands.handleCommand(mockInteraction);

      expect(discordCommands.handleBotStatusCommand).toHaveBeenCalledWith(mockInteraction);
    });

    it('should handle last command', async () => {
      mockInteraction.commandName = 'last';
      jest.spyOn(discordCommands, 'handleLastActivityCommand').mockResolvedValue();

      await discordCommands.handleCommand(mockInteraction);

      expect(discordCommands.handleLastActivityCommand).toHaveBeenCalledWith(mockInteraction, mockInteraction.options);
    });

    it('should handle unknown command', async () => {
      mockInteraction.commandName = 'unknown';

      await discordCommands.handleCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Unknown command',
        ephemeral: true
      });
    });

    it('should handle command errors gracefully', async () => {
      mockInteraction.commandName = 'members';
      const error = new Error('Test error');
      jest.spyOn(discordCommands, 'handleMembersCommand').mockRejectedValue(error);

      await discordCommands.handleCommand(mockInteraction);

      expect(logger.discord.error).toHaveBeenCalledWith('Error handling command', expect.any(Object));
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ An error occurred while processing your command.',
        ephemeral: true
      });
    });

    it('should use followUp for error if interaction already replied', async () => {
      mockInteraction.commandName = 'members';
      mockInteraction.replied = true;
      const error = new Error('Test error');
      jest.spyOn(discordCommands, 'handleMembersCommand').mockRejectedValue(error);

      await discordCommands.handleCommand(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: '❌ An error occurred while processing your command.',
        ephemeral: true
      });
    });
  });

  describe('handleMembersCommand', () => {
    it('should route to correct subcommand handlers', async () => {
      const handlers = ['listMembers', 'removeMember', 'deactivateMember', 'reactivateMember'];
      const subcommands = ['list', 'remove', 'deactivate', 'reactivate'];

      for (let i = 0; i < handlers.length; i++) {
        jest.clearAllMocks();
        mockInteraction.options.getSubcommand.mockReturnValue(subcommands[i]);
        jest.spyOn(discordCommands, handlers[i]).mockResolvedValue();

        await discordCommands.handleMembersCommand(mockInteraction, mockInteraction.options);

        if (handlers[i] === 'listMembers') {
          expect(discordCommands[handlers[i]]).toHaveBeenCalledWith(mockInteraction);
        } else {
          expect(discordCommands[handlers[i]]).toHaveBeenCalledWith(mockInteraction, mockInteraction.options);
        }
      }
    });
  });

  describe('listMembers', () => {
    beforeEach(() => {
      mockMemberManager.getAllMembers.mockResolvedValue([mockMember]);
      mockMemberManager.getStats.mockReturnValue({ active: 1, inactive: 0, total: 1 });
    });

    it('should list members successfully', async () => {
      await discordCommands.listMembers(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(mockMemberManager.getAllMembers).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)]
      });
    });

    it('should handle empty member list', async () => {
      mockMemberManager.getAllMembers.mockResolvedValue([]);

      await discordCommands.listMembers(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '📭 No team members registered yet.',
        ephemeral: true
      });
    });

    it('should handle errors in listing members', async () => {
      const error = new Error('Database error');
      mockMemberManager.getAllMembers.mockRejectedValue(error);

      await discordCommands.listMembers(mockInteraction);

      expect(logger.discord.error).toHaveBeenCalledWith('Error listing members', expect.any(Object));
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to retrieve member list.',
        ephemeral: true
      });
    });

    it('should chunk large member lists', async () => {
      const manyMembers = Array(15).fill(mockMember);
      mockMemberManager.getAllMembers.mockResolvedValue(manyMembers);
      DiscordUtils.chunkArray.mockReturnValue([manyMembers.slice(0, 10)]);

      await discordCommands.listMembers(mockInteraction);

      expect(DiscordUtils.chunkArray).toHaveBeenCalledWith(manyMembers, 10);
    });
  });

  describe('removeMember', () => {
    beforeEach(() => {
      mockInteraction.options.getString.mockReturnValue('<@123456789>');
      DiscordUtils.extractUserId.mockReturnValue('123456789');
    });

    it('should remove member successfully', async () => {
      mockMemberManager.removeMemberByDiscordId.mockResolvedValue(mockMember);

      await discordCommands.removeMember(mockInteraction, mockInteraction.options);

      expect(DiscordUtils.extractUserId).toHaveBeenCalledWith('<@123456789>');
      expect(mockMemberManager.removeMemberByDiscordId).toHaveBeenCalledWith('123456789');
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)]
      });
    });

    it('should handle invalid user input', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      await discordCommands.removeMember(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Invalid user. Please use @mention or a valid user ID.',
        ephemeral: true
      });
    });

    it('should handle non-existent member', async () => {
      mockMemberManager.removeMemberByDiscordId.mockResolvedValue(null);

      await discordCommands.removeMember(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ User not found in team members.',
        ephemeral: true
      });
    });

    it('should handle removal errors', async () => {
      const error = new Error('Removal failed');
      mockMemberManager.removeMemberByDiscordId.mockRejectedValue(error);

      await discordCommands.removeMember(mockInteraction, mockInteraction.options);

      expect(logger.discord.error).toHaveBeenCalledWith('Error removing member', expect.any(Object));
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to remove member.',
        ephemeral: true
      });
    });
  });

  describe('deactivateMember', () => {
    beforeEach(() => {
      mockInteraction.options.getString.mockReturnValue('<@123456789>');
      DiscordUtils.extractUserId.mockReturnValue('123456789');
      mockMemberManager.getMemberByDiscordId.mockResolvedValue(mockMember);
    });

    it('should deactivate member successfully', async () => {
      mockMemberManager.deactivateMember.mockResolvedValue(true);

      await discordCommands.deactivateMember(mockInteraction, mockInteraction.options);

      expect(mockMemberManager.getMemberByDiscordId).toHaveBeenCalledWith('123456789');
      expect(mockMemberManager.deactivateMember).toHaveBeenCalledWith(12345);
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)]
      });
    });

    it('should handle invalid user input', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      await discordCommands.deactivateMember(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Invalid user. Please use @mention or a valid user ID.',
        ephemeral: true
      });
    });

    it('should handle non-existent member', async () => {
      mockMemberManager.getMemberByDiscordId.mockResolvedValue(null);

      await discordCommands.deactivateMember(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ User not found in team members.',
        ephemeral: true
      });
    });

    it('should handle deactivation failure', async () => {
      mockMemberManager.deactivateMember.mockResolvedValue(false);

      await discordCommands.deactivateMember(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to deactivate member.',
        ephemeral: true
      });
    });
  });

  describe('reactivateMember', () => {
    beforeEach(() => {
      mockInteraction.options.getString.mockReturnValue('<@123456789>');
      DiscordUtils.extractUserId.mockReturnValue('123456789');
      // Mock the Map methods properly
      mockActivityProcessor.memberManager.discordToStrava = new Map([['123456789', '12345']]);
      mockActivityProcessor.memberManager.members = new Map([['12345', mockMember]]);
    });

    it('should reactivate member successfully', async () => {
      mockMemberManager.reactivateMember.mockResolvedValue(true);

      await discordCommands.reactivateMember(mockInteraction, mockInteraction.options);

      expect(mockMemberManager.reactivateMember).toHaveBeenCalledWith(12345);
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)]
      });
    });

    it('should handle non-existent member', async () => {
      mockActivityProcessor.memberManager.discordToStrava = new Map(); // Empty map

      await discordCommands.reactivateMember(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ User not found in team members.',
        ephemeral: true
      });
    });

    it('should handle reactivation failure', async () => {
      mockMemberManager.reactivateMember.mockResolvedValue(false);

      await discordCommands.reactivateMember(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to reactivate member.',
        ephemeral: true
      });
    });
  });

  describe('handleRegisterCommand', () => {
    it('should provide registration URL for new user', async () => {
      mockMemberManager.getMemberByDiscordId.mockResolvedValue(null);

      await discordCommands.handleRegisterCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)],
        ephemeral: true
      });
    });

    it('should handle already registered user', async () => {
      mockMemberManager.getMemberByDiscordId.mockResolvedValue(mockMember);

      await discordCommands.handleRegisterCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '✅ You\'re already registered as **Test User**.',
        ephemeral: true
      });
    });

    it('should handle member without display name', async () => {
      const memberWithoutDisplayName = {
        ...mockMember,
        discordUser: null
      };
      mockMemberManager.getMemberByDiscordId.mockResolvedValue(memberWithoutDisplayName);

      await discordCommands.handleRegisterCommand(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '✅ You\'re already registered as **John Doe**.',
        ephemeral: true
      });
    });
  });

  describe('handleBotStatusCommand', () => {
    beforeEach(() => {
      mockActivityProcessor.getStats.mockReturnValue({
        processedActivities: 50,
        uptime: 7200,
        memoryUsage: { heapUsed: 52428800 },
        activityQueue: { totalQueued: 5, delayMinutes: 15 }
      });
      mockMemberManager.getStats.mockReturnValue({
        active: 10,
        inactive: 2,
        total: 12
      });
      mockStravaAPI.getRateLimiterStats.mockReturnValue({
        shortTerm: { used: 100, limit: 1000 },
        daily: { used: 5000, limit: 25000 },
        queueLength: 2
      });
    });

    it('should display comprehensive bot status', async () => {
      await discordCommands.handleBotStatusCommand(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(mockActivityProcessor.getStats).toHaveBeenCalled();
      expect(mockMemberManager.getStats).toHaveBeenCalled();
      expect(mockStravaAPI.getRateLimiterStats).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)]
      });
    });

    it('should handle status retrieval errors', async () => {
      const error = new Error('Stats unavailable');
      mockActivityProcessor.getStats.mockImplementation(() => {
        throw error;
      });

      await discordCommands.handleBotStatusCommand(mockInteraction);

      expect(logger.discord.error).toHaveBeenCalledWith('Error getting bot status', expect.any(Object));
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to retrieve bot status.',
        ephemeral: true
      });
    });
  });

  describe('handleLastActivityCommand', () => {
    beforeEach(() => {
      mockInteraction.options.getString.mockReturnValue('Test User');
      jest.spyOn(discordCommands, 'findMemberByInput').mockResolvedValue(mockMember);
      mockMemberManager.getValidAccessToken.mockResolvedValue('valid_token');
      mockStravaAPI.getAthleteActivities.mockResolvedValue([mockActivity]);
      mockStravaAPI.getActivity.mockResolvedValue(mockActivity);
      mockStravaAPI.shouldPostActivity.mockReturnValue(true);
      mockStravaAPI.processActivityWithStreams.mockResolvedValue(mockActivity);
    });

    it('should display member\'s last activity successfully', async () => {
      await discordCommands.handleLastActivityCommand(mockInteraction, mockInteraction.options);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(discordCommands.findMemberByInput).toHaveBeenCalledWith('Test User');
      expect(mockMemberManager.getValidAccessToken).toHaveBeenCalledWith(mockMember);
      expect(mockStravaAPI.getAthleteActivities).toHaveBeenCalledWith('valid_token', 1, 10);
      expect(ActivityEmbedBuilder.createActivityEmbed).toHaveBeenCalledWith(mockActivity, { type: 'latest' });
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: [expect.any(Object)]
      });
    });

    it('should handle member not found', async () => {
      jest.spyOn(discordCommands, 'findMemberByInput').mockResolvedValue(null);

      await discordCommands.handleLastActivityCommand(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Team member not found. Use `/members list` to see all registered members.'
      });
    });

    it('should handle invalid access token', async () => {
      mockMemberManager.getValidAccessToken.mockResolvedValue(null);

      await discordCommands.handleLastActivityCommand(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Unable to access activities for **Test User**. They may need to re-authorize.'
      });
    });

    it('should handle no recent activities', async () => {
      mockStravaAPI.getAthleteActivities.mockResolvedValue([]);

      await discordCommands.handleLastActivityCommand(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '📭 No recent activities found for **Test User**.'
      });
    });

    it('should handle no public activities', async () => {
      mockStravaAPI.shouldPostActivity.mockReturnValue(false);

      await discordCommands.handleLastActivityCommand(mockInteraction, mockInteraction.options);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '🔒 **Test User** has no recent public activities to display.'
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Strava API error');
      mockStravaAPI.getAthleteActivities.mockRejectedValue(error);

      await discordCommands.handleLastActivityCommand(mockInteraction, mockInteraction.options);

      expect(logger.discord.error).toHaveBeenCalledWith('Error fetching last activity', expect.any(Object));
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to fetch the last activity. Please try again later.'
      });
    });
  });

  describe('findMemberByInput', () => {
    beforeEach(() => {
      mockMemberManager.getAllMembers.mockResolvedValue([mockMember]);
    });

    it('should find member by Discord mention', async () => {
      DiscordUtils.extractUserId.mockReturnValue('123456789');
      mockMemberManager.getMemberByDiscordId.mockResolvedValue(mockMember);

      const result = await discordCommands.findMemberByInput('<@123456789>');

      expect(DiscordUtils.extractUserId).toHaveBeenCalledWith('<@123456789>');
      expect(mockMemberManager.getMemberByDiscordId).toHaveBeenCalledWith('123456789');
      expect(result).toBe(mockMember);
    });

    it('should find member by first name', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      const result = await discordCommands.findMemberByInput('john');

      expect(result).toBe(mockMember);
    });

    it('should find member by last name', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      const result = await discordCommands.findMemberByInput('doe');

      expect(result).toBe(mockMember);
    });

    it('should find member by full name', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      const result = await discordCommands.findMemberByInput('john doe');

      expect(result).toBe(mockMember);
    });

    it('should find member by Discord display name', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      const result = await discordCommands.findMemberByInput('test user');

      expect(result).toBe(mockMember);
    });

    it('should handle case insensitive search', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      const result = await discordCommands.findMemberByInput('JOHN');

      expect(result).toBe(mockMember);
    });

    it('should return undefined if no match found', async () => {
      DiscordUtils.extractUserId.mockReturnValue(null);

      const result = await discordCommands.findMemberByInput('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('handleAutocomplete', () => {
    beforeEach(() => {
      mockInteraction.commandName = 'last';
      mockInteraction.options.getFocused.mockReturnValue({
        name: 'member',
        value: 'jo'
      });
      mockMemberManager.getAllMembers.mockResolvedValue([
        mockMember,
        {
          ...mockMember,
          athlete: { ...mockMember.athlete, id: 67890, firstname: 'Jane', lastname: 'Smith' },
          discordUser: { displayName: 'Jane Smith' }
        }
      ]);
    });

    it('should provide autocomplete choices for member names', async () => {
      await discordCommands.handleAutocomplete(mockInteraction);

      expect(mockMemberManager.getAllMembers).toHaveBeenCalled();
      expect(mockInteraction.respond).toHaveBeenCalledWith([
        { name: 'Test User', value: 'Test User' }
      ]);
    });

    it('should filter choices based on search term', async () => {
      mockInteraction.options.getFocused.mockReturnValue({
        name: 'member',
        value: 'jane'
      });

      await discordCommands.handleAutocomplete(mockInteraction);

      expect(mockInteraction.respond).toHaveBeenCalledWith([
        { name: 'Jane Smith', value: 'Jane Smith' }
      ]);
    });

    it('should limit choices to 25 items', async () => {
      const manyMembers = Array(30).fill(0).map((_, i) => ({
        ...mockMember,
        athlete: { ...mockMember.athlete, id: i, firstname: `User${i}`, lastname: 'Test' },
        discordUser: { displayName: `User${i} Test` }
      }));
      mockMemberManager.getAllMembers.mockResolvedValue(manyMembers);
      mockInteraction.options.getFocused.mockReturnValue({
        name: 'member',
        value: 'user'
      });

      await discordCommands.handleAutocomplete(mockInteraction);

      expect(mockInteraction.respond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: expect.stringContaining('User') })
        ])
      );
      expect(mockInteraction.respond.mock.calls[0][0]).toHaveLength(25);
    });

    it('should handle autocomplete errors gracefully', async () => {
      const error = new Error('Database error');
      mockMemberManager.getAllMembers.mockRejectedValue(error);

      await discordCommands.handleAutocomplete(mockInteraction);

      expect(logger.discord.error).toHaveBeenCalledWith('Error in autocomplete', expect.any(Object));
      expect(mockInteraction.respond).toHaveBeenCalledWith([]);
    });

    it('should ignore autocomplete for non-last commands', async () => {
      mockInteraction.commandName = 'register';

      await discordCommands.handleAutocomplete(mockInteraction);

      expect(mockInteraction.respond).not.toHaveBeenCalled();
    });

    it('should handle members without Discord user data in autocomplete', async () => {
      const memberWithoutDiscord = {
        ...mockMember,
        discordUser: null
      };
      mockMemberManager.getAllMembers.mockResolvedValue([memberWithoutDiscord]);

      await discordCommands.handleAutocomplete(mockInteraction);

      expect(mockInteraction.respond).toHaveBeenCalledWith([
        { name: 'John Doe', value: 'John Doe' }
      ]);
    });
  });
});