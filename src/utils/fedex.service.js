const axios = require('axios');
const logger = require('./logger');

class FedExService {
  constructor() {
    this.apiUrl = process.env.FEDEX_API_URL || 'https://apis-sandbox.fedex.com';
    this.clientId = process.env.FEDEX_CLIENT_ID || '';
    this.clientSecret = process.env.FEDEX_CLIENT_SECRET || '';
    this.accountNumber = process.env.FEDEX_ACCOUNT_NUMBER || '';
    this.token = null;
    this.tokenExpiry = null;
  }

  async getToken() {
    try {
      // If token exists and is not expired, return it
      if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.token;
      }

      logger.info('Requesting new FedEx authentication token');
      
      const response = await axios.post(
        `${this.apiUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.token = response.data.access_token;
      
      // Set token expiry time (subtract 5 minutes for safety)
      const expiresIn = response.data.expires_in;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
      
      logger.info('FedEx token obtained successfully');
      return this.token;
    } catch (error) {
      logger.error('Error obtaining FedEx token:', error.message);
      throw new Error('Failed to authenticate with FedEx API');
    }
  }

  async getRates(shipment) {
    try {
      const token = await this.getToken();
      
      logger.info('Requesting shipping rates from FedEx');
      
      const response = await axios.post(
        `${this.apiUrl}/rate/v1/rates/quotes`,
        {
          accountNumber: {
            value: this.accountNumber
          },
          requestedShipment: {
            shipper: {
              address: {
                streetLines: [
                  process.env.STORE_ADDRESS_LINE1,
                  process.env.STORE_ADDRESS_LINE2 || ''
                ].filter(Boolean),
                city: process.env.STORE_CITY,
                stateOrProvinceCode: process.env.STORE_STATE,
                postalCode: process.env.STORE_POSTAL_CODE,
                countryCode: process.env.STORE_COUNTRY || 'US'
              }
            },
            recipients: [
              {
                address: {
                  streetLines: [
                    shipment.address.street,
                    shipment.address.apartment || ''
                  ].filter(Boolean),
                  city: shipment.address.city,
                  stateOrProvinceCode: shipment.address.state,
                  postalCode: shipment.address.postalCode,
                  countryCode: shipment.address.country || 'US'
                }
              }
            ],
            packagingType: 'YOUR_PACKAGING',
            rateRequestType: ['LIST', 'ACCOUNT'],
            requestedPackageLineItems: shipment.items.map((item, index) => ({
              groupPackageCount: 1,
              weight: {
                units: 'LB',
                value: item.weight || 1
              },
              dimensions: {
                length: item.dimensions?.length || 10,
                width: item.dimensions?.width || 10,
                height: item.dimensions?.height || 5,
                units: 'IN'
              },
              sequenceNumber: index + 1
            }))
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info('FedEx rates obtained successfully');
      return response.data;
    } catch (error) {
      logger.error('Error getting FedEx rates:', error.message);
      throw new Error('Failed to get shipping rates from FedEx');
    }
  }

  async createShipment(orderData) {
    try {
      const token = await this.getToken();
      
      logger.info('Creating shipment with FedEx');
      
      // Build shipment request based on order data
      const shipmentRequest = {
        requestedShipment: {
          shipper: {
            contact: {
              personName: process.env.STORE_NAME,
              phoneNumber: process.env.STORE_PHONE,
              emailAddress: process.env.STORE_EMAIL
            },
            address: {
              streetLines: [
                process.env.STORE_ADDRESS_LINE1,
                process.env.STORE_ADDRESS_LINE2 || ''
              ].filter(Boolean),
              city: process.env.STORE_CITY,
              stateOrProvinceCode: process.env.STORE_STATE,
              postalCode: process.env.STORE_POSTAL_CODE,
              countryCode: process.env.STORE_COUNTRY || 'US'
            }
          },
          recipients: [
            {
              contact: {
                personName: `${orderData.shippingAddress.firstName} ${orderData.shippingAddress.lastName}`,
                phoneNumber: orderData.shippingAddress.phone,
                emailAddress: orderData.email
              },
              address: {
                streetLines: [
                  orderData.shippingAddress.street,
                  orderData.shippingAddress.apartment || ''
                ].filter(Boolean),
                city: orderData.shippingAddress.city,
                stateOrProvinceCode: orderData.shippingAddress.state,
                postalCode: orderData.shippingAddress.postalCode,
                countryCode: orderData.shippingAddress.country || 'US'
              }
            }
          ],
          shipDatestamp: new Date().toISOString().split('T')[0],
          serviceType: orderData.shipping.serviceType || 'STANDARD_OVERNIGHT',
          packagingType: 'YOUR_PACKAGING',
          pickupType: 'USE_SCHEDULED_PICKUP',
          blockInsightVisibility: false,
          shippingChargesPayment: {
            paymentType: 'SENDER',
            payor: {
              responsibleParty: {
                accountNumber: {
                  value: this.accountNumber
                }
              }
            }
          },
          labelSpecification: {
            labelStockType: 'PAPER_85X11_TOP_HALF_LABEL',
            imageType: 'PDF',
            labelOrder: 'SHIPPING_LABEL_FIRST'
          },
          requestedPackageLineItems: orderData.items.map((item, index) => ({
            weight: {
              units: 'LB',
              value: item.product.weight?.value || 1
            },
            dimensions: {
              length: item.product.dimensions?.length || 10,
              width: item.product.dimensions?.width || 10,
              height: item.product.dimensions?.height || 5,
              units: 'IN'
            },
            customerReferences: [
              {
                customerReferenceType: 'CUSTOMER_REFERENCE',
                value: orderData.orderNumber
              }
            ],
            sequenceNumber: index + 1
          }))
        },
        accountNumber: {
          value: this.accountNumber
        },
        labelResponseOptions: 'URL_ONLY'
      };
      
      const response = await axios.post(
        `${this.apiUrl}/ship/v1/shipments`,
        shipmentRequest,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info('FedEx shipment created successfully');
      
      // Extract tracking number and other shipment details
      const completedShipment = response.data.output.completedShipmentDetail;
      
      const trackingInfo = {
        trackingNumber: completedShipment.masterTrackingId.trackingNumber,
        serviceType: orderData.shipping.serviceType,
        packageCount: completedShipment.packageCount,
        shipmentDate: new Date(),
        estimatedDeliveryDate: null, // FedEx API doesn't always return this directly
        labelUrl: completedShipment.completedPackageDetails[0].labelDocuments[0].url,
        shipmentId: completedShipment.shipmentId
      };
      
      return trackingInfo;
    } catch (error) {
      logger.error('Error creating FedEx shipment:', error.message);
      throw new Error('Failed to create shipment with FedEx');
    }
  }

  async trackShipment(trackingNumber) {
    try {
      const token = await this.getToken();
      
      logger.info(`Tracking FedEx shipment: ${trackingNumber}`);
      
      const response = await axios.post(
        `${this.apiUrl}/track/v1/trackingnumbers`,
        {
          includeDetailedScans: true,
          trackingInfo: [
            {
              trackingNumberInfo: {
                trackingNumber: trackingNumber
              }
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info('FedEx tracking info obtained successfully');
      
      // If the response has tracking details, parse them
      if (response.data?.output?.completeTrackResults?.[0]?.trackResults?.[0]) {
        const trackResult = response.data.output.completeTrackResults[0].trackResults[0];
        
        // Extract tracking events
        const events = trackResult.scanEvents?.map(event => ({
          timestamp: event.date,
          description: event.eventDescription,
          location: event.scanLocation?.city 
            ? `${event.scanLocation.city}, ${event.scanLocation.stateOrProvinceCode}, ${event.scanLocation.countryCode}`
            : 'Location not available',
          status: event.derivedStatus
        })) || [];
        
        // Get overall status
        const status = trackResult.latestStatusDetail?.description || 'Status not available';
        const deliveryDate = trackResult.estDeliveryDetail?.estimatedDeliveryTimestamp || null;
        
        return {
          trackingNumber,
          status,
          estimatedDeliveryDate: deliveryDate,
          events: events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), // Most recent first
          carrier: 'FedEx',
          serviceType: trackResult.serviceDetail?.description || 'Standard',
          receivedBy: trackResult.deliveryDetails?.receivedByName || null,
          shipDate: trackResult.shipTimestamp || null
        };
      } else {
        throw new Error('No tracking information available');
      }
    } catch (error) {
      logger.error('Error tracking FedEx shipment:', error.message);
      throw new Error(`Failed to track FedEx shipment: ${error.message}`);
    }
  }

  // Method to cancel a shipment
  async cancelShipment(shipmentId) {
    try {
      const token = await this.getToken();
      
      logger.info(`Canceling FedEx shipment: ${shipmentId}`);
      
      const response = await axios.put(
        `${this.apiUrl}/ship/v1/shipments/${shipmentId}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info('FedEx shipment canceled successfully');
      return response.data;
    } catch (error) {
      logger.error('Error canceling FedEx shipment:', error.message);
      throw new Error('Failed to cancel shipment with FedEx');
    }
  }
}

module.exports = new FedExService(); 