const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const roleController = require('../controllers/role.controller');

// Get all roles
router.get('/', authenticate, authorize('admin'), roleController.getAllRoles);

// Create a new role
router.post('/', authenticate, authorize('admin'), roleController.createRole);

// Update a role
router.put('/:id', authenticate, authorize('admin'), roleController.updateRole);

// Delete a role
router.delete('/:id', authenticate, authorize('admin'), roleController.deleteRole);

module.exports = router;