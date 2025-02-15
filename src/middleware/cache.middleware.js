// src/middleware/cache.middleware.js
const redis = require('redis');
const { promisify } = require('util');
const logger = require('../../config/logging');

// Create Redis client
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD
});

// Promisify Redis methods
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

// Handle Redis errors
client.on('error', (error) => {
  logger.error('Redis Error:', error);
});

client.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Parse cache duration string to milliseconds
const parseDuration = (duration) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid duration format');

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
};

// Cache middleware
const cache = (duration = '5m') => {
  return async (req, res, next) => {
    // Skip cache if cache is disabled
    if (process.env.CACHE_ENABLED !== 'true') {
      return next();
    }

    try {
      // Generate cache key based on URL and query parameters
      const cacheKey = `api:${req.originalUrl || req.url}`;

      // Check if we have a cache hit
      const cachedResponse = await getAsync(cacheKey);

      if (cachedResponse) {
        // Parse the cached response
        const response = JSON.parse(cachedResponse);
        return res.status(200).json({
          ...response,
          cache: {
            hit: true,
            time: new Date().toISOString()
          }
        });
      }

      // If no cache hit, override res.json to store response in cache
      const originalJson = res.json;
      res.json = async function(body) {
        try {
          // Convert duration to milliseconds
          const milliseconds = parseDuration(duration);

          // Store the response in cache
          await setAsync(
            cacheKey,
            JSON.stringify(body),
            'PX',
            milliseconds
          );
// src/middleware/cache.middleware.js (continued)
body.cache = {
    hit: false,
    time: new Date().toISOString(),
    ttl: duration
  };

  // Call the original json method
  return originalJson.call(this, body);
} catch (error) {
  logger.error('Cache storage error:', error);
  // If caching fails, just send the response without caching
  return originalJson.call(this, body);
}
};

next();
} catch (error) {
logger.error('Cache middleware error:', error);
next();
}
};
};

// Clear cache by pattern
const clearCache = async (pattern) => {
return new Promise((resolve, reject) => {
client.keys(pattern, (err, keys) => {
if (err) return reject(err);
if (keys.length > 0) {
client.del(keys, (err, response) => {
  if (err) return reject(err);
  resolve(response);
});
} else {
resolve(0);
}
});
});
};

module.exports = {
cache,
clearCache,
client
};