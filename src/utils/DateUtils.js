/**
 * Date utility functions
 * Centralizes common date operations to reduce code duplication
 */
class DateUtils {
  /**
   * Format date to YYYY-MM-DD format
   * @param {Date} date - Date object to format
   * @returns {string} Date in YYYY-MM-DD format
   */
  static formatDateOnly(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get today's date in YYYY-MM-DD format
   * @returns {string} Today's date in YYYY-MM-DD format
   */
  static getTodayDateString() {
    return this.formatDateOnly(new Date());
  }

  /**
   * Create a Date object from a date string (assumes midnight UTC)
   * @param {string} dateString - Date string in YYYY-MM-DD format
   * @returns {Date} Date object with time set to midnight
   */
  static parseDateString(dateString) {
    return new Date(dateString + 'T00:00:00');
  }

  /**
   * Format date for display in locale format
   * @param {string} dateString - Date string in YYYY-MM-DD format
   * @returns {string} Localized date string
   */
  static formatForDisplay(dateString) {
    return this.parseDateString(dateString).toLocaleDateString();
  }

  /**
   * Calculate days between two dates
   * @param {Date} date1 - First date
   * @param {Date} date2 - Second date
   * @returns {number} Number of days between dates (can be negative)
   */
  static daysBetween(date1, date2) {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    return Math.floor((date2 - date1) / ONE_DAY_MS);
  }

  /**
   * Get days until a target date from today
   * @param {string} targetDateString - Target date in YYYY-MM-DD format
   * @returns {number} Number of days until target date
   */
  static daysUntil(targetDateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = this.parseDateString(targetDateString);
    return this.daysBetween(today, targetDate);
  }

  /**
   * Convert DD-MM-YYYY format to YYYY-MM-DD format (for internal storage)
   * @param {string} dateString - Date string in DD-MM-YYYY format
   * @returns {string} Date in YYYY-MM-DD format
   * @throws {TypeError} If date format is invalid
   */
  static convertDDMMYYYYToISO(dateString) {
    const ddmmyyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dateString.match(ddmmyyyyRegex);

    if (!match) {
      throw new TypeError('Date must be in DD-MM-YYYY format');
    }

    const [, day, month, year] = match;
    const isoDate = `${year}-${month}-${day}`;

    // Validate the date is actually valid
    const date = new Date(isoDate + 'T00:00:00');
    if (Number.isNaN(date.getTime())) {
      throw new TypeError('Invalid date');
    }

    return isoDate;
  }

  /**
   * Convert YYYY-MM-DD format to DD-MM-YYYY format (for display to users)
   * @param {string} dateString - Date string in YYYY-MM-DD format
   * @returns {string} Date in DD-MM-YYYY format
   */
  static convertISOToDDMMYYYY(dateString) {
    const yyyymmddRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateString.match(yyyymmddRegex);

    if (!match) {
      throw new TypeError('Date must be in YYYY-MM-DD format');
    }

    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }
}

module.exports = DateUtils;
