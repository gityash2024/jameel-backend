const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Token = require('../models/token.model');
const Role = require('../models/roles.model'); // Fix: Correct model name
const { AppError, catchAsync } = require('../utils/appError'); // Fix: Import AppError as named import
const { sendEmail } = require('../services/email.service');
const { sendSms } = require('../services/sms.service');

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

// In auth.controller.js - update login function
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // Update this line to populate role
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password')
    .populate('role');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated', 401));
  }

  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res);
});

// Update register function
exports.register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, phone, password, role = 'customer' } = req.body;
console.log(req.body,Role?.find())
  const roleDoc = await Role.findOne({ name: role });
  if (!roleDoc) {
    return next(new AppError('Invalid role specified', 400));
  }

  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    password,
    role: roleDoc._id
  });

  // Populate role before sending response
  const populatedUser = await User.findById(user._id).populate('role');

  createSendToken(populatedUser, 201, res);
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

  // Log the user in
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

// Google OAuth2 login/signup
exports.googleAuth = catchAsync(async (req, res, next) => {
  const { credential } = req.body;
  
  if (!credential) {
    return next(new AppError('No Google credential provided', 400));
  }

  try {
    // Verify the token with Google
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    
    // Extract user information from payload
    const { email, given_name, family_name, picture, sub } = payload;

    // Check if user already exists
    let user = await User.findOne({ email }).populate('role');
    
    if (!user) {
      // If user doesn't exist, create a new user
      const customerRole = await Role.findOne({ name: 'customer' });
      
      if (!customerRole) {
        return next(new AppError('Customer role not found', 500));
      }
      
      user = await User.create({
        firstName: given_name,
        lastName: family_name,
        email,
        password: crypto.randomBytes(20).toString('hex'), // Generate a random password
        googleId: sub,
        profileImage: picture,
        role: customerRole._id,
        isVerified: true // Automatically verify Google users
      });
      
      user = await User.findById(user._id).populate('role');
    } else if (!user.googleId) {
      // If user exists but doesn't have a Google ID, update the user
      user.googleId = sub;
      user.profileImage = user.profileImage || picture;
      user.isVerified = true;
      await user.save({ validateBeforeSave: false });
    }
    
    // Log the user in
    createSendToken(user, 200, res);
  } catch (error) {
    console.error('Google auth error:', error);
    return next(new AppError('Failed to authenticate with Google', 400));
  }
});