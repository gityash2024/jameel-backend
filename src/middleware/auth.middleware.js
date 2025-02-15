// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/user.model');
const Token = require('../models/token.model');
const AppError = require('../utils/appError');

exports.authenticate = async (req, res, next) => {
  try {
    // 1) Check if token exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id).select('+password');
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    // 5) Check if token is blacklisted
    const isBlacklisted = await Token.findOne({
      token,
      isRevoked: true
    });

    if (isBlacklisted) {
      return next(new AppError('Invalid token! Please log in again.', 401));
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Authentication failed! Please log in again.', 401));
  }
};

exports.authorize = (...roles) => {
  return async (req, res, next) => {
    try {
      // 1) Get user role
      const user = await User.findById(req.user._id).populate('role');
      
      if (!user || !user.role) {
        return next(new AppError('User role not found', 403));
      }

      // 2) Check if role is allowed
      if (!roles.includes(user.role.name)) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }

      next();
    } catch (error) {
      next(new AppError('Authorization failed', 403));
    }
  };
};

exports.restrictTo = (...permissions) => {
  return async (req, res, next) => {
    try {
      // 1) Get user role and permissions
      const user = await User.findById(req.user._id)
        .populate({
          path: 'role',
          select: 'permissions'
        });

      if (!user || !user.role || !user.role.permissions) {
        return next(new AppError('User permissions not found', 403));
      }

      // 2) Check if user has required permissions
      const hasPermission = permissions.every(permission =>
        user.role.permissions.includes(permission)
      );

      if (!hasPermission) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }

      next();
    } catch (error) {
      next(new AppError('Permission check failed', 403));
    }
  };
};