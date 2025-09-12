const chalk = require('chalk');

/**
 * Logging utility with configurable levels
 * Levels: ERROR (0), WARN (1), INFO (2), DEBUG (3)
 */
class Logger {
  constructor() {
    // Log levels (higher numbers include all lower levels)
    this.levels = {
      ERROR: 0,
      WARN: 1, 
      INFO: 2,
      DEBUG: 3
    };

    // Get log level from environment, default to INFO
    const envLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
    this.currentLevel = this.levels[envLevel] !== undefined ? this.levels[envLevel] : this.levels.INFO;

    // Color scheme for different log levels
    this.colors = {
      ERROR: chalk.red.bold,
      WARN: chalk.yellow,
      INFO: chalk.cyan,
      DEBUG: chalk.gray
    };

    // Emoji/symbols for log levels
    this.symbols = {
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🔍'
    };

    // Component colors for better visual separation
    this.componentColors = {
      DISCORD: chalk.blue,
      STRAVA: chalk.orange,
      WEBHOOK: chalk.green,
      MEMBER: chalk.magenta,
      ACTIVITY: chalk.yellow,
      SERVER: chalk.cyan,
      SYSTEM: chalk.white,
      DATABASE: chalk.purple,
      SCHEDULER: chalk.magentaBright
    };
  }

