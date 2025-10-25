const { eq, sql } = require('drizzle-orm');
const { settings } = require('../database/schema');
const logger = require('../utils/Logger');

class SettingsManager {
  constructor(databaseInstance) {
    this.db = databaseInstance;
  }

  /**
   * Get a setting value by key
   * @param {string} key - Setting key
   * @param {string} defaultValue - Default value if not found
   * @returns {Promise<string>} Setting value
   */
  async getSetting(key, defaultValue = null) {
    try {
      const result = await this.db.select().from(settings).where(eq(settings.key, key)).limit(1);
      return result.length > 0 ? result[0].value : defaultValue;
    } catch (error) {
      logger.database.error('Error getting setting', { key, error: error.message });
      return defaultValue;
    }
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {string} value - Setting value
   * @param {string} description - Optional description
   * @returns {Promise<boolean>} Success status
   */
  async setSetting(key, value, description = null) {
    try {
      // Try to get existing setting for description
      const existing = await this.db.select().from(settings).where(eq(settings.key, key)).limit(1);
      
      const data = {
        key,
        value,
        description: description || (existing.length > 0 ? existing[0].description : null),
        updated_at: new Date().toISOString()
      };

      // Use INSERT OR REPLACE (upsert)
      await this.db.insert(settings)
        .values(data)
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: data.value,
            description: data.description,
            updated_at: data.updated_at
          }
        });
      
      logger.database.info('Setting updated', { 
        key, 
        value: key.includes('token') || key.includes('secret') ? '[HIDDEN]' : value,
        changed: true
      });
      
      return true;
    } catch (error) {
      logger.database.error('Error setting value', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get all settings
   * @returns {Promise<Object>} Settings object
   */
  async getAllSettings() {
    try {
      const rows = await this.db.select().from(settings).orderBy(settings.key);
      
      const settingsObj = {};
      for (const row of rows) {
        settingsObj[row.key] = {
          value: row.value,
          description: row.description,
          updatedAt: row.updated_at
        };
      }
      
      return settingsObj;
    } catch (error) {
      logger.database.error('Error getting all settings', { error: error.message });
      return {};
    }
  }

  /**
   * Delete a setting
   * @param {string} key - Setting key
   * @returns {Promise<boolean>} Success status
   */
  async deleteSetting(key) {
    try {
      const result = await this.db.delete(settings).where(eq(settings.key, key));
      
      logger.database.info('Setting deleted', { key, deleted: result.changes > 0 });
      return result.changes > 0;
    } catch (error) {
      logger.database.error('Error deleting setting', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get Discord channel ID (with fallback to env)
   * @returns {Promise<string>} Channel ID
   */
  async getDiscordChannelId() {
    const channelId = await this.getSetting('discord_channel_id');
    return channelId || process.env.DISCORD_CHANNEL_ID || null;
  }

  /**
   * Set Discord channel ID
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<boolean>} Success status
   */
  async setDiscordChannelId(channelId) {
    return await this.setSetting('discord_channel_id', channelId, 'Discord channel ID for posting activities and announcements');
  }
}

module.exports = SettingsManager;