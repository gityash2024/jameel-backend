// src/utils/dateTime.js
const moment = require('moment');

class DateTimeUtil {
  /**
   * Get current date and time
   * @param {string} format - Moment.js format string
   * @returns {string} Formatted date string
   */
  static getCurrentDateTime(format = 'YYYY-MM-DD HH:mm:ss') {
    return moment().format(format);
  }

  /**
   * Format date
   * @param {Date|string} date - Date to format
   * @param {string} format - Output format
   * @returns {string} Formatted date string
   */
  static formatDate(date, format = 'YYYY-MM-DD') {
    return moment(date).format(format);
  }

  /**
   * Format time
   * @param {Date|string} time - Time to format
   * @param {string} format - Output format
   * @returns {string} Formatted time string
   */
  static formatTime(time, format = 'HH:mm:ss') {
    return moment(time).format(format);
  }

  /**
   * Add time to date
   * @param {Date|string} date - Base date
   * @param {number} amount - Amount to add
   * @param {string} unit - Time unit (years, months, days, hours, minutes, seconds)
   * @returns {Date} New date
   */
  static addTime(date, amount, unit) {
    return moment(date).add(amount, unit).toDate();
  }

  /**
   * Subtract time from date
   * @param {Date|string} date - Base date
   * @param {number} amount - Amount to subtract
   * @param {string} unit - Time unit
   * @returns {Date} New date
   */
  static subtractTime(date, amount, unit) {
    return moment(date).subtract(amount, unit).toDate();
  }

  /**
   * Get difference between dates
   * @param {Date|string} date1 - First date
   * @param {Date|string} date2 - Second date
   * @param {string} unit - Unit for difference
   * @returns {number} Difference in specified unit
   */
  static getDateDiff(date1, date2, unit = 'days') {
    return moment(date1).diff(moment(date2), unit);
  }

  /**
   * Check if date is before another date
   * @param {Date|string} date1 - Date to check
   * @param {Date|string} date2 - Date to compare against
   * @returns {boolean}
   */
  static isBefore(date1, date2) {
    return moment(date1).isBefore(date2);
  }

  /**
   * Check if date is after another date
   * @param {Date|string} date1 - Date to check
   * @param {Date|string} date2 - Date to compare against
   * @returns {boolean}
   */
  static isAfter(date1, date2) {
    return moment(date1).isAfter(date2);
  }

  /**
   * Check if date is between two dates
   * @param {Date|string} date - Date to check
   * @param {Date|string} start - Start date
   * @param {Date|string} end - End date
   * @returns {boolean}
   */
  static isBetween(date, start, end) {
    return moment(date).isBetween(start, end);
  }

  /**
   * Check if date is valid
   * @param {Date|string} date - Date to validate
   * @returns {boolean}
   */
  static isValidDate(date) {
    return moment(date).isValid();
  }

  /**
   * Get start of time unit
   * @param {Date|string} date - Base date
   * @param {string} unit - Time unit (year, month, week, day)
   * @returns {Date}
   */
  static startOf(date, unit) {
    return moment(date).startOf(unit).toDate();
  }

  /**
   * Get end of time unit
   * @param {Date|string} date - Base date
   * @param {string} unit - Time unit (year, month, week, day)
   * @returns {Date}
   */
  static endOf(date, unit) {
    return moment(date).endOf(unit).toDate();
  }

  /**
   * Get relative time
   * @param {Date|string} date - Date to get relative time for
   * @returns {string} Relative time string
   */
  static getRelativeTime(date) {
    return moment(date).fromNow();
  }

  /**
   * Get business days between dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {number} Number of business days
   */
  static getBusinessDays(startDate, endDate) {
    let count = 0;
    let current = moment(startDate);
    const end = moment(endDate);

    while (current <= end) {
      if (current.day() !== 0 && current.day() !== 6) {
        count++;
      }
      current = current.add(1, 'days');
    }
    return count;
  }

  /**
   * Get next business day
   * @param {Date|string} date - Base date
   * @returns {Date} Next business day
   */
  static getNextBusinessDay(date) {
    const nextDay = moment(date).add(1, 'days');
    while (nextDay.day() === 0 || nextDay.day() === 6) {
      nextDay.add(1, 'days');
    }
    return nextDay.toDate();
  }

  /**
   * Create date ranges
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @param {string} unit - Time unit for intervals
   * @returns {Array<Object>} Array of date ranges
   */
  static createDateRanges(startDate, endDate, unit = 'days') {
    const ranges = [];
    let current = moment(startDate);
    const end = moment(endDate);

    while (current <= end) {
      ranges.push({
        start: current.clone().toDate(),
        end: current.clone().endOf(unit).toDate()
      });
      current = current.add(1, unit).startOf(unit);
    }

    return ranges;
  }
}

module.exports = DateTimeUtil;