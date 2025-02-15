const app = require('./app');
const connectDB = require('./config/database');
const logger = require('./config/logging');
require('dotenv').config();

const startServer = async () => {
  try {
    console.log('===== SERVER STARTUP =====');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Port:', process.env.PORT);
    console.log('MongoDB URI:', process.env.MONGODB_URI);

    // Log all routes from index.routes.js
    const indexRoutes = require('./src/routes/index.routes');
    console.log('Registered Routes:');
    indexRoutes.stack.forEach((route) => {
      if (route.route) {
        console.log(`Path: ${Object.keys(route.route.methods).join(', ')} ${route.route.path}`);
      }
    });

    // Validate critical environment variables
    const requiredVars = ['MONGODB_URI', 'PORT', 'JWT_SECRET'];
    const missingVars = requiredVars.filter(variable => !process.env[variable]);
    
    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars);
      process.exit(1);
    }

    // Attempt database connection
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connection successful');

    const PORT = process.env.PORT || 5000;

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`===== SERVER RUNNING =====`);
      console.log(`Mode: ${process.env.NODE_ENV}`);
      console.log(`Port: ${PORT}`);
      console.log(`Listening on: http://localhost:${PORT}`);
      logger.info(`Server running on port ${PORT}`);
    });

    // Handle server startup errors
    server.on('error', (error) => {
      console.error('Server startup error:', error);
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          console.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
        case 'EADDRINUSE':
          console.error(`Port ${PORT} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      server.close(() => process.exit(1));
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error('Failed to start server:');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

startServer();