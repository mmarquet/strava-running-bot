// Dynamic configuration helper
// This provides runtime access to settings that can be updated via database

let settingsManager = null;

const dynamicConfig = {
  // Set the settings manager instance
  setSettingsManager(manager) {
    settingsManager = manager;
  },

  // Get Discord channel ID with database fallback
  async getDiscordChannelId() {
    if (settingsManager) {
      try {
        const channelId = await settingsManager.getDiscordChannelId();
        return channelId;
      } catch (error) {
        console.warn('Failed to get channel ID from database, using env fallback:', error.message);
      }
    }
    return process.env.DISCORD_CHANNEL_ID;
  },

  // Get setting with fallback
  async getSetting(key, envFallback = null) {
    if (settingsManager) {
      try {
        return await settingsManager.getSetting(key, envFallback);
      } catch (error) {
        console.warn(`Failed to get setting ${key} from database:`, error.message);
      }
    }
    return envFallback;
  }
};

module.exports = dynamicConfig;