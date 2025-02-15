const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const connectDB = async () => {
  try {
    console.log('Environment Variables:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('MONGODB_URI:', process.env.MONGODB_URI);

    // Log all environment variables to a file for inspection
    const envVars = Object.keys(process.env)
      .filter(key => key.startsWith('MONGODB_') || key === 'PORT' || key === 'NODE_ENV')
      .reduce((acc, key) => {
        acc[key] = process.env[key];
        return acc;
      }, {});

    fs.writeFileSync(
      path.join(__dirname, 'env-debug.log'), 
      JSON.stringify(envVars, null, 2)
    );

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Remove deprecated options
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.db.databaseName}`);
    
    // Test database operations
    const testCollection = conn.connection.db.collection('test_connection');
    await testCollection.insertOne({ test: 'connection', timestamp: new Date() });
    
    const testDoc = await testCollection.findOne({ test: 'connection' });
    console.log('Test document:', testDoc);

    process.exit(0);
  } catch (error) {
    console.error('Detailed Database Connection Error:');
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

connectDB();