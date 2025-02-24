require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./src/models/roles.model');

const MONGODB_URI = process.env.MONGODB_URI;

async function seedRoles() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const roles = [
      {
        name: 'admin',
        permissions: ['all']
      },
      {
        name: 'customer',
        permissions: ['all']
        // permissions: ['view_products', 'place_orders', 'manage_profile']
      }
    ];

    for (const role of roles) {
      const existingRole = await Role.findOne({ name: role.name });
      if (existingRole) {
        console.log(`${role.name} role already exists`);
      } else {
        await Role.create(role);
        console.log(`${role.name} role seeded successfully`);
      }
    }

    console.log('Role seeding completed');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding roles:', error);
    mongoose.connection.close();
  }
}

seedRoles();