// src/routes/inventory.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {validate} = require('../middleware/validate.middleware');
const inventoryController = require('../controllers/inventory.controller');

// All inventory routes require authentication and admin/staff authorization
router.use(authenticate, authorize(['admin', 'staff']));

// Inventory queries
router.get('/', inventoryController.getAllInventory);
router.get('/low-stock', inventoryController.getLowStockItems);
router.get('/out-of-stock', inventoryController.getOutOfStockItems);
router.get('/store/:storeId', inventoryController.getStoreInventory);
router.get('/:id', inventoryController.getInventoryItemById);

// Inventory management
router.post('/', validate({
  body: {
    productId: 'required|string',
    variantId: 'string',
    storeId: 'required|string',
    quantity: 'required|integer|min:0',
    sku: 'required|string',
    location: {
      aisle: 'string',
      shelf: 'string',
      bin: 'string'
    },
    lowStockAlert: {
      enabled: 'boolean',
      threshold: 'integer|min:0'
    }
  }
}), inventoryController.createInventoryItem);

router.put('/:id', validate({
  body: {
    quantity: 'integer|min:0',
    location: 'object',
    lowStockAlert: 'object'
  }
}), inventoryController.updateInventoryItem);

// Stock adjustments
router.post('/:id/adjust', validate({
  body: {
    adjustmentType: 'required|string|in:add,remove,set',
    quantity: 'required|integer',
    reason: 'required|string',
    notes: 'string'
  }
}), inventoryController.adjustStock);

// Stock transfers
router.post('/transfer', validate({
  body: {
    fromStoreId: 'required|string',
    toStoreId: 'required|string',
    items: 'required|array',
    'items.*.productId': 'required|string',
    'items.*.quantity': 'required|integer|min:1'
  }
}), inventoryController.transferStock);

// Bulk operations
router.post('/bulk/create', validate({
  body: {
    items: 'required|array',
    'items.*.productId': 'required|string',
    'items.*.storeId': 'required|string',
    'items.*.quantity': 'required|integer|min:0'
  }
}), inventoryController.bulkCreateInventory);

router.put('/bulk/update', validate({
  body: {
    items: 'required|array',
    'items.*.id': 'required|string',
    'items.*.quantity': 'integer|min:0'
  }
}), inventoryController.bulkUpdateInventory);

// Stock count and reconciliation
router.post('/count', validate({
  body: {
    storeId: 'required|string',
    countedBy: 'required|string',
    items: 'required|array',
    'items.*.productId': 'required|string',
    'items.*.countedQuantity': 'required|integer|min:0',
    notes: 'string'
  }
}), inventoryController.recordStockCount);

router.post('/reconcile', validate({
  body: {
    storeId: 'required|string',
    items: 'required|array',
    'items.*.productId': 'required|string',
    'items.*.adjustedQuantity': 'required|integer',
    reason: 'required|string'
  }
}), inventoryController.reconcileInventory);

// Alerts and notifications
router.get('/alerts', inventoryController.getInventoryAlerts);
router.put('/alerts/settings', validate({
  body: {
    lowStockThreshold: 'integer|min:0',
    notificationEmail: 'string|email',
    enableNotifications: 'boolean'
  }
}), inventoryController.updateAlertSettings);

// Reports and analytics
router.get('/reports/stock-levels', inventoryController.getStockLevelsReport);
router.get('/reports/movements', validate({
  query: {
    startDate: 'date',
    endDate: 'date',
    storeId: 'string'
  }
}), inventoryController.getStockMovementsReport);

router.get('/analytics/turnover', inventoryController.getInventoryTurnoverAnalytics);
router.get('/analytics/performance', inventoryController.getInventoryPerformanceMetrics);

// Export functionality
router.get('/export/csv', inventoryController.exportInventoryCSV);
router.post('/import/csv', inventoryController.uploadCSV, inventoryController.importInventoryCSV);

module.exports = router;