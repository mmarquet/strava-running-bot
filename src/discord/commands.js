const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ActivityEmbedBuilder = require('../utils/EmbedBuilder');
const DiscordUtils = require('../utils/DiscordUtils');
const RaceManager = require('../managers/RaceManager');
const logger = require('../utils/Logger');
const config = require('../../config/config');
const { TIME, DISCORD } = require('../constants');
const DateUtils = require('../utils/DateUtils');

class DiscordCommands {
  constructor(activityProcessor) {
    this.activityProcessor = activityProcessor;
    this.raceManager = new RaceManager();
  }

  // Define all slash commands
  getCommands() {
    return [
      // Members list command
      new SlashCommandBuilder()
        .setName('members')
        .setDescription('Manage team members')
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List all registered team members')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('Remove a team member')
            .addStringOption(option =>
              option
                .setName('user')
                .setDescription('Discord user to remove (@mention or user ID)')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('deactivate')
            .setDescription('Temporarily deactivate a team member')
            .addStringOption(option =>
              option
                .setName('user')
                .setDescription('Discord user to deactivate (@mention or user ID)')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('reactivate')
            .setDescription('Reactivate a team member')
            .addStringOption(option =>
              option
                .setName('user')
                .setDescription('Discord user to reactivate (@mention or user ID)')
                .setRequired(true)
            )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      // Register command
      new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register yourself with Strava to join the team'),

      // Bot status command
      new SlashCommandBuilder()
        .setName('botstatus')
        .setDescription('Show bot status and statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),


      // Last activity command
      new SlashCommandBuilder()
        .setName('last')
        .setDescription('Show the last activity from a team member')
        .addStringOption(option =>
          option
            .setName('member')
            .setDescription('Team member name (first name, last name, or @mention)')
            .setRequired(true)
            .setAutocomplete(true)
        ),

      // Race management commands
      new SlashCommandBuilder()
        .setName('race')
        .setDescription('Manage your upcoming races')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Add an upcoming race')
            .addStringOption(option =>
              option
                .setName('name')
                .setDescription('Race name')
                .setRequired(true)
                .setMaxLength(100)
            )
            .addStringOption(option =>
              option
                .setName('date')
                .setDescription('Race date (DD-MM-YYYY format, e.g. 21-04-2025)')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('race_type')
                .setDescription('Type of race')
                .setRequired(true)
                .addChoices(
                  { name: 'Road Race', value: 'road' },
                  { name: 'Trail Race', value: 'trail' }
                )
            )
            .addStringOption(option =>
              option
                .setName('distance_preset')
                .setDescription('Distance (for road races)')
                .setRequired(false)
                .addChoices(
                  { name: '5K', value: '5' },
                  { name: '10K', value: '10' },
                  { name: 'Half Marathon (21.1K)', value: '21.1' },
                  { name: 'Marathon (42.2K)', value: '42.2' },
                  { name: 'Other (specify custom distance)', value: 'other' }
                )
            )
            .addStringOption(option =>
              option
                .setName('custom_distance')
                .setDescription('Custom distance (km) - use when distance_preset is "Other" or for trail races')
                .setRequired(false)
                .setMaxLength(10)
            )
            .addStringOption(option =>
              option
                .setName('location')
                .setDescription('Race location')
                .setRequired(false)
                .setMaxLength(100)
            )
            .addStringOption(option =>
              option
                .setName('goal')
                .setDescription('Goal time (e.g. 1:45:00)')
                .setRequired(false)
                .setMaxLength(20)
            )
            .addStringOption(option =>
              option
                .setName('notes')
                .setDescription('Additional notes')
                .setRequired(false)
                .setMaxLength(500)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List your races')
            .addStringOption(option =>
              option
                .setName('status')
                .setDescription('Filter by status')
                .setRequired(false)
                .addChoices(
                  { name: 'Registered', value: 'registered' },
                  { name: 'Completed', value: 'completed' },
                  { name: 'Cancelled', value: 'cancelled' }
                )
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('Remove a race')
            .addIntegerOption(option =>
              option
                .setName('race_id')
                .setDescription('Race ID (from race list)')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('update')
            .setDescription('Update race details')
            .addIntegerOption(option =>
              option
                .setName('race_id')
                .setDescription('Race ID (from race list)')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('name')
                .setDescription('New race name')
                .setRequired(false)
                .setMaxLength(100)
            )
            .addStringOption(option =>
              option
                .setName('date')
                .setDescription('New race date (DD-MM-YYYY)')
                .setRequired(false)
            )
            .addStringOption(option =>
              option
                .setName('distance')
                .setDescription('New distance')
                .setRequired(false)
                .setMaxLength(20)
            )
            .addStringOption(option =>
              option
                .setName('location')
                .setDescription('New location')
                .setRequired(false)
                .setMaxLength(100)
            )
            .addStringOption(option =>
              option
                .setName('goal')
                .setDescription('New goal time')
                .setRequired(false)
                .setMaxLength(20)
            )
            .addStringOption(option =>
              option
                .setName('status')
                .setDescription('Update status')
                .setRequired(false)
                .addChoices(
                  { name: 'Registered', value: 'registered' },
                  { name: 'Completed', value: 'completed' },
                  { name: 'Cancelled', value: 'cancelled' },
                  { name: 'DNS (Did Not Start)', value: 'dns' },
                  { name: 'DNF (Did Not Finish)', value: 'dnf' }
                )
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('upcoming')
            .setDescription('Show upcoming races for all team members')
            .addIntegerOption(option =>
              option
                .setName('days')
                .setDescription('Number of days ahead to show (default: 30)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(365)
            )
        ),

      // Team races command (admin only)
      new SlashCommandBuilder()
        .setName('teamraces')
        .setDescription('View all team races')
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List all team races')
            .addStringOption(option =>
              option
                .setName('status')
                .setDescription('Filter by status')
                .setRequired(false)
                .addChoices(
                  { name: 'Registered', value: 'registered' },
                  { name: 'Completed', value: 'completed' },
                  { name: 'Cancelled', value: 'cancelled' }
                )
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('upcoming')
            .setDescription('Show upcoming races for all members')
            .addIntegerOption(option =>
              option
                .setName('days')
                .setDescription('Number of days ahead to show (default: 30)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(365)
            )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      // Bot settings command (admin only)
      new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Manage bot settings')
        .addSubcommand(subcommand =>
          subcommand
            .setName('channel')
            .setDescription('Set the Discord channel for bot activities')
            .addChannelOption(option =>
              option
                .setName('channel')
                .setDescription('Discord channel to use (leave empty to use current channel)')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('view')
            .setDescription('View current bot settings')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      // Scheduler test commands (admin only)
      new SlashCommandBuilder()
        .setName('scheduler')
        .setDescription('Test race scheduler functionality')
        .addSubcommand(subcommand =>
          subcommand
            .setName('weekly')
            .setDescription('Manually trigger weekly race announcement')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('monthly')
            .setDescription('Manually trigger monthly race announcement')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('status')
            .setDescription('Show scheduler status')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];
  }

  // Handle slash command interactions
  async handleCommand(interaction) {
    const { commandName, options } = interaction;

    logger.discord.info('Command received', {
      command: commandName,
      user: interaction.user.tag,
      userId: interaction.user.id,
      guild: interaction.guild?.name,
      channel: interaction.channel?.name,
      interactionId: interaction.id,
      createdTimestamp: interaction.createdTimestamp,
      currentTimestamp: Date.now(),
      ageMs: Date.now() - interaction.createdTimestamp
    });

    try {
      switch (commandName) {
      case 'members':
        await this.handleMembersCommand(interaction, options);
        break;
      case 'register':
        await this.handleRegisterCommand(interaction);
        break;
      case 'botstatus':
        await this.handleBotStatusCommand(interaction);
        break;
      case 'last':
        await this.handleLastActivityCommand(interaction, options);
        break;
      case 'race':
        await this.handleRaceCommand(interaction, options);
        break;
      case 'teamraces':
        await this.handleTeamRacesCommand(interaction, options);
        break;
      case 'settings':
        await this.handleSettingsCommand(interaction, options);
        break;
      case 'scheduler':
        await this.handleSchedulerCommand(interaction, options);
        break;
      default:
        await interaction.reply({ 
          content: '❌ Unknown command', 
          ephemeral: true 
        });
      }
    } catch (error) {
      logger.discord.error('Error handling command', {
        command: commandName,
        user: interaction.user.tag,
        guild: interaction.guild?.name,
        error: error.message,
        stack: error.stack
      });
      
      const errorMessage = '❌ An error occurred while processing your command.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  // Handle members subcommands
  async handleMembersCommand(interaction, options) {
    const subcommand = options.getSubcommand();

    switch (subcommand) {
    case 'list':
      await this.listMembers(interaction);
      break;
    case 'remove':
      await this.removeMember(interaction, options);
      break;
    case 'deactivate':
      await this.deactivateMember(interaction, options);
      break;
    case 'reactivate':
      await this.reactivateMember(interaction, options);
      break;
    }
  }

  // List all members
  async listMembers(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const members = await this.activityProcessor.memberManager.getAllMembers();
      const memberStats = await this.activityProcessor.memberManager.getStats();
      
      // Load Discord user data from JSON fallback for missing guild cache
      const jsonMemberData = {};
      try {
        const fs = require('node:fs').promises;
        const path = require('node:path');
        const jsonPath = path.join(__dirname, '../../data/members.json');
        const jsonData = await fs.readFile(jsonPath, 'utf8');
        const memberDataJson = JSON.parse(jsonData);
        
        // Create lookup by discordUserId
        for (const jsonMember of memberDataJson.members) {
          jsonMemberData[jsonMember.discordUserId] = jsonMember.discordUser;
        }
      } catch (error) {
        logger.discord.debug('Could not load JSON member data for fallback', { error: error.message });
      }

      if (members.length === 0) {
        await interaction.editReply({
          content: '📭 No team members registered yet.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏃 Team Members')
        .setColor('#FC4C02')
        .setDescription(`Total: ${memberStats.active} active, ${memberStats.inactive} inactive`)
        .setTimestamp();

      // Group members into chunks of 10 for better display
      const memberChunks = DiscordUtils.chunkArray(members, 10);
      
      for (const member of memberChunks[0]) {
        const user = interaction.guild?.members.cache.get(member.discordUserId);
        const displayName = user ? `<@${member.discordUserId}>` : `User ID: ${member.discordUserId}`;
        
        // Get Discord name with multiple fallbacks
        let discordName;
        if (user?.displayName) {
          // First: Try guild member cache
          discordName = user.displayName;
        } else if (jsonMemberData[member.discordUserId]) {
          // Second: Try JSON fallback data
          discordName = jsonMemberData[member.discordUserId].displayName || jsonMemberData[member.discordUserId].username;
        } else if (member.discordUser) {
          // Third: Try stored database data (usually null)
          discordName = member.discordUser.displayName;
        } else {
          // Last: Use truncated user ID
          discordName = `User ${member.discordUserId.slice(-4)}`;
        }
        
        // Show Strava name in the details (field value)
        const stravaName = member.athlete ? `${member.athlete.firstname} ${member.athlete.lastname}` : 'Unknown';
        
        embed.addFields([{
          name: `👤 ${discordName}`,
          value: `Strava: ${stravaName}\nDiscord: ${displayName}\nRegistered: ${new Date(member.registeredAt).toLocaleDateString()}\nStatus: ${member.isActive ? '🟢 Active' : '🔴 Inactive'}`,
          inline: true
        }]);
      }

      if (memberChunks.length > 1) {
        embed.setFooter({ text: `Showing first 10 of ${members.length} members` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error listing members', {
        user: interaction.user.tag,
        error: error.message
      });
      await interaction.editReply({
        content: '❌ Failed to retrieve member list.',
        ephemeral: true
      });
    }
  }

  // Remove a member
  async removeMember(interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userInput = options.getString('user');
      const userId = DiscordUtils.extractUserId(userInput);

      if (!userId) {
        await interaction.editReply({
          content: '❌ Invalid user. Please use @mention or a valid user ID.',
          ephemeral: true
        });
        return;
      }

      const removedMember = await this.activityProcessor.memberManager.removeMemberByDiscordId(userId);

      if (removedMember) {
        const memberName = removedMember.discordUser ? removedMember.discordUser.displayName : `${removedMember.athlete.firstname} ${removedMember.athlete.lastname}`;
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Member Removed')
          .setColor('#FF4444')
          .setDescription(`Successfully removed **${memberName}** from the team.`)
          .addFields([{
            name: 'Discord User',
            value: `<@${userId}>`,
            inline: true
          }])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          content: '❌ User not found in team members.',
          ephemeral: true
        });
      }

    } catch (error) {
      logger.discord.error('Error removing member', {
        user: interaction.user.tag,
        targetUser: options.getString('user'),
        error: error.message
      });
      await interaction.editReply({
        content: '❌ Failed to remove member.',
        ephemeral: true
      });
    }
  }

  // Deactivate a member
  async deactivateMember(interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userInput = options.getString('user');
      const userId = DiscordUtils.extractUserId(userInput);

      if (!userId) {
        await interaction.editReply({
          content: '❌ Invalid user. Please use @mention or a valid user ID.',
          ephemeral: true
        });
        return;
      }

      const member = await this.activityProcessor.memberManager.getMemberByDiscordId(userId);
      
      if (!member) {
        await interaction.editReply({
          content: '❌ User not found in team members.',
          ephemeral: true
        });
        return;
      }

      const success = await this.activityProcessor.memberManager.deactivateMember(member.athlete.id);

      if (success) {
        const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
        const embed = new EmbedBuilder()
          .setTitle('🔴 Member Deactivated')
          .setColor('#FF8800')
          .setDescription(`**${memberName}** has been deactivated. Their activities will no longer be posted.`)
          .addFields([{
            name: 'Discord User',
            value: `<@${userId}>`,
            inline: true
          }])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          content: '❌ Failed to deactivate member.',
          ephemeral: true
        });
      }

    } catch (error) {
      logger.discord.error('Error deactivating member', {
        user: interaction.user.tag,
        targetUser: options.getString('user'),
        error: error.message
      });
      await interaction.editReply({
        content: '❌ Failed to deactivate member.',
        ephemeral: true
      });
    }
  }

  // Reactivate a member
  async reactivateMember(interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userInput = options.getString('user');
      const userId = DiscordUtils.extractUserId(userInput);

      if (!userId) {
        await interaction.editReply({
          content: '❌ Invalid user. Please use @mention or a valid user ID.',
          ephemeral: true
        });
        return;
      }

      // Get member even if inactive
      const athleteId = this.activityProcessor.memberManager.discordToStrava.get(userId);
      const member = athleteId ? this.activityProcessor.memberManager.members.get(athleteId) : null;
      
      if (!member) {
        await interaction.editReply({
          content: '❌ User not found in team members.',
          ephemeral: true
        });
        return;
      }

      const success = await this.activityProcessor.memberManager.reactivateMember(member.athlete.id);

      if (success) {
        const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
        const embed = new EmbedBuilder()
          .setTitle('🟢 Member Reactivated')
          .setColor('#44FF44')
          .setDescription(`**${memberName}** has been reactivated. Their activities will now be posted again.`)
          .addFields([{
            name: 'Discord User',
            value: `<@${userId}>`,
            inline: true
          }])
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({
          content: '❌ Failed to reactivate member.',
          ephemeral: true
        });
      }

    } catch (error) {
      logger.discord.error('Error reactivating member', {
        user: interaction.user.tag,
        targetUser: options.getString('user'),
        error: error.message
      });
      await interaction.editReply({
        content: '❌ Failed to reactivate member.',
        ephemeral: true
      });
    }
  }

  // Handle register command
  async handleRegisterCommand(interaction) {
    // Acknowledge immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const existingMember = await this.activityProcessor.memberManager.getMemberByDiscordId(userId);

    if (existingMember) {
      const memberName = existingMember.discordUser ? existingMember.discordUser.displayName : `${existingMember.athlete.firstname} ${existingMember.athlete.lastname}`;
      await interaction.editReply({
        content: `✅ You're already registered as **${memberName}**.`
      });
      return;
    }

    const registerUrl = `${config.server.baseUrl}/auth/strava?user_id=${userId}`;

    const embed = new EmbedBuilder()
      .setTitle('🔗 Register with Strava')
      .setColor('#FC4C02')
      .setDescription('Click the link below to connect your Strava account and join the team!\n\n**Data Usage:** This app will access your public Strava activities to post them to this Discord channel. We only process public activities and respect your privacy settings.\n\n**By registering, you authorize this app to access your public Strava activities.**')
      .addFields([{
        name: '📝 Registration Steps',
        value: `1. [Click here to register](${registerUrl})\n2. Authorize the app on Strava\n3. Return to Discord when complete`,
        inline: false
      }])
      .setFooter({ 
        text: 'Powered by Strava • This link is personalized for your Discord account',
        iconURL: 'https://cdn.worldvectorlogo.com/logos/strava-1.svg'
      })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed]
    });
  }


  // Handle bot status command
  async handleBotStatusCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const stats = await this.activityProcessor.getStats();
      const memberStats = await this.activityProcessor.memberManager.getStats();
      const rateLimitStats = this.activityProcessor.stravaAPI.getRateLimiterStats();

      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Status')
        .setColor('#00FF88')
        .addFields([
          {
            name: '👥 Members',
            value: `Active: ${memberStats.active}\nInactive: ${memberStats.inactive}\nTotal: ${memberStats.total}`,
            inline: true
          },
          {
            name: '📊 Activities',
            value: `Processed: ${stats.processedActivities}`,
            inline: true
          },
          {
            name: '⏰ Uptime',
            value: `${Math.floor(stats.uptime / TIME.SECONDS_PER_HOUR)}h ${Math.floor((stats.uptime % TIME.SECONDS_PER_HOUR) / 60)}m`,
            inline: true
          },
          {
            name: '💾 Memory Usage',
            value: `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`,
            inline: true
          },
          {
            name: '📬 Activity Queue',
            value: `Queued: ${stats.activityQueue?.totalQueued || 0}\nDelay: ${stats.activityQueue?.delayMinutes || 0}min`,
            inline: true
          },
          {
            name: '🚦 API Rate Limits',
            value: `15min: ${rateLimitStats.shortTerm.used}/${rateLimitStats.shortTerm.limit}\nDaily: ${rateLimitStats.daily.used}/${rateLimitStats.daily.limit}\nQueue: ${rateLimitStats.queueLength}`,
            inline: true
          }
        ])
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error getting bot status', {
        user: interaction.user.tag,
        error: error.message
      });
      await interaction.editReply({
        content: '❌ Failed to retrieve bot status.',
        ephemeral: true
      });
    }
  }

  // Handle last activity command
  async handleLastActivityCommand(interaction, options) {
    const startTime = Date.now();
    logger.discord.info('handleLastActivityCommand: START', {
      interactionId: interaction.id,
      replied: interaction.replied,
      deferred: interaction.deferred,
      createdTimestamp: interaction.createdTimestamp,
      currentTimestamp: Date.now(),
      ageMs: Date.now() - interaction.createdTimestamp
    });

    try {
      logger.discord.info('handleLastActivityCommand: Calling deferReply()');
      await interaction.deferReply();
      logger.discord.info('handleLastActivityCommand: deferReply() completed', {
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      logger.discord.error('handleLastActivityCommand: deferReply() FAILED', {
        error: error.message,
        code: error.code,
        ageMs: Date.now() - interaction.createdTimestamp,
        durationMs: Date.now() - startTime
      });
      throw error;
    }

    try {
      const memberInput = options.getString('member');
      logger.discord.info('Processing /last command', {
        user: interaction.user.tag,
        memberInput: memberInput
      });
      const member = await this.findMemberByInput(memberInput);
      logger.discord.info('Member lookup result', {
        memberInput: memberInput,
        memberFound: !!member,
        memberId: member?.discordUserId
      });

      if (!member) {
        await interaction.editReply({
          content: '❌ Team member not found. Use `/members list` to see all registered members.',
        });
        return;
      }

      // Load JSON member data for Discord name fallback
      const jsonMemberData = {};
      try {
        const fs = require('node:fs').promises;
        const path = require('node:path');
        const jsonPath = path.join(__dirname, '../../data/members.json');
        const jsonData = await fs.readFile(jsonPath, 'utf8');
        const memberDataJson = JSON.parse(jsonData);
        
        // Create lookup by discordUserId
        for (const jsonMember of memberDataJson.members) {
          jsonMemberData[jsonMember.discordUserId] = jsonMember.discordUser;
        }
      } catch (error) {
        logger.discord.debug('Could not load JSON member data for fallback', { error: error.message });
      }

      // Helper function to get Discord name with fallbacks
      const getDiscordName = (member) => {
        const user = interaction.guild?.members.cache.get(member.discordUserId);
        if (user?.displayName) {
          return user.displayName;
        } else if (jsonMemberData[member.discordUserId]) {
          return jsonMemberData[member.discordUserId].displayName || jsonMemberData[member.discordUserId].username;
        } else if (member.discordUser) {
          return member.discordUser.displayName;
        } else if (member.athlete) {
          return `${member.athlete.firstname} ${member.athlete.lastname}`;
        } else {
          return `User ${member.discordUserId.slice(-4)}`;
        }
      };

      // Get valid access token for the member
      const accessToken = await this.activityProcessor.memberManager.getValidAccessToken(member);
      logger.discord.info('Access token check result', {
        memberInput: memberInput,
        hasAccessToken: !!accessToken
      });
      
      if (!accessToken) {
        const memberName = getDiscordName(member);
        await interaction.editReply({
          content: `❌ **${memberName}** needs to re-authorize with Strava to view their activities.\n` +
                   'Please use the `/register` command to reconnect your Strava account.',
        });
        return;
      }

      // Fetch their latest activities (get more to find latest public one)
      const activities = await this.activityProcessor.stravaAPI.getAthleteActivities(
        accessToken,
        1, // page
        10  // get up to 10 to find latest public activity
      );

      if (!activities || activities.length === 0) {
        const memberName = getDiscordName(member);
        await interaction.editReply({
          content: `📭 No recent activities found for **${memberName}**.`,
        });
        return;
      }

      // Find the latest public activity
      let publicActivity = null;
      for (const activity of activities) {
        // Get detailed activity data to check privacy settings
        const detailedActivity = await this.activityProcessor.stravaAPI.getActivity(
          activity.id,
          accessToken
        );

        // Check if this activity can be displayed (respects privacy settings, skip age filter for /last command)
        if (this.activityProcessor.stravaAPI.shouldPostActivity(detailedActivity, { skipAgeFilter: true })) {
          publicActivity = detailedActivity;
          break; // Found the latest public activity
        }
      }

      if (!publicActivity) {
        const memberName = getDiscordName(member);
        await interaction.editReply({
          content: `🔒 **${memberName}** has no recent public activities to display.`,
        });
        return;
      }

      // Process the activity data for display with streams data for accurate GAP
      const processedActivity = await this.activityProcessor.stravaAPI.processActivityWithStreams(
        publicActivity,
        member.athlete,
        accessToken
      );

      // Create the same embed as used for posting activities
      const embed = ActivityEmbedBuilder.createActivityEmbed(processedActivity, { type: 'latest' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error fetching last activity', {
        user: interaction.user.tag,
        memberInput: options.getString('member'),
        error: error.message,
        stack: error.stack
      });
      await interaction.editReply({
        content: '❌ Failed to fetch the last activity. Please try again later.',
      });
    }
  }


  // Find member by various input types (name, mention, etc.)
  async findMemberByInput(input) {
    const members = await this.activityProcessor.memberManager.getAllMembers();

    // Try to extract Discord user ID from mention
    const userId = DiscordUtils.extractUserId(input);
    if (userId) {
      return await this.activityProcessor.memberManager.getMemberByDiscordId(userId);
    }

    // Search by name (Discord name, first name, last name, or full name)
    const searchTerm = input.toLowerCase().trim();
    
    return members.find(member => {
      const discordName = member.discordUser ? member.discordUser.displayName.toLowerCase() : '';
      const firstName = member.athlete ? member.athlete.firstname.toLowerCase() : '';
      const lastName = member.athlete ? member.athlete.lastname.toLowerCase() : '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      return discordName.includes(searchTerm) || 
             discordName === searchTerm ||
             firstName.includes(searchTerm) || 
             lastName.includes(searchTerm) || 
             fullName.includes(searchTerm) ||
             firstName === searchTerm ||
             lastName === searchTerm ||
             fullName === searchTerm;
    });
  }

  // Autocomplete for member names
  async handleAutocomplete(interaction) {
    if (interaction.commandName !== 'last') return;

    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'member') {
      try {
        const members = await this.activityProcessor.memberManager.getAllMembers();
        const searchTerm = (focusedOption.value || '').toLowerCase();
        
        const choices = members
          .filter(member => member.athlete && member.athlete.firstname && member.athlete.lastname)
          .filter(member => {
            const firstName = member.athlete.firstname?.toLowerCase() || '';
            const lastName = member.athlete.lastname?.toLowerCase() || '';
            const memberName = member.discordUser?.displayName?.toLowerCase() || `${firstName} ${lastName}`;
            const fullName = `${firstName} ${lastName}`.trim();

            return memberName.includes(searchTerm) ||
                   fullName.includes(searchTerm) ||
                   firstName.includes(searchTerm) ||
                   lastName.includes(searchTerm);
          })
          .slice(0, DISCORD.MAX_EMBED_FIELDS) // Discord limits to 25 choices
          .map(member => ({
            name: member.discordUser?.displayName || `${member.athlete.firstname} ${member.athlete.lastname}`,
            value: member.discordUser?.displayName || `${member.athlete.firstname} ${member.athlete.lastname}`
          }));

        await interaction.respond(choices);
      } catch (error) {
        logger.discord.error('Error in autocomplete', {
          user: interaction.user.tag,
          focusedValue: focusedOption.value,
          error: error.message
        });
        await interaction.respond([]);
      }
    }
  }

  // === RACE COMMAND HANDLERS ===

  // Handle race subcommands
  async handleRaceCommand(interaction, options) {
    const subcommand = options.getSubcommand();

    switch (subcommand) {
    case 'add':
      await this.addRace(interaction, options);
      break;
    case 'list':
      await this.listUserRaces(interaction, options);
      break;
    case 'remove':
      await this.removeRace(interaction, options);
      break;
    case 'update':
      await this.updateRace(interaction, options);
      break;
    case 'upcoming':
      await this.showUpcomingRaces(interaction, options, true);
      break;
    }
  }

  // Handle team races subcommands (admin only)
  async handleTeamRacesCommand(interaction, options) {
    const subcommand = options.getSubcommand();

    switch (subcommand) {
    case 'list':
      await this.listAllTeamRaces(interaction, options);
      break;
    case 'upcoming':
      await this.showUpcomingRaces(interaction, options, true);
      break;
    }
  }

  // Helper: Process distance for race based on type and user input
  _processRaceDistance(raceType, distancePreset, customDistance) {
    let finalDistance = null;
    let distanceKm = null;
    
    if (raceType === 'road') {
      if (distancePreset && distancePreset !== 'other') {
        // Use preset distance
        const km = Number.parseFloat(distancePreset);
        finalDistance = this.formatDistanceDisplay(km);
        distanceKm = km.toString();
      } else if (distancePreset === 'other' && customDistance) {
        // Use custom distance for "other" road race
        const km = Number.parseFloat(customDistance.replaceAll(/[^\d.]/g, ''));
        if (Number.isNaN(km) || km <= 0) {
          throw new Error('Custom distance must be a valid positive number');
        }
        finalDistance = `${km}km`;
        distanceKm = km.toString();
      }
    } else if (raceType === 'trail' && customDistance) {
      // Trail races always use custom distance
      const km = Number.parseFloat(customDistance.replaceAll(/[^\d.]/g, ''));
      if (Number.isNaN(km) || km <= 0) {
        throw new Error('Distance must be a valid positive number for trail races');
      }
      finalDistance = `${km}km`;
      distanceKm = km.toString();
    }
    
    return { finalDistance, distanceKm };
  }

  // Add a new race
  async addRace(interaction, options) {
    await interaction.deferReply({ ephemeral: false });

    try {
      const raceType = options.getString('race_type');
      const distancePreset = options.getString('distance_preset');
      const customDistance = options.getString('custom_distance');
      
      // Process distance based on race type and user input
      const { finalDistance, distanceKm } = this._processRaceDistance(raceType, distancePreset, customDistance);

      const raceData = {
        name: options.getString('name'),
        raceDate: options.getString('date'),
        raceType: raceType,
        distance: finalDistance,
        distanceKm: distanceKm,
        location: options.getString('location'),
        goalTime: options.getString('goal'),
        notes: options.getString('notes')
      };

      const race = await this.raceManager.addRace(interaction.user.id, raceData);

      const embed = new EmbedBuilder()
        .setTitle(`🏃 ${raceType === 'road' ? '🛣️' : '�️'} Race Added!`)
        .setColor(raceType === 'road' ? '#00FF88' : '#8B4513')
        .setDescription(this.raceManager.formatRaceDisplay(race, false))
        .addFields([{
          name: 'Race ID',
          value: `#${race.id}`,
          inline: true
        }])
        .setFooter({ text: 'Use /race list to see all your races' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error adding race', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: `❌ Failed to add race: ${error.message}`,
        ephemeral: false
      });
    }
  }

  // Helper function to format distance display for standard race distances
  formatDistanceDisplay(km) {
    if (km === 5) return '5K';
    if (km === 10) return '10K';
    if (km === 21.1) return 'Half Marathon (21.1K)';
    if (km === 42.2) return 'Marathon (42.2K)';
    return `${km}km`;
  }

  // List user's races
  async listUserRaces(interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const status = options.getString('status');
      const filterOptions = status ? { status } : {};
      
      const races = await this.raceManager.getMemberRaces(interaction.user.id, filterOptions);

      if (races.length === 0) {
        const statusText = status ? ` with status "${status}"` : '';
        await interaction.editReply({
          content: `📭 No races found${statusText}. Use \`/race add\` to add your first race!`,
          ephemeral: true
        });
        return;
      }

      const statusSuffix = status ? ` (${status})` : '';
      const embed = new EmbedBuilder()
        .setTitle(`🏃 Your Races${statusSuffix}`)
        .setColor('#FC4C02')
        .setDescription(`Found ${races.length} race${races.length === 1 ? '' : 's'}`)
        .setTimestamp();

      // Group races into chunks of 5 for better display
      const raceChunks = DiscordUtils.chunkArray(races, 5);
      
      for (const race of raceChunks[0]) {
        embed.addFields([{
          name: `#${race.id} - ${race.name}`,
          value: this.raceManager.formatRaceDisplay(race),
          inline: false
        }]);
      }

      if (raceChunks.length > 1) {
        embed.setFooter({ text: `Showing first 5 of ${races.length} races` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error listing user races', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: '❌ Failed to retrieve your races.',
        ephemeral: true
      });
    }
  }

  // Remove a race
  async removeRace(interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const raceId = options.getInteger('race_id');
      
      const removedRace = await this.raceManager.removeRace(raceId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Race Removed')
        .setColor('#FF4444')
        .setDescription(`Successfully removed **${removedRace.name}**`)
        .addFields([
          {
            name: 'Race Date',
            value: DateUtils.formatForDisplay(removedRace.raceDate),
            inline: true
          },
          {
            name: 'Distance',
            value: removedRace.distance || 'N/A',
            inline: true
          }
        ])
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error removing race', {
        user: interaction.user.tag,
        raceId: options.getInteger('race_id'),
        error: error.message
      });
      
      await interaction.editReply({
        content: `❌ Failed to remove race: ${error.message}`,
        ephemeral: true
      });
    }
  }

  // Update a race
  async updateRace(interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const raceId = options.getInteger('race_id');
      
      const updates = {};
      if (options.getString('name')) updates.name = options.getString('name');
      if (options.getString('date')) updates.raceDate = options.getString('date');
      if (options.getString('distance')) updates.distance = options.getString('distance');
      if (options.getString('location')) updates.location = options.getString('location');
      if (options.getString('goal')) updates.goalTime = options.getString('goal');
      if (options.getString('status')) updates.status = options.getString('status');

      if (Object.keys(updates).length === 0) {
        await interaction.editReply({
          content: '❌ No updates provided. Please specify at least one field to update.',
          ephemeral: true
        });
        return;
      }

      const updatedRace = await this.raceManager.updateRace(raceId, interaction.user.id, updates);

      const embed = new EmbedBuilder()
        .setTitle('✏️ Race Updated')
        .setColor('#00AAFF')
        .setDescription(this.raceManager.formatRaceDisplay(updatedRace))
        .addFields([{
          name: 'Updated Fields',
          value: Object.keys(updates).map(key => `• ${key}`).join('\n'),
          inline: true
        }])
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error updating race', {
        user: interaction.user.tag,
        raceId: options.getInteger('race_id'),
        error: error.message
      });
      
