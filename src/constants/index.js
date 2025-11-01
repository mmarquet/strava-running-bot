/**
 * Application Constants
 *
 * Centralizes all magic numbers and constants used throughout the application
 */

// Encryption Constants
const ENCRYPTION = {
  IV_LENGTH: 16,           // Length of initialization vector for AES-256-GCM
  KEY_LENGTH: 32,          // Length of encryption key (256 bits)
  ALGORITHM: 'aes-256-gcm' // Encryption algorithm
};

// Time Constants
const TIME = {
  MS_PER_DAY: 24 * 60 * 60 * 1000,  // Milliseconds in a day
  MS_PER_HOUR: 60 * 60 * 1000,       // Milliseconds in an hour
  MS_PER_MINUTE: 60 * 1000,          // Milliseconds in a minute
  SECONDS_PER_HOUR: 3600             // Seconds in an hour
};

// Validation Limits
const VALIDATION = {
  MAX_NAME_LENGTH: 100,       // Maximum race name length
  MAX_LOCATION_LENGTH: 100,   // Maximum location string length
  MAX_NOTES_LENGTH: 500,      // Maximum notes field length
  MAX_GOAL_TIME_LENGTH: 20,   // Maximum goal time string length
  MAX_DISTANCE_STRING_LENGTH: 20, // Maximum distance string length
  MIN_DISTANCE: 0,            // Minimum valid race distance (km)
  MAX_DISTANCE: 1000          // Maximum valid race distance (km)
};

// Discord Embed Limits
const DISCORD = {
  MAX_EMBED_FIELDS: 25,       // Discord's maximum fields per embed
  MAX_FIELD_VALUE_LENGTH: 1024, // Maximum characters per field value
  MAX_EMBED_DESCRIPTION: 4096,  // Maximum embed description length
  MAX_EMBED_TITLE: 256,         // Maximum embed title length
  ITEMS_PER_PAGE: 10,           // Default pagination size
  CHUNK_SIZE: 5                 // Size for chunking large lists
};

// Date/Week Calculations
const DATE = {
  SUNDAY: 0,
  MONDAY: 1,
  DAYS_IN_WEEK: 7,
  WEEK_ADJUSTMENT_SUNDAY: -6,  // Days to subtract when day is Sunday
  WEEK_ADJUSTMENT_OTHER: 1      // Days to add for other days
};

// Race Status Values
const RACE_STATUS = {
  REGISTERED: 'registered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DNS: 'dns',  // Did Not Start
  DNF: 'dnf'   // Did Not Finish
};

// Race Type Values
const RACE_TYPE = {
  ROAD: 'road',
  TRAIL: 'trail'
};

// Race Status Emojis
const RACE_EMOJI = {
  [RACE_STATUS.REGISTERED]: '📝',
  [RACE_STATUS.COMPLETED]: '✅',
  [RACE_STATUS.CANCELLED]: '❌',
  [RACE_STATUS.DNS]: '🚫',
  [RACE_STATUS.DNF]: '⚠️',
  [RACE_TYPE.ROAD]: '🏃‍♂️',
  [RACE_TYPE.TRAIL]: '🥾'
};

// Discord Channel Types
const CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GROUP_DM: 3,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5
};

module.exports = {
  ENCRYPTION,
  TIME,
  VALIDATION,
  DISCORD,
  DATE,
  RACE_STATUS,
  RACE_TYPE,
  RACE_EMOJI,
  CHANNEL_TYPE
};
