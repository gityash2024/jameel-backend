/**
 * Email service utility for order-related notifications
 */
const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send order confirmation email
 * @param {string} to - Recipient email address
 * @param {Object} data - Order data for email template
 * @returns {Promise<Object>} Email send result
 */
const sendOrderConfirmationEmail = async (to, data) => {
  try {
    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"${process.env.STORE_NAME || 'JSK Jewelry'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: `Order Confirmation #${data.orderNumber}`,
      html: getOrderConfirmationTemplate(data),
    });

    console.log(`Order confirmation email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    // Don't throw so we don't break order flow
    return null;
  }
};

/**
 * Send shipping notification email
 * @param {string} to - Recipient email address
 * @param {Object} data - Shipping data for email template
 * @returns {Promise<Object>} Email send result
 */
const sendShippingNotification = async (to, data) => {
  try {
    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"${process.env.STORE_NAME || 'JSK Jewelry'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: `Your Order #${data.orderNumber} Has Shipped`,
      html: getShippingNotificationTemplate(data),
    });

    console.log(`Shipping notification email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending shipping notification email:', error);
    // Don't throw so we don't break shipping flow
    return null;
  }
};

/**
 * Order confirmation email template
 */
const getOrderConfirmationTemplate = (data) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #000; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0;">Order Confirmation</h1>
      </div>
      <div style="padding: 20px;">
        <p>Thank you for your order with JSK Jewelry!</p>
        <p>Your order #${data.orderNumber} has been received and is being processed.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
          <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Order Total:</strong> $${data.total?.toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${data.paymentMethod?.replace('_', ' ')}</p>
        </div>
        
        <p>You will receive another notification when your order ships.</p>
        <p>If you have any questions, please contact our customer service.</p>
        
        <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} JSK Jewelry. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
};

/**
 * Shipping notification email template
 */
const getShippingNotificationTemplate = (data) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #000; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0;">Your Order Has Shipped</h1>
      </div>
      <div style="padding: 20px;">
        <p>Good news! Your JSK Jewelry order #${data.orderNumber} has shipped.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin-top: 0;">Shipping Details</h3>
          <p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
          ${data.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${new Date(data.estimatedDelivery).toLocaleDateString()}</p>` : ''}
          
          <p style="margin-top: 15px;">
            <a href="${data.trackingUrl}" style="background-color: #000; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 3px;">
              Track Your Package
            </a>
          </p>
        </div>
        
        <p>Thank you for shopping with JSK Jewelry!</p>
        
        <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} JSK Jewelry. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
};

module.exports = {
  sendOrderConfirmationEmail,
  sendShippingNotification
}; 