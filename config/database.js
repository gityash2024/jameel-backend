const mongoose = require('mongoose');
const logger = require('./logging');

const connectDB = async () => {
  try {
    logger.info('Attempting database connection...');
    logger.info(`MongoDB URI: ${process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      autoIndex: process.env.NODE_ENV !== 'production'
    };

    const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jsk_jewelry';

    const conn = await mongoose.connect(dbURI, options);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to DB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('Mongoose disconnected');
    });

    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('Mongoose connection closed through app termination');
        process.exit(0);
      } catch (err) {
        logger.error('Error closing Mongoose connection:', err);
        process.exit(1);
      }
    });

    if (process.env.NODE_ENV === 'development') {
      await setupIndexes();
    }

    await seedInitialData();

    return conn;

  } catch (error) {
    logger.error('Database connection error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

const setupIndexes = async () => {
  try {
    const User = require('../models/user.model');
    const Product = require('../models/product.model');
    const Order = require('../models/order.model');
    const Review = require('../models/review.model');
    const Category = require('../models/category.model');
    const Role = require('../models/role.model');

    await Promise.all([
      User.createIndexes(),
      Product.createIndexes(),
      Order.createIndexes(),
      Review.createIndexes(),
      Category.createIndexes(),
      Role.createIndexes()
    ]);

    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Error creating database indexes:', error);
  }
};

const seedInitialData = async () => {
  try {
    const mongoose = require('mongoose');
    
    const roleSchema = new mongoose.Schema({
      name: {
        type: String,
        required: true,
        unique: true,
        // enum: ['admin', 'customer', 'staff']
      },
      permissions: [{
        type: String
      }]
    }, {
      timestamps: true
    });

    let Role;
    try {
      Role = mongoose.model('Role');
    } catch {
      Role = mongoose.model('Role', roleSchema);
    }

    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
      const roles = [
        {
          name: 'admin',
          permissions: ['all']
        },
        {
          name: 'customer',
          permissions: ['read', 'write_own']
        },
        {
          name: 'staff',
          permissions: ['read', 'write', 'update']
        }
      ];

      await Role.insertMany(roles);
      logger.info('Initial roles seeded successfully');
    }
  } catch (error) {
    logger.error('Error seeding initial data:', error);
  }
};

const clearDatabase = async () => {
  if (process.env.NODE_ENV === 'test') {
    try {
      const collections = await mongoose.connection.db.collections();
      for (let collection of collections) {
        await collection.deleteMany({});
      }
      logger.info('Test database cleared');
    } catch (error) {
      logger.error('Error clearing test database:', error);
    }
  }
};

setInterval(() => {
  if (mongoose.connection.readyState !== 1) {
    logger.warn('Database connection lost. Attempting to reconnect...');
    connectDB().catch(err => {
      logger.error('Reconnection failed:', err);
    });
  }
}, 10000);

module.exports = {
  connectDB,
  clearDatabase
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Closing database connection...');
  try {
    await mongoose.connection.close();
    logger.info('Database connection closed.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during database shutdown:', err);
    process.exit(1);
  }
});