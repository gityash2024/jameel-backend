const mongoose = require('mongoose');
const logger = require('./logging');

const connectDB = async () => {
  try {
    console.log('Database Connection Attempt');
    console.log('MongoDB URI:', process.env.MONGODB_URI);

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Remove deprecated options
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Additional connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('Mongoose default connection is open');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose default connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose default connection disconnected');
    });

    return conn;
  } catch (error) {
    console.error('Detailed Database Connection Error:');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
};

module.exports = connectDB;