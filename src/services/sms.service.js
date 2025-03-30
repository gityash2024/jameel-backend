const { SMS_TEMPLATES } = require('../utils/constants');
const { sendSms: twilioSendSms } = require('../../config/sms');

// Check if Twilio credentials are configured
const isTwilioConfigured = () => {
  const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
  return requiredVars.every(key => !!process.env[key]);
};

// Wrapper for sendSms that handles missing credentials
const sendSms = async (to, body) => {
  // Skip if Twilio is not configured, but log a warning
  if (!isTwilioConfigured()) {
    console.warn('[SMS Service] SMS not sent: Twilio credentials not configured');
    console.info(`[SMS Service] Would have sent to ${to}: ${body}`);
    return; // Just return without sending
  }

  try {
    return await twilioSendSms(to, body);
  } catch (error) {
    console.error('[SMS Service] Failed to send SMS:', error);
    // Don't rethrow to prevent application crashes
  }
};

const sendOrderSms = async (to, orderId) => {
  const body = `Your order (${orderId}) has been confirmed. Thank you for your purchase!`;
  await sendSms(to, body);
};

const sendAppointmentReminder = async (to, appointmentId, date, time) => {
  const body = `Reminder: You have an appointment (${appointmentId}) scheduled on ${date} at ${time}.`;
  await sendSms(to, body);
};

const sendPasswordResetSms = async (to, resetToken) => {
  const body = `Your password reset token is: ${resetToken}`;
  await sendSms(to, body);
};

const sendVerificationCode = async (to, code) => {
  const body = `Your verification code is: ${code}`;
  await sendSms(to, body);
};

const sendSmsTemplate = async (to, template, data) => {
  let body = '';

  switch (template) {
    case SMS_TEMPLATES.ORDER_CONFIRMATION:
      body = `Your order (${data.orderId}) has been confirmed. Thank you for your purchase!`;
      break;
    case SMS_TEMPLATES.APPOINTMENT_REMINDER:
      body = `Reminder: You have an appointment (${data.appointmentId}) scheduled on ${data.date} at ${data.time}.`;
      break;
    case SMS_TEMPLATES.PASSWORD_RESET:
      body = `Your password reset token is: ${data.resetToken}`;
      break;
    case SMS_TEMPLATES.VERIFICATION_CODE:
      body = `Your verification code is: ${data.code}`;
      break;
    default:
      console.warn(`[SMS Service] Invalid SMS template: ${template}`);
      body = `Notification from JSK Jewelry.`;
  }

  await sendSms(to, body);
};

module.exports = {
  sendOrderSms,
  sendAppointmentReminder,
  sendPasswordResetSms,
  sendVerificationCode,
  sendSmsTemplate,
  sendSms
};