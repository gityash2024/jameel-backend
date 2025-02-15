const nodemailer = require('nodemailer');
const { EMAIL_TEMPLATES } = require('../constants');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

const sendEmail = async (to, subject, template, data) => {
  const emailContent = renderTemplate(template, data);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html: emailContent
  };

  await transporter.sendMail(mailOptions);
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
    default:
      throw new Error('Invalid email template');
  }

  return content;
};

module.exports = {
  sendEmail
};