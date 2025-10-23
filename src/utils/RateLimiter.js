const logger = require('./Logger');
const { TIME } = require('../constants');

/**
 * Rate limiter for Strava API compliance
 * Strava limits: ~100 requests/15min, ~1000 requests/day
 */
class RateLimiter {
  constructor() {
    // Strava rate limits (being conservative)
    this.limits = {
      short: {
        requests: 80,    // Conservative: 80/15min (Strava allows ~100)
        window: 15 * TIME.MS_PER_MINUTE  // 15 minutes in milliseconds
      },
      daily: {
        requests: 900,   // Conservative: 900/day (Strava allows ~1000)
        window: TIME.MS_PER_DAY  // 24 hours in milliseconds
      }
    };

    // Track requests with timestamps
    this.requests = {
      short: [], // Array of timestamps for 15-min window
      daily: []  // Array of timestamps for 24-hour window
    };

    // Queue for delayed requests when rate limited
    this.requestQueue = [];
    this.processing = false;
  }

  /**
   * Check if we can make a request now
   */
  canMakeRequest() {
    this.cleanupOldRequests();
    
    const shortTermOk = this.requests.short.length < this.limits.short.requests;
    const dailyOk = this.requests.daily.length < this.limits.daily.requests;
    
    return shortTermOk && dailyOk;
  }

  /**
   * Record a request being made
   */
  recordRequest() {
    const now = Date.now();
    this.requests.short.push(now);
    this.requests.daily.push(now);
    
    logger.strava.debug('API request recorded', {
      shortTermCount: this.requests.short.length,
      dailyCount: this.requests.daily.length,
      shortTermLimit: this.limits.short.requests,
      dailyLimit: this.limits.daily.requests
    });
  }

  /**
   * Clean up old requests outside the time windows
   */
  cleanupOldRequests() {
    const now = Date.now();
    
    // Clean up short-term window (15 minutes)
    this.requests.short = this.requests.short.filter(
      timestamp => now - timestamp < this.limits.short.window
    );
    
    // Clean up daily window (24 hours)
    this.requests.daily = this.requests.daily.filter(
      timestamp => now - timestamp < this.limits.daily.window
    );
  }

  /**
   * Get time until next available slot
   */
  getWaitTime() {
    this.cleanupOldRequests();
    
    if (this.canMakeRequest()) {
      return 0;
    }

    // Calculate wait time based on oldest request in the limiting window
    let waitTime = 0;
    
    if (this.requests.short.length >= this.limits.short.requests) {
      const oldestShort = Math.min(...this.requests.short);
      waitTime = Math.max(waitTime, oldestShort + this.limits.short.window - Date.now());
    }
    
    if (this.requests.daily.length >= this.limits.daily.requests) {
      const oldestDaily = Math.min(...this.requests.daily);
      waitTime = Math.max(waitTime, oldestDaily + this.limits.daily.window - Date.now());
    }
    
    return Math.max(waitTime, 0);
  }

  /**
   * Execute a rate-limited request
   */
  async executeRequest(requestFunction, context = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestFunction,
        context,
        resolve,
        reject
      });
      
      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.requestQueue.length > 0) {
        if (!this.canMakeRequest()) {
          const waitTime = this.getWaitTime();
          
          logger.strava.warn('Rate limit reached, waiting before next request', {
            waitTimeMs: waitTime,
            waitTimeMin: Math.round(waitTime / 1000 / 60),
            queueLength: this.requestQueue.length,
            shortTermCount: this.requests.short.length,
            dailyCount: this.requests.daily.length
          });

          // Wait before trying again
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        const { requestFunction, context, resolve, reject } = this.requestQueue.shift();
        
        try {
          this.recordRequest();
          const result = await requestFunction();
          resolve(result);
        } catch (error) {
          logger.strava.error('Rate-limited request failed', {
            error: error.message,
            context
          });
          reject(error);
        }

        // Small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get current rate limit stats
   */
  getStats() {
    this.cleanupOldRequests();
    
    return {
      shortTerm: {
        used: this.requests.short.length,
        limit: this.limits.short.requests,
        window: '15 minutes'
      },
      daily: {
        used: this.requests.daily.length,
        limit: this.limits.daily.requests,
        window: '24 hours'
      },
      queueLength: this.requestQueue.length,
      canMakeRequest: this.canMakeRequest(),
      waitTime: this.getWaitTime()
    };
  }

  /**
   * Reset all counters (for testing or manual reset)
   */
  reset() {
    this.requests.short = [];
    this.requests.daily = [];
    this.requestQueue = [];
    this.processing = false;
    
    logger.strava.info('Rate limiter reset');
  }
}

module.exports = RateLimiter;