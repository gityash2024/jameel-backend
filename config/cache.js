const redis = require('redis');
const util = require('util');

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD  
});

client.on('error', (err) => {
  console.error('Redis error:', err);
});

client.on('connect', () => { 
  console.log('Connected to Redis');
});

const getAsync = util.promisify(client.get).bind(client);
const setAsync = util.promisify(client.set).bind(client);
const delAsync = util.promisify(client.del).bind(client);

module.exports = {
  client,
  getAsync,
  setAsync,
  delAsync
};