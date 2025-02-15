// src/config/payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('./logging');

class PaymentService {
  constructor() {
    this.stripe = stripe;
  }

  // Create payment intent
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true
        }
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Payment intent creation error:', error);
      throw new Error('Payment intent creation failed');
    }
  }

  // Confirm payment intent
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Payment confirmation error:', error);
      throw new Error('Payment confirmation failed');
    }
  }

  // Create customer
  async createCustomer(userData) {
    try {
      const customer = await this.stripe.customers.create({
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
        metadata: {
          userId: userData._id.toString()
        }
      });

      return customer;
    } catch (error) {
      logger.error('Customer creation error:', error);
      throw new Error('Customer creation failed');
    }
  }

  // Add payment method to customer
  async addPaymentMethod(customerId, paymentMethodId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: customerId }
      );

      return paymentMethod;
    } catch (error) {
      logger.error('Payment method addition error:', error);
      throw new Error('Payment method addition failed');
    }
  }

  // Process refund
  async processRefund(paymentIntentId, amount = null) {
    try {
      const refundParams = {
        payment_intent: paymentIntentId
      };

      if (amount) {
        refundParams.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundParams);
      return refund;
    } catch (error) {
      logger.error('Refund processing error:', error);
      throw new Error('Refund processing failed');
    }
  }

  // Create subscription
  async createSubscription(customerId, priceId) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });

      return subscription;
    } catch (error) {
      logger.error('Subscription creation error:', error);
      throw new Error('Subscription creation failed');
    }
  }

  // Handle webhook events
  async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;

        case 'charge.refunded':
          await this.handleRefund(event.data.object);
          break;

        // Add more event handlers as needed
      }
    } catch (error) {
      logger.error('Webhook handling error:', error);
      throw new Error('Webhook handling failed');
    }
  }

  // Payment success handler
  async handlePaymentSuccess(paymentIntent) {
    // Implement payment success logic
    logger.info(`Payment succeeded: ${paymentIntent.id}`);
  }

  // Payment failure handler
  async handlePaymentFailure(paymentIntent) {
    // Implement payment failure logic
    logger.error(`Payment failed: ${paymentIntent.id}`);
  }

  // Refund handler
  async handleRefund(charge) {
    // Implement refund logic
    logger.info(`Refund processed: ${charge.id}`);
  }

  // Create payment session for checkout
  async createCheckoutSession(items, customerId, metadata = {}) {
    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: items.map(item => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              images: item.images
            },
            unit_amount: Math.round(item.price * 100)
          },
          quantity: item.quantity
        })),
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel`,
        metadata
      });

      return session;
    } catch (error) {
      logger.error('Checkout session creation error:', error);
      throw new Error('Checkout session creation failed');
    }
  }
}

module.exports = new PaymentService();