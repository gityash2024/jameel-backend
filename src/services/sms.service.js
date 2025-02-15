const { SMS_TEMPLATES } = require('../constants');
const { sendSms } = require('../../config/sms');

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
      throw new Error('Invalid SMS template');
  }

  await sendSms(to, body);
};

module.exports = {
  sendOrderSms,
  sendAppointmentReminder,
  sendPasswordResetSms,
  sendVerificationCode,
  sendSmsTemplate
};