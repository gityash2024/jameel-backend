require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./src/models/roles.model');

const MONGODB_URI = process.env.MONGODB_URI;

async function seedRoles() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const adminRole = { name: 'admin', permissions: ['all'] };

    const existingRole = await Role.findOne({ name: 'admin' });
    if (existingRole) {
      console.log('Admin role already exists');
    } else {
      await Role.create(adminRole);
      console.log('Admin role seeded successfully');
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding roles:', error);
    mongoose.connection.close();
  }
}

seedRoles();
