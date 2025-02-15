// src/routes/settings.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const settingsController = require('../controllers/settings.controller');
const cache = require('../middleware/cache.middleware');

// Public settings
router.get('/public', cache('1 hour'), settingsController.getPublicSettings);

// All other routes require authentication and admin authorization
router.use(authenticate, authorize(['admin']));

// General settings
router.get('/', settingsController.getAllSettings);
router.get('/:group', settingsController.getSettingsByGroup);

router.post('/', validate({
  body: {
    group: 'required|string|in:general,payment,shipping,email,social,seo,store',
    key: 'required|string',
    value: 'required',
    dataType: 'required|string|in:string,number,boolean,object,array',
    isPublic: 'boolean',
    description: 'string'
  }
}), settingsController.createSetting);

router.put('/:group/:key', validate({
  body: {
    value: 'required',
    isPublic: 'boolean',
    description: 'string'
  }
}), settingsController.updateSetting);

router.delete('/:group/:key', settingsController.deleteSetting);

// Bulk operations
router.post('/bulk/update', validate({
  body: {
    settings: 'required|array',
    'settings.*.group': 'required|string',
    'settings.*.key': 'required|string',
    'settings.*.value': 'required'
  }
}), settingsController.bulkUpdateSettings);

// Store settings
router.get('/store/general', settingsController.getStoreSettings);
router.put('/store/general', validate({
  body: {
    storeName: 'string',
    storeEmail: 'string|email',
    storePhone: 'string',
    timezone: 'string',
    dateFormat: 'string',
    timeFormat: 'string',
    currency: 'string',
    defaultLanguage: 'string'
  }
}), settingsController.updateStoreSettings);

// SEO settings
router.get('/seo', settingsController.getSeoSettings);
router.put('/seo', validate({
  body: {
    metaTitle: 'string',
    metaDescription: 'string',
    metaKeywords: 'array',
    googleAnalyticsId: 'string',
    facebookPixelId: 'string'
  }
}), settingsController.updateSeoSettings);

// Email settings
router.get('/email', settingsController.getEmailSettings);
router.put('/email', validate({
  body: {
    fromName: 'string',
    fromEmail: 'string|email',
    smtpHost: 'string',
    smtpPort: 'integer',
    smtpUser: 'string',
    smtpPassword: 'string',
    enableSsl: 'boolean'
  }
}), settingsController.updateEmailSettings);

// Social media settings
router.get('/social', settingsController.getSocialMediaSettings);
router.put('/social', validate({
  body: {
    facebook: 'string',
    twitter: 'string',
    instagram: 'string',
    pinterest: 'string',
    youtube: 'string'
  }
}), settingsController.updateSocialMediaSettings);

// API settings
router.get('/api', settingsController.getApiSettings);
router.put('/api', validate({
  body: {
    allowedOrigins: 'array',
    rateLimits: 'object',
    cacheSettings: 'object'
  }
}), settingsController.updateApiSettings);

// Security settings
router.get('/security', settingsController.getSecuritySettings);
router.put('/security', validate({
  body: {
    passwordPolicy: 'object',
    sessionTimeout: 'integer',
    maxLoginAttempts: 'integer',
    twoFactorAuth: 'object'
  }
}), settingsController.updateSecuritySettings);

// Cache management
router.post('/cache/clear', validate({
  body: {
    group: 'string',
    key: 'string'
  }
}), settingsController.clearCache);

router.post('/cache/clear-all', settingsController.clearAllCache);

// Backup and restore
router.post('/backup', settingsController.createSettingsBackup);
router.post('/restore', settingsController.restoreSettingsFromBackup);

// Export and import
router.get('/export', settingsController.exportSettings);
router.post('/import', settingsController.importSettings);

module.exports = router;