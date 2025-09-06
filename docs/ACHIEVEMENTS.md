# Strava Achievement Detection Feature

This document demonstrates the new KOM/QOM and Local Legend achievement detection feature for the Strava Running Bot.

## Overview

The bot now automatically detects when a team member achieves a KOM (King of the Mountain), QOM (Queen of the Mountain), or Local Legend on any Strava segment during their activities. When achievements are detected, the bot will:

1. **Send a special alert message** with celebration emojis
2. **Display achievement information** in the activity embed
3. **Include fun celebration GIFs** 
4. **Provide links** to view the segments where achievements were earned

## Feature Components

### AchievementDetector (`src/utils/AchievementDetector.js`)
- Analyzes Strava activity segment efforts for achievements
- Provides fun GIF URLs for celebrations
- Formats achievement data for Discord display
- Prioritizes different achievement types (KOM/QOM > Local Legend)

### Enhanced Strava API (`src/strava/api.js`)
- Modified to fetch segment efforts with activities (`include_all_efforts: true`)
- Automatically detects achievements during activity processing
- Adds achievement data to processed activity objects

### Updated Discord Embeds (`src/utils/EmbedBuilder.js`)
- Special styling for activities with achievements (gold color, celebration GIFs)
- Achievement summary in the activity title
- Detailed achievement fields with segment names and links

### Enhanced Discord Bot (`src/discord/bot.js`)
- Sends special alert messages for achievement activities
- Uses athlete's Discord display name when available
- Includes achievement count in logging

## Example Achievement Message

When a user gets a KOM or Local Legend, the bot will post:

```
🚨 **ACHIEVEMENT ALERT!** 🚨
**JohnDoe123** just earned 1 KOM, 1 Local Legend! 🔥💪

[Activity Embed with celebration GIF and achievement details]
```

## Achievement Types Supported

- **KOM (King of the Mountain)** 👑 - Best time for men on a segment
- **QOM (Queen of the Mountain)** 👸 - Best time for women on a segment  
- **Local Legend** 🏆 - Most activities on a segment in recent period

## Testing

The feature includes comprehensive tests:
- `__tests__/utils/AchievementDetector.test.js` - Achievement detection logic
- Enhanced `__tests__/strava/api.test.js` - API integration
- Enhanced `__tests__/utils/EmbedBuilder.test.js` - Discord embed formatting
- Enhanced `__tests__/discord/bot.test.js` - Bot message posting

## Configuration

Achievement GIFs are configured in `AchievementDetector.ACHIEVEMENT_GIFS` and can be customized by modifying the URL arrays for each achievement type.

## Technical Implementation

1. **Webhook Processing**: When Strava sends activity webhooks, the bot fetches detailed activity data including segment efforts
2. **Achievement Detection**: The `AchievementDetector` analyzes segment efforts for achievement arrays
3. **Message Enhancement**: If achievements are found, special formatting and messaging is applied
4. **Discord Posting**: Enhanced embeds with achievement data are posted to the configured Discord channel

The feature is backwards-compatible and will not affect activities without achievements.
