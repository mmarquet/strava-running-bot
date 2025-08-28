const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const config = require('../../config/config');
const DiscordCommands = require('./commands');
const ActivityEmbedBuilder = require('../utils/EmbedBuilder');
const logger = require('../utils/Logger');

class DiscordBot {
  constructor(activityProcessor) {
    this.activityProcessor = activityProcessor;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.commands = new DiscordCommands(activityProcessor);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.once('ready', async () => {
      logger.discord.info('Bot logged in', {
        tag: this.client.user.tag,
        id: this.client.user.id,
        guilds: this.client.guilds.cache.size,
        users: this.client.users.cache.size
      });

      try {
        await this.registerCommands();
      } catch (err) {
        logger.discord.error('Failed to register commands on ready event', err);
        // swallow here so ready event always resolves
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.commands.handleCommand(interaction);
        } else if (interaction.isAutocomplete()) {
          await this.commands.handleAutocomplete(interaction);
        }
      } catch (err) {
        logger.discord.error('Error handling interaction', err);
        // swallow so interaction handler never rejects
      }
    });

    this.client.on('error', (error) => {
      logger.discord.error('Discord client error', error);
    });
  }

  async registerCommands() {
    if (!config.discord.token) {
      const error = new Error('Missing Discord bot token');
      logger.discord.error('Failed to register Discord commands', error);
      throw error;
    }

    try {
      logger.discord.info('Registering Discord slash commands...');
      
      const rest = new REST({ version: '10' }).setToken(config.discord.token);
      const commands = this.commands.getCommands().map(command => command.toJSON());

      const guildId = process.env.DISCORD_GUILD_ID;
      let data;
      
      if (guildId) {
        logger.discord.info('Registering commands to guild for testing', { guildId });
        data = await rest.put(
          Routes.applicationGuildCommands(this.client.user.id, guildId),
          { body: commands }
        );
      } else {
        logger.discord.warn('No DISCORD_GUILD_ID set, registering globally (may take up to 1 hour)');
        data = await rest.put(
          Routes.applicationCommands(this.client.user.id),
          { body: commands }
        );
      }

      logger.discord.info('Successfully registered Discord slash commands', {
        count: data.length,
        commands: data.map(cmd => cmd.name)
      });
    } catch (error) {
      logger.discord.error('Error registering Discord commands', error);
      throw error;
    }
  }

  async start() {
    if (!config.discord.token) {
      const error = new Error('Missing Discord bot token');
      logger.discord.error('Failed to start Discord bot', error);
      throw error;
    }

    try {
      await this.client.login(config.discord.token);
    } catch (error) {
      logger.discord.error('Failed to start Discord bot', error);
      throw error;
    }
  }

  async postActivity(activityData) {
    if (!config.discord.channelId) {
      const error = new Error('Missing Discord channel ID');
      logger.discord.error('Failed to post activity to Discord', { error: error.message });
      throw error;
    }

    if (!activityData.athlete) {
      const error = new Error('Missing athlete data');
      logger.discord.error('Failed to post activity to Discord', { error: error.message, activityId: activityData.id });
      throw error;
    }

    try {
      const channel = await this.client.channels.fetch(config.discord.channelId);
      
      if (!channel) {
        throw new Error('Discord channel not found');
      }

      const embed = ActivityEmbedBuilder.createActivityEmbed(activityData, { type: 'posted' });
      await channel.send({ embeds: [embed] });
      
      logger.discord.info('Posted activity to Discord', {
        activityName: activityData.name,
        activityType: activityData.type,
        distance: activityData.distance,
        athleteName: `${activityData.athlete?.firstname} ${activityData.athlete?.lastname}`,
        channelId: config.discord.channelId
      });
    } catch (error) {
      logger.discord.error('Failed to post activity to Discord', {
        activityData: {
          id: activityData.id,
          name: activityData.name,
          athlete: `${activityData.athlete?.firstname} ${activityData.athlete?.lastname}`
        },
        error: error.message
      });
      throw error;
    }
  }

  async stop() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (_err) {
        // ignore destroy errors
      }
    }
    logger.discord.info('Discord bot stopped');
  }
}

module.exports = DiscordBot;
