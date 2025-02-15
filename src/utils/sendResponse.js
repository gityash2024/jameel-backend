// src/utils/sendResponse.js
class SendResponse {
    constructor(res) {
      this.res = res;
    }
  
    /**
     * Send success response
     * @param {Object} options
     */
    success({ statusCode = 200, message = 'Success', data = null, meta = null }) {
      const response = {
        success: true,
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
     * @param {Object} options
     */
    error({ statusCode = 500, message = 'Error', errors = null }) {
      const response = {
        success: false,
        message,
        timestamp: new Date().toISOString()
      };
  
      if (errors !== null) {
        response.errors = errors;
      }
  
      // Add stack trace in development
      if (process.env.NODE_ENV === 'development' && this.res.locals.error) {
        response.stack = this.res.locals.error.stack;
      }
  
      return this.res.status(statusCode).json(response);
    }
  
    /**
     * Send created response (201)
     * @param {Object} options
     */
    created({ message = 'Resource created successfully', data = null }) {
      return this.success({ statusCode: 201, message, data });
    }
  
    /**
     * Send no content response (204)
     */
    noContent() {
      return this.res.status(204).send();
    }
  
    /**
     * Send bad request response (400)
     * @param {Object} options
     */
    badRequest({ message = 'Bad request', errors = null }) {
      return this.error({ statusCode: 400, message, errors });
    }
  
    /**
     * Send unauthorized response (401)
     * @param {Object} options
     */
    unauthorized({ message = 'Unauthorized', errors = null }) {
      return this.error({ statusCode: 401, message, errors });
    }
  
    /**
     * Send forbidden response (403)
     * @param {Object} options
     */
    forbidden({ message = 'Forbidden', errors = null }) {
      return this.error({ statusCode: 403, message, errors });
    }
  
    /**
     * Send not found response (404)
     * @param {Object} options
     */
    notFound({ message = 'Resource not found', errors = null }) {
      return this.error({ statusCode: 404, message, errors });
    }
  
    /**
     * Send validation error response (422)
     * @param {Object} options
     */
    validationError({ message = 'Validation error', errors = null }) {
      return this.error({ statusCode: 422, message, errors });
    }
  
    /**
     * Send paginated response
     * @param {Object} options
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
     * Send file response
     * @param {Object} options
     */
    file({ file, filename, contentType = 'application/octet-stream' }) {
      return this.res
        .set('Content-Type', contentType)
        .set('Content-Disposition', `attachment; filename="${filename}"`)
        .send(file);
    }
  
    /**
     * Send streaming response
     * @param {Object} options
     */
    stream({ stream, contentType = 'application/octet-stream' }) {
      this.res.set('Content-Type', contentType);
      return stream.pipe(this.res);
    }
  
    /**
     * Send JSON stream response
     * @param {Object} options
     */
    jsonStream({ data, eventName = 'data' }) {
      this.res.setHeader('Content-Type', 'text/event-stream');
      this.res.setHeader('Cache-Control', 'no-cache');
      this.res.setHeader('Connection', 'keep-alive');
  
      const send = (data) => {
        this.res.write(`event: ${eventName}\n`);
        this.res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
  
      if (Array.isArray(data)) {
        data.forEach(item => send(item));
      } else {
        send(data);
      }
  
      this.res.end();
    }
  }
  
  // Export factory function
  module.exports = (res) => new SendResponse(res);