// src/constants/index.js
exports.STATUS_CODES = {
    SUCCESS: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  };
  
  exports.ORDER_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned',
    REFUNDED: 'refunded'
  };
  
  exports.PAYMENT_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  };
  
  exports.PAYMENT_METHODS = {
    CREDIT_CARD: 'credit_card',
    DEBIT_CARD: 'debit_card',
    PAYPAL: 'paypal',
    STRIPE: 'stripe',
    CASH_ON_DELIVERY: 'cash_on_delivery',
    BANK_TRANSFER: 'bank_transfer'
  };
  
  exports.USER_ROLES = {
    ADMIN: 'admin',
    STAFF: 'staff',
    CUSTOMER: 'customer'
  };
  
  exports.REVIEW_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SPAM: 'spam'
  };
  
  exports.APPOINTMENT_STATUS = {
    SCHEDULED: 'scheduled',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show'
  };
  
  exports.FILE_TYPES = {
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    SPREADSHEET: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  };
  
  exports.FILE_SIZE_LIMITS = {
    PROFILE_PHOTO: 2 * 1024 * 1024, // 2MB
    PRODUCT_IMAGE: 5 * 1024 * 1024, // 5MB
    DOCUMENT: 10 * 1024 * 1024 // 10MB
  };
  
  exports.CACHE_KEYS = {
    PRODUCTS: 'products',
    CATEGORIES: 'categories',
    SETTINGS: 'settings',
    USER_PERMISSIONS: 'user_permissions'
  };
  
  exports.CACHE_TTL = {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 3600, // 1 hour
    DAY: 86400 // 24 hours
  };
  
  exports.NOTIFICATION_TYPES = {
    ORDER: 'order',
    APPOINTMENT: 'appointment',
    PROMOTION: 'promotion',
    SYSTEM: 'system',
    PAYMENT: 'payment'
  };
  
  exports.SMS_TEMPLATES = {
    ORDER_CONFIRMATION: 'order_confirmation',
    APPOINTMENT_REMINDER: 'appointment_reminder',
    PASSWORD_RESET: 'password_reset',
    VERIFICATION_CODE: 'verification_code'
  };
  
  exports.EMAIL_TEMPLATES = {
    WELCOME: 'welcome',
    ORDER_CONFIRMATION: 'order_confirmation',
    PASSWORD_RESET: 'password_reset',
    APPOINTMENT_CONFIRMATION: 'appointment_confirmation',
    SHIPPING_CONFIRMATION: 'shipping_confirmation'
  };
  
  exports.SHIPPING_METHODS = {
    STANDARD: 'standard',
    EXPRESS: 'express',
    OVERNIGHT: 'overnight',
    INTERNATIONAL: 'international'
  };
  
  exports.INVENTORY_STATUS = {
    IN_STOCK: 'in_stock',
    OUT_OF_STOCK: 'out_of_stock',
    LOW_STOCK: 'low_stock',
    DISCONTINUED: 'discontinued'
  };
  
  exports.VALIDATION_MESSAGES = {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PHONE: 'Please enter a valid phone number',
    INVALID_PASSWORD: 'Password must be at least 8 characters long and contain uppercase, lowercase, number and special character',
    PASSWORDS_NOT_MATCH: 'Passwords do not match',
    INVALID_DATE: 'Please enter a valid date',
    INVALID_PRICE: 'Price must be a positive number',
    INVALID_QUANTITY: 'Quantity must be a positive integer'
  };
  
  exports.JWT_CONFIG = {
    ACCESS_TOKEN_EXPIRES: '15m',
    REFRESH_TOKEN_EXPIRES: '7d',
    RESET_TOKEN_EXPIRES: '1h'
  };