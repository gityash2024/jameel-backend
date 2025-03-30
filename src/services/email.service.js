const nodemailer = require('nodemailer');
const { EMAIL_TEMPLATES } = require('../utils/constants');

// Check if SMTP credentials are configured
const isSmtpConfigured = () => {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
  return requiredVars.every(key => !!process.env[key]);
};

// Create transporter only if SMTP is configured
let transporter;
if (isSmtpConfigured()) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
}

const sendEmail = async (to, subject, template, data) => {
  // Skip if SMTP is not configured, but log a warning
  if (!isSmtpConfigured()) {
    console.warn('[Email Service] Email not sent: SMTP credentials not configured');
    console.info(`[Email Service] Would have sent "${subject}" to ${to}`);
    return; // Just return without sending the email
  }

  try {
    const emailContent = renderTemplate(template, data);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: emailContent
    };

    await transporter.sendMail(mailOptions);
    console.info(`[Email Service] Email sent successfully to ${to}`);
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    // Don't rethrow the error to prevent breaking the application flow
  }
};

const renderTemplate = (template, data) => {
  let content = '';

  switch (template) {
    case EMAIL_TEMPLATES.WELCOME:
      content = `<h1>Welcome, ${data.name}!</h1>`;
      break;
    case EMAIL_TEMPLATES.ORDER_CONFIRMATION:
      content = `<p>Your order (${data.orderId}) has been confirmed.</p>`;
      break;
    case EMAIL_TEMPLATES.PASSWORD_RESET:
      content = `<p>Click <a href="${data.resetLink}">here</a> to reset your password.</p>`;
      break;
    case EMAIL_TEMPLATES.APPOINTMENT_CONFIRMATION:
      content = `<p>Your appointment on ${data.date} has been confirmed.</p>`;
      break;
    case EMAIL_TEMPLATES.SHIPPING_CONFIRMATION:
      content = `<p>Your order (${data.orderId}) has been shipped.</p>`;
      break;
    case EMAIL_TEMPLATES.CUSTOM_DESIGN_CONFIRMATION:
    case 'custom-design-confirmation': // For backward compatibility
    case 'custom_design_confirmation': // Support both formats
      content = `
        <h1>Custom Design Request Confirmation</h1>
        <p>Hello ${data.appointment?.firstName || 'Valued Customer'},</p>
        <p>Thank you for submitting your custom design request with JSK. We're excited to help bring your vision to life!</p>
        <p>Your appointment is scheduled for ${new Date(data.appointment?.appointmentDate || Date.now()).toLocaleDateString()} at ${data.appointment?.appointmentTime || 'the scheduled time'}.</p>
        <p>We'll be in touch shortly to confirm your appointment and discuss any additional details.</p>
        <p>Best regards,<br>JSK Jewelry Team</p>
      `;
      break;
    default:
      content = `<p>Default email template</p>`;
      console.warn(`No template found for "${template}", using default.`);
  }

  return content;
};

module.exports = {
  sendEmail
};