const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PAYMENT_STATUS } = require('../constants');

const createPaymentIntent = async (amount, currency, metadata = {}) => {
  // Create basic payment intent without requiring payment_method
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    metadata: metadata,
    payment_method_types: ['card']
  });

  return paymentIntent;
};

const confirmPayment = async (paymentIntentId) => {
  const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
  return paymentIntent;
};

const createRefund = async (paymentId, amount, reason) => {
  const refund = await stripe.refunds.create({
    payment_intent: paymentId,
    amount,
    reason
  });

  return refund;
};

const createCustomer = async (name, email) => {
  const customer = await stripe.customers.create({
    name,
    email
  });

  return customer;
};

const attachPaymentMethod = async (customerId, paymentMethodId) => {
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
};

const detachPaymentMethod = async (paymentMethodId) => {
  await stripe.paymentMethods.detach(paymentMethodId);
};

const getPaymentStatus = (status) => {
  switch (status) {
    case 'succeeded':
      return PAYMENT_STATUS.COMPLETED;
    case 'processing':
      return PAYMENT_STATUS.PROCESSING;
    case 'requires_action':
    case 'requires_payment_method':
      return PAYMENT_STATUS.FAILED;
    default:
      return PAYMENT_STATUS.PENDING;
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  createRefund,
  createCustomer,
  attachPaymentMethod,
  detachPaymentMethod,
  getPaymentStatus
};