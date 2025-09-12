require('dotenv').config();

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN,
    baseUrl: 'https://www.strava.com/api/v3',
    authUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
  },
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
  },
  posting: {
    delayMinutes: parseInt(process.env.POST_DELAY_MINUTES) || 15,
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY,
  },
  app: {
    name: 'Strava Running Bot',
    version: '1.0.0',
  },
  database: {
    path: process.env.DATABASE_PATH || '/app/data/bot.db',
  },
  scheduler: {
    // Enable/disable scheduled race announcements
    weeklyEnabled: process.env.WEEKLY_RACE_ANNOUNCEMENTS !== 'false', // Default: enabled
    monthlyEnabled: process.env.MONTHLY_RACE_ANNOUNCEMENTS !== 'false', // Default: enabled
    
    // Cron schedule patterns
    weeklySchedule: process.env.WEEKLY_SCHEDULE || '0 8 * * 1', // Every Monday at 8:00 AM
    monthlySchedule: process.env.MONTHLY_SCHEDULE || '0 8 1 * *', // First day of month at 8:00 AM
    
    // Timezone for scheduling (important for proper timing)
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'DISCORD_TOKEN',
  'STRAVA_CLIENT_ID',
  'STRAVA_CLIENT_SECRET',
  'STRAVA_WEBHOOK_VERIFY_TOKEN',
  'ENCRYPTION_KEY'
];

// Note: DISCORD_CHANNEL_ID is now optional as it can be set via /settings command

// BASE_URL is not strictly required since it has a localhost fallback,
// but we'll warn if it's not set in production
if (process.env.NODE_ENV === 'production' && !process.env.BASE_URL) {
  console.warn('⚠️  BASE_URL not set in production environment. Using localhost fallback.');
  console.warn('   Set BASE_URL=https://yourdomain.com for production deployment.');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

module.exports = config;