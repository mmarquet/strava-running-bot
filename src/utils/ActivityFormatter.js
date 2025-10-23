const { TIME } = require('../constants');

/**
 * Shared utility functions for formatting activity data
 */
class ActivityFormatter {
  
  /**
   * Get activity color based on type
   * @param {string} activityType - The type of activity (Run, Ride, etc.)
   * @returns {string} Hex color code
   */
  static getActivityTypeColor(activityType) {
    const colors = {
      'Run': '#FC4C02',      // Strava orange
      'Ride': '#0074D9',     // Blue
      'Swim': '#39CCCC',     // Aqua
      'Walk': '#2ECC40',     // Green
      'Hike': '#8B4513',     // Brown
      'Workout': '#B10DC9',  // Purple
      'default': '#FC4C02'   // Default Strava orange
    };
    
    return colors[activityType] || colors.default;
  }

  /**
   * Get activity icon based on type
   * @param {string} activityType - The type of activity (Run, Ride, etc.)
   * @returns {string} Hex color code
   */
  static getActivityTypeIcon(activityType) {
    const icon = {
      'Run': '🏃',      
      'Ride': '🚴',   
      'Swim': '🏊',   
      'Walk': '🚶',   
      'Hike': '🥾',   
      'Workout': '🏋️',
      'default': '🏃' 
    };
    
    return icon[activityType] || icon.default;
  }


  /**
   * Format distance from meters to kilometers
   * @param {number} distanceInMeters - Distance in meters
   * @returns {string} Formatted distance string
   */
  static formatDistance(distanceInMeters) {
    const km = distanceInMeters / 1000;
    return `${km.toFixed(2)} km`;
  }

  /**
   * Format time from seconds to readable format
   * @param {number} timeInSeconds - Time in seconds
   * @returns {string} Formatted time string (HH:MM:SS or MM:SS)
   */
  static formatTime(timeInSeconds) {
    const hours = Math.floor(timeInSeconds / TIME.SECONDS_PER_HOUR);
    const minutes = Math.floor((timeInSeconds % TIME.SECONDS_PER_HOUR) / 60);
    const seconds = timeInSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Format pace from distance and time
   * @param {number} distanceInMeters - Distance in meters
   * @param {number} timeInSeconds - Time in seconds
   * @returns {string} Formatted pace string (MM:SS/km)
   */
  static formatPace(distanceInMeters, timeInSeconds) {
    if (distanceInMeters === 0) return 'N/A';
    
    const kmDistance = distanceInMeters / 1000;
    const paceInSecondsPerKm = timeInSeconds / kmDistance;
    
    const minutes = Math.floor(paceInSecondsPerKm / 60);
    const seconds = Math.round(paceInSecondsPerKm % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }

  /**
   * Format speed from distance and time
   * @param {number} distanceInMeters - Distance in meters
   * @param {number} timeInSeconds - Time in seconds
   * @returns {string} Formatted speed string (km/h)
   */
  static formatSpeed(distanceInMeters, timeInSeconds) {
    if (timeInSeconds === 0) return 'N/A';

    const hours = timeInSeconds / TIME.SECONDS_PER_HOUR;
    const kmDistance = distanceInMeters / 1000;
    const speedKmh = kmDistance / hours;
    
    return `${speedKmh.toFixed(1)} km/h`;
  }

  /**
   * Escape Discord markdown characters to prevent formatting issues
   * @param {string} text - Text that may contain Discord markdown characters
   * @returns {string} Text with escaped markdown characters
   */
  static escapeDiscordMarkdown(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Escape Discord markdown characters
    return text
      .replace(/\*/g, '\\*')    // Escape asterisks (italic/bold)
      .replace(/_/g, '\\_')     // Escape underscores (italic)
      .replace(/~/g, '\\~')     // Escape tildes (strikethrough)
      .replace(/`/g, '\\`')     // Escape backticks (code)
      .replace(/\|/g, '\\|')    // Escape pipes (spoiler)
      .replace(/>/g, '\\>')     // Escape greater than (quote)
      .replace(/@/g, '\\@');    // Escape @ symbols (mentions)
  }

  /**
   * Generate Google Maps static map URL from polyline
   * @param {string} polyline - Encoded polyline from Strava
   * @returns {string|null} Map URL or null if no API key
   */
  static generateStaticMapUrl(polyline) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return null;
    }

    // Google Static Maps API URL with polyline
    const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
    const params = new URLSearchParams({
      size: '600x400',
      maptype: 'roadmap',
      path: `enc:${polyline}`,
      key: process.env.GOOGLE_MAPS_API_KEY,
    });

    return `${baseUrl}?${params.toString()}`;
  }
}

module.exports = ActivityFormatter;