      await interaction.editReply({
        content: `❌ Failed to update race: ${error.message}`,
        ephemeral: true
      });
    }
  }

  // Show upcoming races
  async showUpcomingRaces(interaction, options, isTeamCommand = false) {
    await interaction.deferReply({ ephemeral: !isTeamCommand });

    try {
      const days = options.getInteger('days') || 30;
      const upcomingRaces = await this.raceManager.getUpcomingRaces(days);

      if (upcomingRaces.length === 0) {
        await interaction.editReply({
          content: `📭 No upcoming races found in the next ${days} days.`,
          ephemeral: !isTeamCommand
        });
        return;
      }

      // Get member data for each race
      const racesWithMembers = await Promise.all(
        upcomingRaces.map(async (race) => {
          const member = await this.activityProcessor.memberManager.getMemberByAthleteId(race.member_athlete_id);
          return {
            ...race,
            memberName: member?.discordUser?.displayName || `${member?.athlete?.firstname} ${member?.athlete?.lastname}` || 'Unknown'
          };
        })
      );

      const embed = new EmbedBuilder()
        .setTitle('🏃‍♀️ Upcoming Team Races')
        .setColor('#FFA500')
        .setDescription(`${upcomingRaces.length} upcoming race${upcomingRaces.length === 1 ? '' : 's'} in the next ${days} days`)
        .setTimestamp();

      // Group by date and show races
      const racesByDate = {};
      for (const race of racesWithMembers) {
        const date = race.race_date;
        if (!racesByDate[date]) racesByDate[date] = [];
        racesByDate[date].push(race);
      }

      // Sort dates and add fields
      const sortedDates = Object.keys(racesByDate).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      let fieldCount = 0;

      for (const date of sortedDates) {
        if (fieldCount >= 10) break; // Discord embed limit

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

        const raceList = dayRaces.map(race => {
          let raceText = `• **${race.name}** - ${race.memberName}`;
          if (race.distance) raceText += ` (${race.distance})`;
          if (race.location) raceText += ` at ${race.location}`;
          return raceText;
        }).join('\n');

        embed.addFields([{
          name: dayText,
          value: raceList,
          inline: false
        }]);

        fieldCount++;
      }

      if (sortedDates.length > 10) {
        embed.setFooter({ text: `Showing first 10 dates (${upcomingRaces.length} total races)` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error showing upcoming races', {
        user: interaction.user.tag,
        isTeamCommand,
        error: error.message
      });
      
      await interaction.editReply({
        content: '❌ Failed to retrieve upcoming races.',
        ephemeral: !isTeamCommand
      });
    }
  }

  // List all team races (admin only)
  async listAllTeamRaces(interaction, options) {
    await interaction.deferReply({ ephemeral: false });

    try {
      const status = options.getString('status');
      const filterOptions = status ? { status } : {};
      
      const races = await this.raceManager.getAllRaces(filterOptions);

      if (races.length === 0) {
        const statusText = status ? ` with status "${status}"` : '';
        await interaction.editReply({
          content: `📭 No team races found${statusText}.`,
          ephemeral: true
        });
        return;
      }

      // Get member data for each race
      const racesWithMembers = await Promise.all(
        races.map(async (race) => {
          const member = await this.activityProcessor.memberManager.getMemberByAthleteId(race.member_athlete_id);
          return {
            ...race,
            memberName: member?.discordUser?.displayName || `${member?.athlete?.firstname} ${member?.athlete?.lastname}` || 'Unknown'
          };
        })
      );

      const statusSuffix = status ? ` (${status})` : '';
      const embed = new EmbedBuilder()
        .setTitle(`🏃 Team Races${statusSuffix}`)
        .setColor('#FC4C02')
        .setDescription(`Found ${races.length} race${races.length === 1 ? '' : 's'}`)
        .setTimestamp();

      // Group races into chunks of 10 for better display
      const raceChunks = DiscordUtils.chunkArray(racesWithMembers, 10);
      
      for (const race of raceChunks[0]) {
        const raceDate = DateUtils.formatForDisplay(race.race_date);
        const distanceInfo = race.distance ? ` • 📏 ${race.distance}` : '';
        const locationInfo = race.location ? ` • 📍 ${race.location}` : '';
        const statusEmoji = this.raceManager.getStatusEmoji(race.status);
        const statusText = race.status.toUpperCase();
        
        embed.addFields([{
          name: `#${race.id} - ${race.name} (${race.memberName})`,
          value: `📅 ${raceDate}${distanceInfo}${locationInfo}\n${statusEmoji} ${statusText}`,
          inline: true
        }]);
      }

      if (raceChunks.length > 1) {
        embed.setFooter({ text: `Showing first 10 of ${races.length} races` });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error listing all team races', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: '❌ Failed to retrieve team races.',
        ephemeral: true
      });
    }
  }

  // === SCHEDULER COMMAND HANDLERS (ADMIN TESTING) ===

  // Handle scheduler subcommands (admin only)
  async handleSchedulerCommand(interaction, options) {
    const subcommand = options.getSubcommand();

    switch (subcommand) {
    case 'weekly':
      await this.triggerWeeklyAnnouncement(interaction);
      break;
    case 'monthly':
      await this.triggerMonthlyAnnouncement(interaction);
      break;
    case 'status':
      await this.showSchedulerStatus(interaction);
      break;
    }
  }

  // Manually trigger weekly race announcement
  async triggerWeeklyAnnouncement(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      logger.discord.info('Manually triggering weekly race announcement', {
        user: interaction.user.tag
      });

      // Get the scheduler from the activity processor
      const scheduler = this.activityProcessor.scheduler;
      
      if (!scheduler) {
        await interaction.editReply({
          content: '❌ Scheduler not available.',
          ephemeral: false
        });
        return;
      }

      await scheduler.triggerWeeklyAnnouncement();

      await interaction.editReply({
        content: '✅ Weekly race announcement triggered successfully! Check the channel for the announcement.',
        ephemeral: false
      });

    } catch (error) {
      logger.discord.error('Error triggering weekly race announcement', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: `❌ Failed to trigger weekly race announcement: ${error.message}`,
        ephemeral: false
      });
    }
  }

  // Manually trigger monthly race announcement
  async triggerMonthlyAnnouncement(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      logger.discord.info('Manually triggering monthly race announcement', {
        user: interaction.user.tag
      });

      // Get the scheduler from the activity processor
      const scheduler = this.activityProcessor.scheduler;
      
      if (!scheduler) {
        await interaction.editReply({
          content: '❌ Scheduler not available.',
          ephemeral: false
        });
        return;
      }

      await scheduler.triggerMonthlyAnnouncement();

      await interaction.editReply({
        content: '✅ Monthly race announcement triggered successfully! Check the channel for the announcement.',
        ephemeral: false
      });

    } catch (error) {
      logger.discord.error('Error triggering monthly race announcement', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: `❌ Failed to trigger monthly race announcement: ${error.message}`,
        ephemeral: false
      });
    }
  }

  // Show scheduler status
  async showSchedulerStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const scheduler = this.activityProcessor.scheduler;
      
      if (!scheduler) {
        await interaction.editReply({
          content: '❌ Scheduler not available.',
          ephemeral: true
        });
        return;
      }

      const status = scheduler.getStatus();
      const weeklyRaces = await this.activityProcessor.raceManager.getWeeklyRaces();
      const monthlyRaces = await this.activityProcessor.raceManager.getMonthlyRaces();

      const embed = new EmbedBuilder()
        .setTitle('📅 Race Scheduler Status')
        .setColor('#4169E1')
        .addFields([
          {
            name: 'Scheduler Status',
            value: status.initialized ? '✅ Running' : '❌ Not initialized',
            inline: true
          },
          {
            name: 'Active Jobs',
            value: `${status.jobCount} jobs (${status.activeJobs.join(', ')})`,
            inline: true
          },
          {
            name: 'This Week\'s Races',
            value: `${weeklyRaces.length} race${weeklyRaces.length === 1 ? '' : 's'}`,
            inline: true
          },
          {
            name: 'This Month\'s Races',
            value: `${monthlyRaces.length} race${monthlyRaces.length === 1 ? '' : 's'}`,
            inline: true
          },
          {
            name: 'Weekly Schedule',
            value: 'Every Monday at 8:00 AM UTC',
            inline: false
          },
          {
            name: 'Monthly Schedule',
            value: 'First day of month at 8:00 AM UTC',
            inline: false
          }
        ])
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error getting scheduler status', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: `❌ Failed to get scheduler status: ${error.message}`,
        ephemeral: true
      });
    }
  }

  // === SETTINGS COMMAND HANDLERS (ADMIN ONLY) ===

  // Handle settings subcommands (admin only)
  async handleSettingsCommand(interaction, options) {
    const subcommand = options.getSubcommand();

    switch (subcommand) {
    case 'channel':
      await this.setDiscordChannel(interaction, options);
      break;
    case 'view':
      await this.viewSettings(interaction);
      break;
    }
  }

  // Set Discord channel for bot activities
  async setDiscordChannel(interaction, options) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const channelOption = options.getChannel('channel');
      const targetChannel = channelOption || interaction.channel;

      // Validate that it's a text channel
      if (targetChannel.type !== 0) { // 0 = GUILD_TEXT
        await interaction.editReply({
          content: '❌ Please select a text channel.',
          ephemeral: true
        });
        return;
      }

      // Check if bot has permissions to send messages in the channel
      const permissions = targetChannel.permissionsFor(interaction.guild.members.me);
      if (!permissions.has(['SendMessages', 'EmbedLinks'])) {
        await interaction.editReply({
          content: `❌ I don't have permission to send messages in ${targetChannel}. Please ensure I have "Send Messages" and "Embed Links" permissions.`,
          ephemeral: true
        });
        return;
      }

      // Save to database
      const success = await this.activityProcessor.memberManager.databaseManager.settingsManager.setDiscordChannelId(targetChannel.id);

      if (success) {
        const embed = new EmbedBuilder()
          .setTitle('⚙️ Settings Updated')
          .setColor('#00AA00')
          .setDescription(`Successfully set Discord channel to ${targetChannel}`)
          .addFields([
            {
              name: 'Channel Name',
              value: `#${targetChannel.name}`,
              inline: true
            },
            {
              name: 'Channel ID',
              value: targetChannel.id,
              inline: true
            }
          ])
          .setFooter({ text: 'Activities and race announcements will now be posted to this channel' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Send a test message to the new channel
        if (targetChannel.id !== interaction.channel.id) {
          try {
            const testEmbed = new EmbedBuilder()
              .setTitle('🤖 Bot Channel Updated')
              .setColor('#FC4C02')
              .setDescription('This channel has been set as the new bot channel for Strava activities and race announcements!')
              .setTimestamp();

            await targetChannel.send({ embeds: [testEmbed] });
          } catch (error) {
            logger.discord.warn('Could not send test message to new channel', {
              channelId: targetChannel.id,
              error: error.message
            });
          }
        }

        logger.discord.info('Discord channel updated via command', {
          user: interaction.user.tag,
          oldChannel: process.env.DISCORD_CHANNEL_ID,
          newChannel: targetChannel.id,
          channelName: targetChannel.name
        });

      } else {
        await interaction.editReply({
          content: '❌ Failed to update channel settings. Please try again.',
          ephemeral: true
        });
      }

    } catch (error) {
      logger.discord.error('Error setting Discord channel', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: `❌ Failed to update channel: ${error.message}`,
        ephemeral: true
      });
    }
  }

  // View current bot settings
  async viewSettings(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const settingsManager = this.activityProcessor.memberManager.databaseManager.settingsManager;
      const allSettings = await settingsManager.getAllSettings();
      const channelId = await settingsManager.getDiscordChannelId();

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Bot Settings')
        .setColor('#0099FF')
        .setTimestamp();

      // Discord Channel
      let channelText = 'Not configured';
      if (channelId) {
        try {
          const channel = await interaction.client.channels.fetch(channelId);
          channelText = `${channel} (#${channel.name})`;
        } catch {
          channelText = `${channelId} (Channel not found)`;
        }
      }

      embed.addFields([
        {
          name: '📺 Discord Channel',
          value: channelText,
          inline: false
        }
      ]);

      // Other settings
      const otherSettings = Object.entries(allSettings)
        .filter(([key]) => key !== 'discord_channel_id')
        .slice(0, DISCORD.ITEMS_PER_PAGE); // Limit to prevent embed overflow

      if (otherSettings.length > 0) {
        const settingsText = otherSettings
          .map(([key, setting]) => `**${key}**: ${setting.value || 'Not set'}`)
          .join('\n');

        embed.addFields([
          {
            name: '🔧 Other Settings',
            value: settingsText,
            inline: false
          }
        ]);
      }

      embed.setFooter({ text: 'Use /settings channel to update the Discord channel' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.discord.error('Error viewing settings', {
        user: interaction.user.tag,
        error: error.message
      });
      
      await interaction.editReply({
        content: '❌ Failed to load settings.',
        ephemeral: true
      });
    }
  }

}

module.exports = DiscordCommands;