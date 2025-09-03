const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ActivityEmbedBuilder = require('../utils/EmbedBuilder');
const DiscordUtils = require('../utils/DiscordUtils');
const logger = require('../utils/Logger');
const config = require('../../config/config');

class DiscordCommands {
  constructor(activityProcessor) {
    this.activityProcessor = activityProcessor;
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
        )
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
      channel: interaction.channel?.name
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
      const memberStats = this.activityProcessor.memberManager.getStats();

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
      
      memberChunks[0].forEach((member, _index) => {
        const user = interaction.guild?.members.cache.get(member.discordUserId);
        const displayName = user ? `<@${member.discordUserId}>` : `User ID: ${member.discordUserId}`;
        const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
        
        embed.addFields([{
          name: memberName,
          value: `Discord: ${displayName}\nRegistered: ${new Date(member.registeredAt).toLocaleDateString()}\nStatus: ${member.isActive ? '🟢 Active' : '🔴 Inactive'}`,
          inline: true
        }]);
      });

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
    const userId = interaction.user.id;
    const existingMember = await this.activityProcessor.memberManager.getMemberByDiscordId(userId);

    if (existingMember) {
      const memberName = existingMember.discordUser ? existingMember.discordUser.displayName : `${existingMember.athlete.firstname} ${existingMember.athlete.lastname}`;
      await interaction.reply({
        content: `✅ You're already registered as **${memberName}**.`,
        ephemeral: true
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

    await interaction.reply({ embeds: [embed] });
  }


  // Handle bot status command
  async handleBotStatusCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const stats = this.activityProcessor.getStats();
      const memberStats = this.activityProcessor.memberManager.getStats();
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
            value: `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`,
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
    await interaction.deferReply();

    try {
      const memberInput = options.getString('member');
      const member = await this.findMemberByInput(memberInput);

      if (!member) {
        await interaction.editReply({
          content: '❌ Team member not found. Use `/members list` to see all registered members.',
        });
        return;
      }

      // Get valid access token for the member
      const accessToken = await this.activityProcessor.memberManager.getValidAccessToken(member);
      if (!accessToken) {
        const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
        await interaction.editReply({
          content: `❌ Unable to access activities for **${memberName}**. They may need to re-authorize.`,
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
        const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
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
        const memberName = member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`;
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
        error: error.message
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
      const firstName = member.athlete.firstname.toLowerCase();
      const lastName = member.athlete.lastname.toLowerCase();
      const fullName = `${firstName} ${lastName}`;
      
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
        const searchTerm = focusedOption.value.toLowerCase();
        
        const choices = members
          .filter(member => {
            const memberName = member.discordUser ? member.discordUser.displayName.toLowerCase() : `${member.athlete.firstname} ${member.athlete.lastname}`.toLowerCase();
            const fullName = `${member.athlete.firstname} ${member.athlete.lastname}`.toLowerCase();
            return memberName.includes(searchTerm) || 
                   fullName.includes(searchTerm) || 
                   member.athlete.firstname.toLowerCase().includes(searchTerm) ||
                   member.athlete.lastname.toLowerCase().includes(searchTerm);
          })
          .slice(0, 25) // Discord limits to 25 choices
          .map(member => ({
            name: member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`,
            value: member.discordUser ? member.discordUser.displayName : `${member.athlete.firstname} ${member.athlete.lastname}`
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

}

module.exports = DiscordCommands;