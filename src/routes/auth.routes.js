const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const authValidator = require('../validators/auth.validator');
const authController = require('../controllers/auth.controller');

router.post('/register', authController.register);
router.post('/login', validate(authValidator.login), authController.login);
router.post('/forgot-password', validate(authValidator.forgotPassword), authController.forgotPassword);
router.post('/reset-password/:token', validate(authValidator.resetPassword), authController.resetPassword);
router.post('/verify-email/:token', authController.verifyEmail);

router.use(authenticate);

router.get('/me', authController.getMe);
router.put('/update-details', validate(authValidator.updateDetails), authController.updateDetails);
router.put('/update-password', validate(authValidator.updatePassword), authController.updatePassword);
router.post('/logout', authController.logout);

router.use(authorize(['admin']));

router.get('/users', authController.getAllUsers);
router.get('/users/:id', authController.getUser);
router.put('/users/:id', validate(authValidator.updateUser), authController.updateUser);
router.delete('/users/:id', authController.deleteUser);

module.exports = router;