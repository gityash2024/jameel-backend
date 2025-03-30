const axios = require('axios');
const logger = require('./logger');

/**
 * FedEx Service utility for handling shipping operations
 */
class FedExService {
  constructor() {
    this.apiUrl = process.env.FEDEX_API_URL || 'https://apis-sandbox.fedex.com';
    this.clientId = process.env.FEDEX_CLIENT_ID;
    this.clientSecret = process.env.FEDEX_CLIENT_SECRET;
    this.accountNumber = process.env.FEDEX_ACCOUNT_NUMBER;
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Get authentication token from FedEx
   * @returns {Promise<string>} The access token
   */
  async getAuthToken() {
    // Check if we have a valid token
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    try {
      logger.info('Getting FedEx auth token');
      
      const response = await axios.post(
        `${this.apiUrl}/oauth/token`,
        `grant_type=client_credentials&client_id=${this.clientId}&client_secret=${this.clientSecret}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, expires_in } = response.data;
      
      // Set token and expiry (subtract 5 minutes to be safe)
      this.token = access_token;
      this.tokenExpiry = new Date(Date.now() + (expires_in - 300) * 1000);
      
      return access_token;
    } catch (error) {
      logger.error('FedEx Authentication Error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with FedEx API');
    }
  }

  /**
   * Track a shipment by tracking number
   * @param {string} trackingNumber - The FedEx tracking number
   * @returns {Promise<Object>} Tracking details
   */
  async trackShipment(trackingNumber) {
    try {
      const token = await this.getAuthToken();
      
      logger.info(`Tracking FedEx shipment: ${trackingNumber}`);
      
      const response = await axios.post(
        `${this.apiUrl}/track/v1/trackingnumbers`,
        {
          includeDetailedScans: true,
          trackingInfo: [
            {
              trackingNumberInfo: {
                trackingNumber: trackingNumber,
              },
            },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const trackingData = response.data;
      const trackingDetails = trackingData.output.completeTrackResults[0]?.trackResults[0];
      
      if (!trackingDetails) {
        throw new Error('No tracking data found');
      }
      
      // Format the response
      return {
        trackingNumber: trackingNumber,
        status: trackingDetails.latestStatusDetail?.code || 'unknown',
        statusDetails: trackingDetails.latestStatusDetail?.description,
        estimatedDelivery: trackingDetails.dateAndTimes?.find(dt => dt.type === 'ESTIMATED_DELIVERY')?.dateTime,
        lastUpdated: new Date().toISOString(),
        trackingHistory: trackingDetails.scanEvents ? trackingDetails.scanEvents.map(event => ({
          timestamp: event.date,
          status: event.eventType,
          statusDetails: event.eventDescription,
          location: event.scanLocation?.city ? `${event.scanLocation.city}, ${event.scanLocation.stateOrProvinceCode}` : 'Unknown Location',
        })) : [],
      };
    } catch (error) {
      logger.error('FedEx Tracking Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a shipping label
   * @param {Object} shipmentData - Shipment details including addresses and package info
   * @returns {Promise<Object>} Label details including URL and tracking number
   */
  async createShippingLabel(shipmentData) {
    try {
      const token = await this.getAuthToken();
      
      logger.info('Creating FedEx shipping label', { recipient: shipmentData.recipientAddress.firstName });
      
      const {
        senderAddress,
        recipientAddress,
        packageDetails,
        serviceType = 'FEDEX_GROUND',
        labelResponseOptions = 'URL_ONLY',
      } = shipmentData;
      
      const requestBody = {
        labelResponseOptions,
        requestedShipment: {
          shipper: {
            address: {
              streetLines: [
                senderAddress.addressLine1,
                senderAddress.addressLine2 || '',
              ].filter(Boolean),
              city: senderAddress.city,
              stateOrProvinceCode: senderAddress.state,
              postalCode: senderAddress.postalCode,
              countryCode: senderAddress.country,
              residential: false,
            },
            contact: {
              personName: `${senderAddress.firstName} ${senderAddress.lastName}`,
              phoneNumber: senderAddress.phone,
              emailAddress: senderAddress.email,
            },
          },
          recipients: [
            {
              address: {
                streetLines: [
                  recipientAddress.addressLine1,
                  recipientAddress.addressLine2 || '',
                ].filter(Boolean),
                city: recipientAddress.city,
                stateOrProvinceCode: recipientAddress.state,
                postalCode: recipientAddress.postalCode,
                countryCode: recipientAddress.country,
                residential: true,
              },
              contact: {
                personName: `${recipientAddress.firstName} ${recipientAddress.lastName}`,
                phoneNumber: recipientAddress.phone,
                emailAddress: recipientAddress.email,
              },
            },
          ],
          pickupType: 'USE_SCHEDULED_PICKUP',
          serviceType,
          packagingType: 'YOUR_PACKAGING',
          rateRequestType: ['ACCOUNT'],
          preferredCurrency: 'USD',
          totalWeight: packageDetails.weight ? {
            units: 'LB',
            value: packageDetails.weight,
          } : undefined,
          requestedPackageLineItems: [
            {
              weight: packageDetails.weight ? {
                units: 'LB',
                value: packageDetails.weight,
              } : undefined,
              dimensions: packageDetails.dimensions ? {
                length: packageDetails.dimensions.length,
                width: packageDetails.dimensions.width,
                height: packageDetails.dimensions.height,
                units: 'IN',
              } : undefined,
            },
          ],
          shippingChargesPayment: {
            paymentType: 'SENDER',
            payor: {
              responsibleParty: {
                accountNumber: {
                  value: this.accountNumber,
                },
              },
            },
          },
          labelSpecification: {
            labelStockType: 'PAPER_85X11_TOP_HALF_LABEL',
            imageType: 'PDF',
          },
        },
        accountNumber: {
          value: this.accountNumber,
        },
      };
      
      const response = await axios.post(
        `${this.apiUrl}/ship/v1/shipments`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const shipmentData = response.data;
      const completedShipment = shipmentData.output?.completedShipmentDetail;
      
      if (!completedShipment) {
        throw new Error('No shipment data returned');
      }
      
      // Get package details
      const packageDetail = completedShipment.completedPackageDetails[0];
      const trackingNumber = packageDetail.trackingIds[0].trackingNumber;
      
      // Get label details
      const labelDetails = packageDetail.label;
      
      return {
        trackingNumber,
        labelUrl: labelDetails.imageContentOptions === 'URL' ? labelDetails.image : null,
        labelData: labelDetails.imageContentOptions === 'CONTENT' ? labelDetails.image : null,
        shippingCost: completedShipment.shipmentRating?.shipmentRateDetails[0]?.totalNetCharge?.amount,
        currency: completedShipment.shipmentRating?.shipmentRateDetails[0]?.totalNetCharge?.currency,
        serviceType,
        estimatedDeliveryDate: completedShipment.operationalDetail?.deliveryDate,
      };
    } catch (error) {
      logger.error('FedEx Label Creation Error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new FedExService(); 