  /**
   * Get formatted timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with timestamp, level, component and message
   */
  formatMessage(level, component, message, data = null) {
    const timestamp = chalk.gray(this.getTimestamp());
    const levelStr = this.colors[level](`[${level}]`);
    const componentStr = component ? (this.componentColors[component] || chalk.white)(`[${component}]`) : '';
    
    let formattedMessage = `${timestamp} ${levelStr}${componentStr} ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        try {
          formattedMessage += '\n' + chalk.gray(JSON.stringify(data, null, 2));
        } catch (error) {
          // Handle circular references or other JSON.stringify errors
          formattedMessage += '\n' + chalk.gray(`[Object serialization failed: ${error.message}]`);
        }
      } else {
        formattedMessage += ` ${data}`;
      }
    }
    
    return formattedMessage;
  }

  /**
   * Check if current level allows logging for given level
   */
  shouldLog(level) {
    return this.levels[level] <= this.currentLevel;
  }

  /**
   * Generic log method
   */
  log(level, component, message, data = null) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, component, message, data);
    
    // Use appropriate console method based on level
    switch (level) {
    case 'ERROR':
      console.error(formattedMessage);
      break;
    case 'WARN':
      console.warn(formattedMessage);
      break;
    case 'DEBUG':
      console.debug(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
    }
  }

  /**
   * Error logging
   */
  error(component, message, data = null) {
    this.log('ERROR', component, message, data);
  }

  /**
   * Warning logging
   */
  warn(component, message, data = null) {
    this.log('WARN', component, message, data);
  }

  /**
   * Info logging
   */
  info(component, message, data = null) {
    this.log('INFO', component, message, data);
  }

  /**
   * Debug logging
   */
  debug(component, message, data = null) {
    this.log('DEBUG', component, message, data);
  }

  /**
   * System startup messages (always shown regardless of level)
   */
  system(message, data = null) {
    const timestamp = chalk.gray(this.getTimestamp());
    const systemTag = chalk.green.bold('[SYSTEM]');
    let formattedMessage = `${timestamp} ${systemTag} ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        try {
          formattedMessage += '\n' + chalk.gray(JSON.stringify(data, null, 2));
        } catch (error) {
          // Handle circular references or other JSON.stringify errors
          formattedMessage += '\n' + chalk.gray(`[Object serialization failed: ${error.message}]`);
        }
      } else {
        formattedMessage += ` ${data}`;
      }
    }
    
    console.log(formattedMessage);
  }

  /**
   * Component-specific logging methods
   */
  discord = {
    error: (message, data) => this.error('DISCORD', message, data),
    warn: (message, data) => this.warn('DISCORD', message, data),
    info: (message, data) => this.info('DISCORD', message, data),
    debug: (message, data) => this.debug('DISCORD', message, data)
  };

  strava = {
    error: (message, data) => this.error('STRAVA', message, data),
    warn: (message, data) => this.warn('STRAVA', message, data),
    info: (message, data) => this.info('STRAVA', message, data),
    debug: (message, data) => this.debug('STRAVA', message, data)
  };

  webhook = {
    error: (message, data) => this.error('WEBHOOK', message, data),
    warn: (message, data) => this.warn('WEBHOOK', message, data),
    info: (message, data) => this.info('WEBHOOK', message, data),
    debug: (message, data) => this.debug('WEBHOOK', message, data)
  };

  member = {
    error: (message, data) => this.error('MEMBER', message, data),
    warn: (message, data) => this.warn('MEMBER', message, data),
    info: (message, data) => this.info('MEMBER', message, data),
    debug: (message, data) => this.debug('MEMBER', message, data)
  };

  activity = {
    error: (message, data) => this.error('ACTIVITY', message, data),
    warn: (message, data) => this.warn('ACTIVITY', message, data),
    info: (message, data) => this.info('ACTIVITY', message, data),
    debug: (message, data) => this.debug('ACTIVITY', message, data)
  };

  server = {
    error: (message, data) => this.error('SERVER', message, data),
    warn: (message, data) => this.warn('SERVER', message, data),
    info: (message, data) => this.info('SERVER', message, data),
    debug: (message, data) => this.debug('SERVER', message, data)
  };

  database = {
    error: (message, data) => this.error('DATABASE', message, data),
    warn: (message, data) => this.warn('DATABASE', message, data),
    info: (message, data) => this.info('DATABASE', message, data),
    debug: (message, data) => this.debug('DATABASE', message, data)
  };

  scheduler = {
    error: (message, data) => this.error('SCHEDULER', message, data),
    warn: (message, data) => this.warn('SCHEDULER', message, data),
    info: (message, data) => this.info('SCHEDULER', message, data),
    debug: (message, data) => this.debug('SCHEDULER', message, data)
  };

  /**
   * Request logging for HTTP requests
   */
  request(method, path, statusCode, responseTime, userAgent = null) {
    if (!this.shouldLog('INFO')) return;

    const methodColor = {
      'GET': chalk.green,
      'POST': chalk.blue,
      'PUT': chalk.yellow,
      'DELETE': chalk.red,
      'PATCH': chalk.magenta
    };

    let statusColor;
    if (statusCode >= 400) {
      statusColor = chalk.red;
    } else if (statusCode >= 300) {
      statusColor = chalk.yellow;
    } else {
      statusColor = chalk.green;
    }
    const formattedMethod = (methodColor[method] || chalk.white)(method.padEnd(6));
    const formattedStatus = statusColor(statusCode);
    const formattedTime = responseTime ? chalk.gray(`${responseTime}ms`) : '';
    
    let logMessage = `${formattedMethod} ${path} ${formattedStatus} ${formattedTime}`;
    
    if (userAgent && this.shouldLog('DEBUG')) {
      logMessage += ` - ${chalk.gray(userAgent)}`;
    }

    const timestamp = chalk.gray(this.getTimestamp());
    const serverTag = this.componentColors.SERVER('[SERVER]');
    console.log(`${timestamp} ${serverTag} ${logMessage}`);
  }

  /**
   * Activity processing logging
   */
  activityProcessing(activityId, athleteId, activityName, status, details = null) {
    const statusEmojis = {
      'STARTED': '🔄',
      'COMPLETED': '✅',
      'FAILED': '❌',
      'SKIPPED': '⏭️',
      'FILTERED': '🚫'
    };

    const emoji = statusEmojis[status] || '📝';
    const message = `${emoji} Activity ${activityId} by athlete ${athleteId}: ${activityName} - ${status}`;
    
    if (status === 'FAILED') {
      this.activity.error(message, details);
    } else if (status === 'SKIPPED' || status === 'FILTERED') {
      this.activity.debug(message, details);
    } else {
      this.activity.info(message, details);
    }
  }

  /**
   * Member management logging
   */
  memberAction(action, memberName, discordId, athleteId, details = null) {
    const actionEmojis = {
      'REGISTERED': '✅',
      'REMOVED': '🗑️',
      'DEACTIVATED': '🔴',
      'REACTIVATED': '🟢',
      'TOKEN_REFRESHED': '🔄',
      'TOKEN_FAILED': '❌'
    };

    const emoji = actionEmojis[action] || '📝';
    const message = `${emoji} Member ${memberName} (Discord: ${discordId}, Strava: ${athleteId}) - ${action}`;
    
    if (action === 'TOKEN_FAILED' || action === 'REMOVED') {
      this.member.warn(message, details);
    } else {
      this.member.info(message, details);
    }
  }

  /**
   * Get current logging configuration
   */
  getConfig() {
    return {
      currentLevel: Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel),
      numericLevel: this.currentLevel,
      enabledLevels: Object.keys(this.levels).filter(level => this.levels[level] <= this.currentLevel)
    };
  }

  /**
   * Set log level programmatically
   */
  setLevel(level) {
    const upperLevel = level.toUpperCase();
    if (this.levels[upperLevel] !== undefined) {
      this.currentLevel = this.levels[upperLevel];
      this.info('SYSTEM', `Log level changed to ${upperLevel}`);
    } else {
      this.warn('SYSTEM', `Invalid log level: ${level}. Available levels: ${Object.keys(this.levels).join(', ')}`);
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;