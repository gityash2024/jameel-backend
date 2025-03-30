/**
 * FedEx API service for shipping and tracking
 */
const axios = require('axios');
const logger = require('../utils/logger');

// FedEx API configuration
const fedexConfig = {
  baseUrl: process.env.FEDEX_API_URL || 'https://apis-sandbox.fedex.com',
  clientId: process.env.FEDEX_CLIENT_ID,
  clientSecret: process.env.FEDEX_CLIENT_SECRET,
  accountNumber: process.env.FEDEX_ACCOUNT_NUMBER
};

// FedEx API authentication token
let authToken = null;
let tokenExpiry = null;

/**
 * Authenticate with FedEx API and get access token
 * @returns {Promise<string>} Access token
 */
const authenticate = async () => {
  try {
    // Check if we already have a valid token
    if (authToken && tokenExpiry && new Date() < tokenExpiry) {
      return authToken;
    }

    logger.info('Authenticating with FedEx API');
    
    const response = await axios.post(
      `${fedexConfig.baseUrl}/oauth/token`,
      {
        grant_type: 'client_credentials',
        client_id: fedexConfig.clientId,
        client_secret: fedexConfig.clientSecret
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.data && response.data.access_token) {
      authToken = response.data.access_token;
      // Set token expiry (usually 3600 seconds/1 hour)
      tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      return authToken;
    } else {
      throw new Error('Failed to get FedEx auth token');
    }
  } catch (error) {
    logger.error('FedEx authentication error', error);
    throw error;
  }
};

/**
 * Create a FedEx shipment
 * @param {Object} shipmentData - Shipment details
 * @returns {Promise<Object>} Shipment creation response
 */
exports.createShipment = async (shipmentData) => {
  try {
    const token = await authenticate();
    
    logger.info('Creating FedEx shipment', { 
      recipient: shipmentData.recipientName,
      service: shipmentData.serviceType
    });

    const requestBody = {
      requestedShipment: {
        shipper: {
          contact: {
            personName: shipmentData.senderName,
            phoneNumber: shipmentData.senderPhone,
            emailAddress: shipmentData.senderEmail
          },
          address: {
            streetLines: [
              shipmentData.senderAddress1,
              shipmentData.senderAddress2
            ],
            city: shipmentData.senderCity,
            stateOrProvinceCode: shipmentData.senderState,
            postalCode: shipmentData.senderPostalCode,
            countryCode: shipmentData.senderCountry
          }
        },
        recipients: [
          {
            contact: {
              personName: shipmentData.recipientName,
              phoneNumber: shipmentData.recipientPhone,
              emailAddress: shipmentData.recipientEmail
            },
            address: {
              streetLines: [
                shipmentData.recipientAddress1,
                shipmentData.recipientAddress2
              ],
              city: shipmentData.recipientCity,
              stateOrProvinceCode: shipmentData.recipientState,
              postalCode: shipmentData.recipientPostalCode,
              countryCode: shipmentData.recipientCountry
            }
          }
        ],
        shipDatestamp: new Date().toISOString().split('T')[0],
        serviceType: shipmentData.serviceType || 'STANDARD_OVERNIGHT',
        packagingType: shipmentData.packagingType || 'YOUR_PACKAGING',
        pickupType: 'USE_SCHEDULED_PICKUP',
        requestedPackageLineItems: [
          {
            weight: {
              units: 'LB',
              value: shipmentData.weight || 1
            },
            dimensions: {
              length: shipmentData.length || 10,
              width: shipmentData.width || 10,
              height: shipmentData.height || 10,
              units: 'IN'
            }
          }
        ],
        labelSpecification: {
          labelStockType: 'PAPER_85X11_TOP_HALF_LABEL',
          imageType: 'PDF',
          labelOrder: 'SHIPPING_LABEL_FIRST'
        }
      }
    };

    const response = await axios.post(
      `${fedexConfig.baseUrl}/ship/v1/shipments`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error('FedEx shipment creation error', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Track a FedEx shipment
 * @param {string} trackingNumber - FedEx tracking number
 * @returns {Promise<Object>} Tracking details
 */
exports.trackPackage = async (trackingNumber) => {
  try {
    const token = await authenticate();
    
    logger.info('Tracking FedEx shipment', { trackingNumber });
    
    const requestBody = {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber
          }
        }
      ]
    };

    const response = await axios.post(
      `${fedexConfig.baseUrl}/track/v1/trackingnumbers`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error('FedEx tracking error', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Cancel a FedEx shipment
 * @param {string} trackingNumber - FedEx tracking number
 * @returns {Promise<Object>} Cancellation status
 */
exports.cancelShipment = async (trackingNumber) => {
  try {
    const token = await authenticate();
    
    logger.info('Cancelling FedEx shipment', { trackingNumber });
    
    const requestBody = {
      trackingNumber
    };

    const response = await axios.put(
      `${fedexConfig.baseUrl}/ship/v1/shipments/cancel`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error('FedEx shipment cancellation error', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Generate a shipping label URL
 * @param {string} labelContent - Base64 encoded label content
 * @returns {string} URL to the label
 */
exports.getLabelUrl = (labelContent) => {
  // In a real implementation, you might save this to a file storage service
  // For this example, we'll assume the base64 content is directly usable
  return labelContent;
};

/**
 * Get delivery options for a shipment
 * @param {Object} addressData - Shipping address details
 * @returns {Promise<Array>} Available delivery options
 */
exports.getDeliveryOptions = async (addressData) => {
  try {
    const token = await authenticate();
    
    logger.info('Getting FedEx delivery options', { 
      postalCode: addressData.postalCode,
      countryCode: addressData.countryCode
    });
    
    const requestBody = {
      accountNumber: {
        value: fedexConfig.accountNumber
      },
      requestedShipment: {
        shipper: {
          address: {
            postalCode: addressData.originPostalCode,
            countryCode: addressData.originCountryCode
          }
        },
        recipient: {
          address: {
            postalCode: addressData.postalCode,
            countryCode: addressData.countryCode
          }
        },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        requestedPackageLineItems: [
          {
            weight: {
              units: "LB",
              value: addressData.weight || 1
            }
          }
        ]
      }
    };

    const response = await axios.post(
      `${fedexConfig.baseUrl}/rate/v1/rates/quotes`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Format the response to extract just the services and delivery times
    const options = response.data.output.rateReplyDetails.map(rate => ({
      serviceType: rate.serviceType,
      serviceName: getServiceName(rate.serviceType),
      transitTime: rate.commitDetails[0]?.transitTime || 'UNKNOWN',
      deliveryDate: rate.commitDetails[0]?.commitTimestamp,
      rateAmount: rate.ratedShipmentDetails[0]?.totalNetCharge,
      currency: rate.ratedShipmentDetails[0]?.currency
    }));

    return options;
  } catch (error) {
    logger.error('FedEx delivery options error', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get a human-readable service name from the FedEx service code
 * @param {string} serviceType - FedEx service type code
 * @returns {string} Human-readable service name
 */
const getServiceName = (serviceType) => {
  const serviceNames = {
    'STANDARD_OVERNIGHT': 'FedEx Standard Overnight',
    'PRIORITY_OVERNIGHT': 'FedEx Priority Overnight',
    'FEDEX_GROUND': 'FedEx Ground',
    'FEDEX_EXPRESS_SAVER': 'FedEx Express Saver',
    'FEDEX_2_DAY': 'FedEx 2Day',
    'FEDEX_2_DAY_AM': 'FedEx 2Day AM',
    'FIRST_OVERNIGHT': 'FedEx First Overnight',
    'INTERNATIONAL_ECONOMY': 'FedEx International Economy',
    'INTERNATIONAL_PRIORITY': 'FedEx International Priority',
    'FEDEX_FREIGHT_ECONOMY': 'FedEx Freight Economy',
    'FEDEX_FREIGHT_PRIORITY': 'FedEx Freight Priority'
  };
  
  return serviceNames[serviceType] || serviceType;
}; 