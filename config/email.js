// src/config/email.js
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const logger = require('./logging');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Register handlebars helpers
    handlebars.registerHelper('formatDate', function(date) {
      return new Date(date).toLocaleDateString();
    });

    handlebars.registerHelper('formatPrice', function(price) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(price);
    });
  }

  // Initialize email templates
  async loadTemplate(templateName) {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);
    const template = await fs.readFile(templatePath, 'utf-8');
    return handlebars.compile(template);
  }

  // Send email
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        html: options.html
      };

      if (options.attachments) {
        mailOptions.attachments = options.attachments;
      }

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Email sending error:', error);
      throw new Error('Email sending failed');
    }
  }

  // Welcome email
  async sendWelcomeEmail(user) {
    const template = await this.loadTemplate('welcome');
    const html = template({
      firstName: user.firstName,
      loginUrl: `${process.env.FRONTEND_URL}/login`
    });

    await this.sendEmail({
      to: user.email,
      subject: 'Welcome to JSK Jewelry',
      html
    });
  }

  // Order confirmation
  async sendOrderConfirmation(order, user) {
    const template = await this.loadTemplate('order-confirmation');
    const html = template({
      order,
      user,
      trackingUrl: `${process.env.FRONTEND_URL}/orders/${order._id}`
    });

    await this.sendEmail({
      to: user.email,
      subject: `Order Confirmation #${order.orderNumber}`,
      html
    });
  }

  // Password reset
  async sendPasswordResetEmail(user, resetToken) {
    const template = await this.loadTemplate('password-reset');
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = template({
      firstName: user.firstName,
      resetUrl,
      validityPeriod: '30 minutes'
    });

    await this.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html
    });
  }

  // Appointment confirmation
  async sendAppointmentConfirmation(appointment, user) {
    const template = await this.loadTemplate('appointment-confirmation');
    const html = template({
      appointment,
      user,
      storeName: appointment.store.name,
      appointmentDate: appointment.appointmentDate,
      serviceName: appointment.service.name
    });

    await this.sendEmail({
      to: user.email,
      subject: 'Appointment Confirmation',
      html
    });
  }

  // Shipping confirmation
  async sendShippingConfirmation(order, user, trackingInfo) {
    const template = await this.loadTemplate('shipping-confirmation');
    const html = template({
      order,
      user,
      trackingInfo,
      trackingUrl: trackingInfo.trackingUrl
    });

    await this.sendEmail({
      to: user.email,
      subject: `Your Order #${order.orderNumber} Has Been Shipped`,
      html
    });
  }

  // Order status update
  async sendOrderStatusUpdate(order, user) {
    const template = await this.loadTemplate('order-status-update');
    const html = template({
      order,
      user,
      statusUpdateTime: new Date().toISOString()
    });

    await this.sendEmail({
      to: user.email,
      subject: `Order Status Update - #${order.orderNumber}`,
      html
    });
  }

  // Abandoned cart reminder
  async sendAbandonedCartReminder(user, cart) {
    const template = await this.loadTemplate('abandoned-cart');
    const html = template({
      user,
      cart,
      cartUrl: `${process.env.FRONTEND_URL}/cart`
    });

    await this.sendEmail({
      to: user.email,
      subject: 'Complete Your Purchase',
      html
    });
  }
}

module.exports = new EmailService();