/**
 * FedEx API configuration
 */
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // API Credentials
  clientId: process.env.FEDEX_CLIENT_ID || 'your_fedex_client_id',
  clientSecret: process.env.FEDEX_CLIENT_SECRET || 'your_fedex_client_secret',
  accountNumber: process.env.FEDEX_ACCOUNT_NUMBER || 'your_fedex_account_number',
  
  // API URLs
  baseUrl: process.env.FEDEX_API_URL || 'https://apis-sandbox.fedex.com', // Use sandbox for development
  
  // Default shipping settings
  defaultShippingOptions: {
    serviceType: 'FEDEX_GROUND', // FEDEX_GROUND, PRIORITY_OVERNIGHT, etc.
    packagingType: 'YOUR_PACKAGING', // YOUR_PACKAGING, FEDEX_BOX, FEDEX_ENVELOPE, etc.
    dropoffType: 'REGULAR_PICKUP' // REGULAR_PICKUP, REQUEST_COURIER, DROP_BOX, etc.
  },
  
  // Store address (origin for shipments)
  storeAddress: {
    name: process.env.STORE_NAME || 'JSK Jewelry',
    address1: process.env.STORE_ADDRESS1 || '123 Main Street',
    address2: process.env.STORE_ADDRESS2 || 'Suite 100',
    city: process.env.STORE_CITY || 'New York',
    state: process.env.STORE_STATE || 'NY',
    postalCode: process.env.STORE_POSTAL_CODE || '10001',
    country: process.env.STORE_COUNTRY || 'US',
    phone: process.env.STORE_PHONE || '212-555-1234',
    email: process.env.STORE_EMAIL || 'shipping@jskelite.com'
  },
  
  // Tracking URL base
  trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr='
}; 