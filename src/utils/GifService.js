const axios = require('axios');
const logger = require('./Logger');

/**
 * Service for fetching GIFs from Giphy API with fallback to curated collection
 */
class GifService {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.giphy.com/v1/gifs';
    
    // Fallback GIFs in case API fails or no API key provided
    this.fallbackGifs = {
      kom: [
        { url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', description: 'Crown celebration' },
        { url: 'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif', description: 'Victory dance' },
        { url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', description: 'Champions celebration' },
        { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', description: 'Winning celebration' },
        { url: 'https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif', description: 'Trophy celebration' }
      ],
      qom: [
        { url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', description: 'Crown celebration' },
        { url: 'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif', description: 'Victory dance' },
        { url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', description: 'Champions celebration' },
        { url: 'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif', description: 'Queen energy' },
        { url: 'https://media.giphy.com/media/l0MYJYHRvWKgp9VaE/giphy.gif', description: 'Fierce victory' }
      ],
      'local legend': [
        { url: 'https://media.giphy.com/media/l0MYzxkg0o1tkGSaI/giphy.gif', description: 'Legend status' },
        { url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif', description: 'Champion vibes' },
        { url: 'https://media.giphy.com/media/3oz8xLlw6GHVfokaNW/giphy.gif', description: 'Hall of fame' },
        { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', description: 'Achievement unlocked' },
        { url: 'https://media.giphy.com/media/26BRrSvJUa0crqw4E/giphy.gif', description: 'Legendary moment' }
      ]
    };

    // Search terms for different achievement types
    this.searchTerms = {
      kom: ['celebration', 'victory', 'champion', 'winner', 'crown', 'trophy'],
      qom: ['celebration', 'victory', 'champion', 'winner', 'queen', 'powerful'],
      'local legend': ['legend', 'achievement', 'hall of fame', 'champion', 'trophy', 'victory']
    };
  }

  /**
   * Get a random search term for the achievement type
   * @param {string} achievementType - Type of achievement (kom, qom, local legend)
   * @returns {string} Random search term
   */
  getRandomSearchTerm(achievementType) {
    const terms = this.searchTerms[achievementType.toLowerCase()] || this.searchTerms.kom;
    return terms[Math.floor(Math.random() * terms.length)];
  }

  /**
   * Fetch GIFs from Giphy API
   * @param {string} achievementType - Type of achievement
   * @param {number} limit - Number of GIFs to fetch (default: 10)
   * @returns {Promise<Array>} Array of GIF objects with url and description
   */
  async fetchGifsFromApi(achievementType, limit = 10) {
    if (!this.apiKey) {
      logger.achievements.warn('No Giphy API key provided, using fallback GIFs');
      return this.getFallbackGifs(achievementType);
    }

    try {
      const searchTerm = this.getRandomSearchTerm(achievementType);
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          api_key: this.apiKey,
          q: searchTerm,
          limit: limit,
          offset: Math.floor(Math.random() * 100), // Random offset for variety
          rating: 'pg', // Keep it family-friendly
          lang: 'en'
        },
        timeout: 5000 // 5 second timeout
      });

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        logger.achievements.warn('No GIFs found from API, using fallback', { searchTerm });
        return this.getFallbackGifs(achievementType);
      }

      const gifs = response.data.data.map(gif => ({
        url: gif.images.original.url,
        description: `${searchTerm} celebration`
      }));

      logger.achievements.info('Successfully fetched GIFs from API', {
        achievementType,
        searchTerm,
        count: gifs.length
      });

      return gifs;

    } catch (error) {
      logger.achievements.error('Failed to fetch GIFs from API, using fallback', {
        error: error.message,
        achievementType
      });
      return this.getFallbackGifs(achievementType);
    }
  }

  /**
   * Get fallback GIFs when API is unavailable
   * @param {string} achievementType - Type of achievement
   * @returns {Array} Array of fallback GIF objects
   */
  getFallbackGifs(achievementType) {
    const key = achievementType.toLowerCase();
    return this.fallbackGifs[key] || this.fallbackGifs.kom;
  }

  /**
   * Get a random GIF for an achievement type
   * @param {string} achievementType - Type of achievement (kom, qom, local legend)
   * @returns {Promise<Object|null>} GIF object with url and description, or null if error
   */
  async getRandomGif(achievementType) {
    try {
      const gifs = await this.fetchGifsFromApi(achievementType, 20);
      if (!gifs || gifs.length === 0) {
        return null;
      }
      
      const randomIndex = Math.floor(Math.random() * gifs.length);
      return gifs[randomIndex];
      
    } catch (error) {
      logger.achievements.error('Error getting random GIF', {
        error: error.message,
        achievementType
      });
      
      // Final fallback to hardcoded GIF
      const fallbackGifs = this.getFallbackGifs(achievementType);
      if (fallbackGifs.length > 0) {
        const randomIndex = Math.floor(Math.random() * fallbackGifs.length);
        return fallbackGifs[randomIndex];
      }
      
      return null;
    }
  }

  /**
   * Get multiple random GIFs for an achievement type
   * @param {string} achievementType - Type of achievement
   * @param {number} count - Number of GIFs to return (default: 5)
   * @returns {Promise<Array>} Array of GIF objects
   */
  async getRandomGifs(achievementType, count = 5) {
    try {
      const gifs = await this.fetchGifsFromApi(achievementType, Math.max(count, 20));
      if (!gifs || gifs.length === 0) {
        return [];
      }
      
      // Shuffle and return requested count
      const shuffled = gifs.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
      
    } catch (error) {
      logger.achievements.error('Error getting random GIFs', {
        error: error.message,
        achievementType,
        count
      });
      
      // Return fallback GIFs
      const fallbackGifs = this.getFallbackGifs(achievementType);
      const shuffled = fallbackGifs.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, fallbackGifs.length));
    }
  }

  /**
   * Check if API is available and working
   * @returns {Promise<boolean>} True if API is working
   */
  async isApiAvailable() {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          api_key: this.apiKey,
          q: 'test',
          limit: 1
        },
        timeout: 3000
      });
      
      return response.status === 200;
    } catch (error) {
      logger.achievements.warn('Giphy API availability check failed', {
        error: error.message
      });
      return false;
    }
  }
}

module.exports = GifService;
