// src/api/v1/routes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import all route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const productRoutes = require('./product.routes');
const categoryRoutes = require('./category.routes');
const orderRoutes = require('./order.routes');
const cartRoutes = require('./cart.routes');
const paymentRoutes = require('./payment.routes');
const shippingRoutes = require('./shipping.routes');
const appointmentRoutes = require('./appointment.routes');
const reviewRoutes = require('./review.routes');
const blogRoutes = require('./blog.routes');
const mediaRoutes = require('./media.routes');
const storeRoutes = require('./store.routes');
const inventoryRoutes = require('./inventory.routes');
const couponRoutes = require('./coupon.routes');
const roleRoutes = require('./role.routes');
const tagRoutes = require('./tag.routes');


// Rate limiting setup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// API Documentation endpoint
router.get('/docs', (req, res) => {
  res.redirect('/api-docs');
});


router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'API is running' 
  });
});


// Mount routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/orders', orderRoutes);
router.use('/cart', cartRoutes);
router.use('/payments', paymentRoutes);
router.use('/shipping', shippingRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/blogs', blogRoutes);
router.use('/media', mediaRoutes);
router.use('/stores', storeRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/coupons', couponRoutes);
router.use('/roles', roleRoutes);
router.use('/tags', tagRoutes);

// Version info endpoint
router.get('/version', (req, res) => {
  res.status(200).json({
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Error handling for unhandled routes
router.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

module.exports = router;