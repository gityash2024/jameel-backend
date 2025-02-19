const Role = require('../models/role.model');

const seedRoles = async () => {
  try {
    // Check if roles already exist
    const count = await Role.countDocuments();
    if (count === 0) {
      // Create default roles
      await Role.create([
        {
          name: 'admin',
          permissions: ['all']
        },
        {
          name: 'customer',
          permissions: ['read']
        },
        {
          name: 'staff',
          permissions: ['read', 'write']
        }
      ]);
      console.log('Roles seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding roles:', error);
  }
};

module.exports = seedRoles;