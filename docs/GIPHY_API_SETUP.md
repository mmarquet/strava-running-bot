# Environment Setup for Giphy API Integration

## 🎯 Overview
The bot now supports dynamic GIF fetching via the Giphy API for achievement celebrations. This provides fresh, varied content for each KOM/QOM/Local Legend achievement.

## 🔧 Setup Instructions

### 1. Get Giphy API Key
1. Go to [Giphy Developers](https://developers.giphy.com/)
2. Create a free account
3. Create a new app
4. Copy your API key

### 2. Environment Configuration
Add the following to your `.env` file:

```bash
# Giphy API (Optional - will use fallback GIFs if not provided)
GIPHY_API_KEY=your_giphy_api_key_here
```

### 3. API Limits (Free Tier)
- **100 requests per hour**
- **Family-friendly content** (PG rating)
- **Automatic fallback** if quota exceeded

## 📊 How It Works

### With API Key:
- ✅ Fresh GIFs from Giphy search
- ✅ 10-20 different GIFs per achievement type
- ✅ Random search terms for variety
- ✅ Automatic fallback if API fails

### Without API Key:
- ✅ Curated fallback GIF collection
- ✅ 5 high-quality GIFs per achievement type
- ✅ No external dependencies
- ✅ Always reliable

## 🔄 Usage Examples

```javascript
// Create detector instance
const detector = new AchievementDetector();

// Get random GIF for KOM achievement
const gifUrl = await detector.getRandomGif('kom');

// Get GIF with description
const gifData = await detector.getRandomGifWithDescription('kom');
// Returns: { url: "https://...", description: "Crown celebration" }

// Check API availability
const isAvailable = await detector.isGifApiAvailable();
```

## 🛡️ Error Handling
- **Network failures**: Falls back to curated GIFs
- **Rate limiting**: Uses cached GIFs when quota exceeded
- **Invalid responses**: Graceful degradation to fallbacks
- **No API key**: Seamlessly uses fallback collection

## 🎨 Search Terms Used
- **KOM/QOM**: celebration, victory, champion, winner, crown, trophy
- **Local Legend**: legend, achievement, hall of fame, champion, victory

## 📝 Configuration Notes
- API key is **optional** - bot works without it
- Rate limits are automatically handled
- All GIFs are filtered for family-friendly content (PG rating)
- Fallback GIFs are manually curated for quality
