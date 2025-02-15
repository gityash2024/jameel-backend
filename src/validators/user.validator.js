const { body, param } = require('express-validator');
const User = require('../models/user.model');

exports.updateProfile = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .optional()  
    .trim()
    .isLength({ min: 2, max: 50 }) 
    .withMessage('Last name must be between 2 and 50 characters'),

  body('phone')
    .optional()  
    .trim()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Please enter a valid phone number') 
    .custom(async (value, { req }) => {
      const user = await User.findOne({ phone: value, _id: { $ne: req.user._id } });
      if (user) {
        throw new Error('Phone number already in use');
      }  
      return true;
    }),

  body('gender')
    .optional()  
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),

  body('dateOfBirth') 
    .optional()
    .isISO8601()
    .withMessage('Invalid date of birth')  
];

exports.addAddress = [
  body('type')
    .notEmpty()
    .withMessage('Address type is required')
    .isIn(['home', 'work', 'other']) 
    .withMessage('Invalid address type'),

  body('firstName') 
    .trim()
    .notEmpty()
    .withMessage('First name is required'),

  body('lastName')  
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),

  body('address1') 
    .trim()
    .notEmpty()
    .withMessage('Address line 1 is required'),

  body('address2')
    .optional()   
    .trim(),

  body('city')
    .trim()  
    .notEmpty()
    .withMessage('City is required'),

  body('state')   
    .trim()
    .notEmpty()
    .withMessage('State is required'),

  body('postalCode')    
    .trim()
    .notEmpty()
    .withMessage('Postal code is required'),

  body('country')     
    .trim()
    .notEmpty()
    .withMessage('Country is required'),

  body('phone')      
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),

  body('isDefault')       
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean')
];

exports.updateAddress = [  
  param('id')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid address ID'),

  ...exports.addAddress.map(validator => ({
    ...validator, 
    optional: true
  }))
];

exports.addToWishlist = [
  body('productId')  
    .notEmpty()
    .withMessage('Product ID is required') 
];

exports.updateNotificationPreferences = [
  body('email')
    .isBoolean() 
    .withMessage('Email preference must be a boolean'),

  body('sms') 
    .isBoolean()
    .withMessage('SMS preference must be a boolean'),

  body('orderUpdates')  
    .isBoolean()
    .withMessage('Order updates preference must be a boolean'),

  body('promotions')   
    .isBoolean()
    .withMessage('Promotions preference must be a boolean'),

  body('newsletter')    
    .isBoolean()
    .withMessage('Newsletter preference must be a boolean') 
];

exports.addPaymentMethod = [
  body('type')  
    .notEmpty()
    .withMessage('Payment method type is required')
    .isIn(['credit_card', 'debit_card'])
    .withMessage('Invalid payment method type'),

  body('token')   
    .notEmpty()
    .withMessage('Payment token is required')
];