// src/utils/responseHandler.js
const logger = require('../config/logging');

class ResponseHandler {
  constructor(res) {
    this.res = res;
  }

  /**
   * Send success response
   * @param {Object} options - Response options
   * @param {number} options.statusCode - HTTP status code
   * @param {string} options.message - Success message
   * @param {any} options.data - Response data
   * @param {Object} options.meta - Meta information (pagination, etc.)
   */
  success({ statusCode = 200, message = 'Success', data = null, meta = null }) {
    const response = {
      status: 'success',
      message,
      timestamp: new Date().toISOString()
    };

    if (data !== null) {
      response.data = data;
    }

    if (meta !== null) {
      response.meta = meta;
    }

    return this.res.status(statusCode).json(response);
  }

  /**
   * Send error response
   * @param {Object} options - Error options
   * @param {number} options.statusCode - HTTP status code
   * @param {string} options.message - Error message
   * @param {Array} options.errors - Validation errors
   * @param {string} options.stack - Error stack trace (only in development)
   */
  error({ statusCode = 500, message = 'Internal Server Error', errors = null, stack = null }) {
    const response = {
      status: 'error',
      message,
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.errors = errors;
    }

    // Include stack trace only in development
    if (process.env.NODE_ENV === 'development' && stack) {
      response.stack = stack;
    }

    // Log error
    logger.error({
      statusCode,
      message,
      errors,
      stack,
      path: this.res.req.originalUrl,
      method: this.res.req.method
    });

    return this.res.status(statusCode).json(response);
  }

  /**
   * Send created response (201)
   * @param {Object} options - Response options
   */
  created({ message = 'Resource created successfully', data = null, meta = null }) {
    return this.success({ statusCode: 201, message, data, meta });
  }

  /**
   * Send no content response (204)
   */
  noContent() {
    return this.res.status(204).send();
  }

  /**
   * Send bad request response (400)
   * @param {Object} options - Error options
   */
  badRequest({ message = 'Bad Request', errors = null }) {
    return this.error({ statusCode: 400, message, errors });
  }

  /**
   * Send unauthorized response (401)
   * @param {Object} options - Error options
   */
  unauthorized({ message = 'Unauthorized', errors = null }) {
    return this.error({ statusCode: 401, message, errors });
  }

  /**
   * Send forbidden response (403)
   * @param {Object} options - Error options
   */
  forbidden({ message = 'Forbidden', errors = null }) {
    return this.error({ statusCode: 403, message, errors });
  }

  /**
   * Send not found response (404)
   * @param {Object} options - Error options
   */
  notFound({ message = 'Resource not found', errors = null }) {
    return this.error({ statusCode: 404, message, errors });
  }

  /**
   * Send validation error response (422)
   * @param {Object} options - Error options
   */
  validationError({ message = 'Validation Error', errors = null }) {
    return this.error({ statusCode: 422, message, errors });
  }

  /**
   * Send too many requests response (429)
   * @param {Object} options - Error options
   */
  tooManyRequests({ message = 'Too many requests', errors = null }) {
    return this.error({ statusCode: 429, message, errors });
  }

  /**
   * Send paginated response
   * @param {Object} options - Pagination options
   */
  paginated({ data, page, limit, total, message = 'Success' }) {
    const totalPages = Math.ceil(total / limit);
    const meta = {
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };

    return this.success({ data, meta, message });
  }

  /**
   * Send file download response
   * @param {Object} options - File options
   */
  download({ file, filename, contentType = 'application/octet-stream' }) {
    return this.res
      .set('Content-Type', contentType)
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .send(file);
  }
}

module.exports = (res) => new ResponseHandler(res);