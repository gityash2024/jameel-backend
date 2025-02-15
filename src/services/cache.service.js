const { client, getAsync, setAsync, delAsync } = require('../config/cache');

const getFromCache = async (key) => {
  const value = await getAsync(key);
  return value ? JSON.parse(value) : null;
};

const setCache = async (key, value, expirationInSeconds = 3600) => {
  await setAsync(key, JSON.stringify(value), 'EX', expirationInSeconds);
};

const deleteCache = async (key) => {
  await delAsync(key);
};

const deleteMultiple = async (pattern) => {
  const keys = await client.keysAsync(pattern);
  if (keys.length > 0) {
    await client.delAsync(keys);
  }
};

module.exports = {
  getFromCache,
  setCache,
  deleteCache,
  deleteMultiple
};