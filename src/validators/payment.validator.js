const { body } = require('express-validator');

exports.processPayment = [
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),

  body('savePaymentMethod')  
    .optional()
    .isBoolean()
    .withMessage('savePaymentMethod must be a boolean')
];

exports.processRefund = [
  body('paymentId') 
    .notEmpty()
    .withMessage('Payment ID is required'),

  body('amount')
    .notEmpty() 
    .withMessage('Refund amount is required')
    .isFloat({ min: 0 })
    .withMessage('Refund amount must be a positive number'),

  body('reason') 
    .notEmpty()
    .withMessage('Refund reason is required')
    .trim()
];

exports.createPaymentPlan = [
  body('orderId')
    .notEmpty() 
    .withMessage('Order ID is required'),

  body('numberOfInstallments')
    .notEmpty()
    .withMessage('Number of installments is required')   
    .isInt({ min: 2 })
    .withMessage('Number of installments must be at least 2'), 

  body('frequency') 
    .notEmpty()
    .withMessage('Frequency is required')
    .isIn(['weekly', 'biweekly', 'monthly']) 
    .withMessage('Invalid frequency')
];

exports.purchaseGiftCard = [ 
  body('amount')
    .notEmpty()
    .withMessage('Gift card amount is required')
    .isFloat({ min: 0 })
    .withMessage('Gift card amount must be a positive number'),

  body('recipientEmail') 
    .notEmpty()
    .withMessage('Recipient email is required')
    .isEmail()
    .withMessage('Invalid recipient email'),

  body('message')  
    .optional()
    .trim()
];

exports.redeemGiftCard = [
  body('code')
    .notEmpty()
    .withMessage('Gift card code is required') 
    .trim()
];

exports.setupLayaway = [
  body('orderId')
    .notEmpty()   
    .withMessage('Order ID is required'),

  body('downPayment') 
    .notEmpty()
    .withMessage('Down payment is required')
    .isFloat({ min: 0 }) 
    .withMessage('Down payment must be a positive number'),

  body('duration')  
    .notEmpty()
    .withMessage('Layaway duration is required')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer')  
];

exports.processLayawayPayment = [
  body('amount')
    .notEmpty()
    .withMessage('Payment amount is required')
    .isFloat({ min: 0 })  
    .withMessage('Payment amount must be a positive number'),

  body('paymentMethodId')   
    .notEmpty()
    .withMessage('Payment method ID is required')
];

exports.updateTransactionStatus = [
  body('status')  
    .notEmpty()
    .withMessage('Transaction status is required')
    .isIn(['pending', 'processing', 'completed', 'failed', 'refunded'])   
    .withMessage('Invalid transaction status')
];

exports.updatePaymentSettings = [
  body('supportedMethods')
    .optional()  
    .isArray()
    .withMessage('Supported methods must be an array'),

  body('minimumAmount')   
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be a positive number'),

  body('maxRefundPeriod')    
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max refund period must be a positive integer')
];