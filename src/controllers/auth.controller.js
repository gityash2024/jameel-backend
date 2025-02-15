// src/controllers/auth.controller.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Token = require('../models/token.model');
const AppError = require('../utils/appError');
const { sendEmail } = require('../services/email.service');
const { sendSms } = require('../services/sms.service');
const { catchAsync } = require('../utils/appError');


// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Create and send tokens
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const refreshToken = crypto.randomBytes(32).toString('hex');

  // Save refresh token
  const tokenDoc = new Token({
    user: user._id,
    token: refreshToken,
    type: 'refresh_token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  tokenDoc.save();

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    refreshToken,
    data: {
      user
    }
  });
};

exports.register = catchAsync(async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    password,
    role: 'customer' // Default role
  });

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  await Token.create({
    user: user._id,
    token: verificationToken,
    type: 'email_verification',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });

  // Send welcome email with verification link
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
  await sendEmail(user.email, 'Welcome to JSK Jewelry', 'welcome', {
    firstName: user.firstName,
    verificationUrl
  });

  // Send verification SMS
  if (user.phone) {
    await sendSms(user.phone, 'Welcome to JSK Jewelry! Please verify your email to complete registration.');
  }

  createSendToken(user, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // Check if user exists && password is correct
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // Check if user is active
  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated', 401));
  }

  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res);
});

exports.logout = catchAsync(async (req, res) => {
  // Invalidate refresh token
  await Token.findOneAndUpdate(
    { user: req.user._id, type: 'refresh_token' },
    { isUsed: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Please provide refresh token', 400));
  }

  // Verify refresh token
  const tokenDoc = await Token.findOne({
    token: refreshToken,
    type: 'refresh_token',
    isUsed: false,
    expiresAt: { $gt: Date.now() }
  });

  if (!tokenDoc) {
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  // Get user
  const user = await User.findById(tokenDoc.user);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Generate new tokens
  createSendToken(user, 200, res);

  // Mark old refresh token as used
  tokenDoc.isUsed = true;
  await tokenDoc.save();
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Get user based on email
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  if (!user) {
    return next(new AppError('No user found with that email address', 404));
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  await Token.create({
    user: user._id,
    token: resetToken,
    type: 'password_reset',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  });

  // Send reset email
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
  try {
    await sendEmail(user.email, 'Password Reset Request', 'password-reset', {
      firstName: user.firstName,
      resetUrl,
      validityPeriod: '1 hour'
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset link sent to email'
    });
  } catch (err) {
    await Token.findOneAndDelete({ token: resetToken });
    return next(new AppError('Error sending password reset email. Please try again later.', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token, password } = req.body;

  // Verify token
  const resetToken = await Token.findOne({
    token,
    type: 'password_reset',
    isUsed: false,
    expiresAt: { $gt: Date.now() }
  });

  if (!resetToken) {
    return next(new AppError('Invalid or expired reset token', 400));
  }

  // Get user
  const user = await User.findById(resetToken.user);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Update password
  user.password = password;
  user.passwordChangedAt = Date.now();
  await user.save();

  // Mark token as used
  resetToken.isUsed = true;
  await resetToken.save();

  // Send confirmation email
  await sendEmail(user.email, 'Password Changed Successfully', 'password-changed', {
    firstName: user.firstName
  });

  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect', 401));
  }

  // Update password
  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  // Send confirmation email
  await sendEmail(user.email, 'Password Changed Successfully', 'password-changed', {
    firstName: user.firstName
  });

  createSendToken(user, 200, res);
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  // Verify token
  const verificationToken = await Token.findOne({
    token,
    type: 'email_verification',
    isUsed: false,
    expiresAt: { $gt: Date.now() }
  });

  if (!verificationToken) {
    return next(new AppError('Invalid or expired verification token', 400));
  }

  // Update user
  const user = await User.findById(verificationToken.user);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  // Mark token as used
  verificationToken.isUsed = true;
  await verificationToken.save();

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully'
  });
});

exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

exports.updateDetails = catchAsync(async (req, res) => {
  const { firstName, lastName, phone } = req.body;

  // Update user
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      firstName,
      lastName,
      phone
    },
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Admin Routes

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find().select('+lastLogin');

  res.status(200).json({
    status: 'success',
    data: {
      users
    }
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+lastLogin');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const { isActive, role } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      isActive,
      role
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Instead of actually deleting, deactivate the user
  user.isActive = false;
  await user.save({ validateBeforeSave: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});