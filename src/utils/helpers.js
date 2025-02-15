// src/utils/helpers.js
const crypto = require('crypto');
const slugify = require('slugify');
const { Parser } = require('json2csv');

class Helpers {
  /**
   * Generate random string
   * @param {number} length - Length of string
   * @returns {string} Random string
   */
  static generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate slug from string
   * @param {string} str - String to slugify
   * @returns {string} Slugified string
   */
  static generateSlug(str) {
    return slugify(str, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }

  /**
   * Format price
   * @param {number} price - Price to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted price
   */
  static formatPrice(price, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(price);
  }

  /**
   * Format phone number
   * @param {string} phone - Phone number
   * @returns {string} Formatted phone number
   */
  static formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
  }

  /**
   * Generate pagination metadata
   * @param {number} total - Total number of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @returns {Object} Pagination metadata
   */
  static generatePaginationMetadata(total, page, limit) {
    const totalPages = Math.ceil(total / limit);
    return {
      currentPage: page,
      itemsPerPage: limit,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  /**
   * Convert array to CSV
   * @param {Array} data - Array of objects
   * @param {Array} fields - Fields to include
   * @returns {string} CSV string
   */
  static convertToCSV(data, fields) {
    try {
      const parser = new Parser({ fields });
      return parser.parse(data);
    } catch (error) {
      throw new Error('CSV conversion failed');
    }
  }

  /**
   * Deep clone object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Remove empty properties from object
   * @param {Object} obj - Object to clean
   * @returns {Object} Cleaned object
   */
  static removeEmptyProperties(obj) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  /**
   * Check if string is valid JSON
   * @param {string} str - String to check
   * @returns {boolean}
   */
  static isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate random number between min and max
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random number
   */
  static getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Chunk array into smaller arrays
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   */
  static chunkArray(array, size) {
    return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
      array.slice(i * size, i * size + size)
    );
  }

  /**
   * Generate order number
   * @returns {string} Order number
   */
  static generateOrderNumber() {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Calculate discount
   * @param {number} originalPrice - Original price
   * @param {number} discountPercent - Discount percentage
   * @returns {Object} Discount details
   */
  static calculateDiscount(originalPrice, discountPercent) {
    const discountAmount = (originalPrice * discountPercent) / 100;
    const finalPrice = originalPrice - discountAmount;
    return {
      originalPrice,
      discountPercent,
      discountAmount,
      finalPrice
    };
  }

  /**
   * Calculate tax
   * @param {number} amount - Amount
   * @param {number} taxRate - Tax rate
   * @returns {Object} Tax details
   */
  static calculateTax(amount, taxRate) {
    const taxAmount = (amount * taxRate) / 100;
    const totalAmount = amount + taxAmount;
    return {
      amount,
      taxRate,
      taxAmount,
      totalAmount
    };
  }

  /**
   * Mask sensitive data
   * @param {string} data - Data to mask
   * @param {number} visibleStart - Number of visible characters at start
   * @param {number} visibleEnd - Number of visible characters at end
   * @returns {string} Masked data
   */
  static maskData(data, visibleStart = 4, visibleEnd = 4) {
    if (!data) return '';
    const start = data.slice(0, visibleStart);
    const end = data.slice(-visibleEnd);
    const maskLength = Math.max(data.length - (visibleStart + visibleEnd), 0);
    const mask = '*'.repeat(maskLength);
    return `${start}${mask}${end}`;
  }

  /**
   * Sanitize HTML string
   * @param {string} html - HTML string
   * @returns {string} Sanitized HTML
   */
  static sanitizeHTML(html) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = Helpers;