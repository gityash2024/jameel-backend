const SupportTicket = require('../models/helpcenter.model');
const { AppError, catchAsync } = require('../utils/appError');

// Admin role ID
const ADMIN_ROLE_ID = '67bf1b7090fea6a2df7deade';

// Helper function to check if user is admin
const isUserAdmin = (user) => {
  return (user.role && user.role.name === 'admin') || 
         (user.role && user.role.toString() === ADMIN_ROLE_ID) ||
         (user.role && user.role._id && user.role._id.toString() === ADMIN_ROLE_ID);
};

exports.createSupportTicket = catchAsync(async (req, res, next) => {
  if (!req.body.subject || !req.body.message) {
    return next(new AppError('Subject and message are required', 400));
  }

  const ticketData = {
    user: req.user._id,
    subject: req.body.subject.trim(),
    message: req.body.message.trim(),
    status: 'new'
  };
  
  const supportTicket = await SupportTicket.create(ticketData);
  
  const populatedTicket = await SupportTicket.findById(supportTicket._id).populate({
    path: 'user',
    select: 'firstName lastName email'
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      supportTicket: populatedTicket
    }
  });
});

exports.getAllSupportTickets = catchAsync(async (req, res, next) => {
  let query;
  
  if (isUserAdmin(req.user)) {
    query = SupportTicket.find().populate({
      path: 'user',
      select: 'firstName lastName email'
    });
  } else {
    query = SupportTicket.find({ user: req.user._id });
  }
  
  if (req.query.status) {
    query = query.find({ status: req.query.status });
  }
  
  if (req.query.search) {
    query = query.find({
      $or: [
        { subject: { $regex: req.query.search, $options: 'i' } },
        { message: { $regex: req.query.search, $options: 'i' } }
      ]
    });
  }
  
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  
  const countQuery = SupportTicket.find(query.getQuery());
  const totalCount = await countQuery.countDocuments();
  
  const supportTickets = await query
    .sort('-lastResponseAt')
    .skip(skip)
    .limit(limit);
  
  res.status(200).json({
    status: 'success',
    data: {
      count: totalCount,
      supportTickets
    }
  });
});

exports.getSupportTicket = catchAsync(async (req, res, next) => {
  const supportTicket = await SupportTicket.findById(req.params.id).populate({
    path: 'user',
    select: 'firstName lastName email'
  });
  
  if (!supportTicket) {
    return next(new AppError(`Support ticket not found with id of ${req.params.id}`, 404));
  }
  
  const isAdmin = isUserAdmin(req.user);
  const isOwner = supportTicket.user && supportTicket.user._id && 
                  supportTicket.user._id.toString() === req.user._id.toString();
  
  if (!isAdmin && !isOwner) {
    return next(new AppError(`User is not authorized to access this ticket`, 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      supportTicket
    }
  });
});

exports.addTicketResponse = catchAsync(async (req, res, next) => {
  let supportTicket = await SupportTicket.findById(req.params.id);
  
  if (!supportTicket) {
    return next(new AppError(`Support ticket not found with id of ${req.params.id}`, 404));
  }
  
  const isAdmin = isUserAdmin(req.user);
  const isOwner = supportTicket.user && 
                  supportTicket.user.toString() === req.user._id.toString();
  
  if (!isAdmin && !isOwner) {
    return next(new AppError(`User is not authorized to respond to this ticket`, 403));
  }
  
  const newResponse = {
    message: req.body.message,
    isAdminResponse: isAdmin,
    createdAt: Date.now()
  };
  
  supportTicket.responses.push(newResponse);
  supportTicket.lastResponseAt = Date.now();
  
  if (req.body.status) {
    supportTicket.status = req.body.status;
  }
  
  if (req.body.status === 'resolved') {
    supportTicket.isResolved = true;
  }
  
  await supportTicket.save();
  
  const updatedTicket = await SupportTicket.findById(req.params.id).populate({
    path: 'user',
    select: 'firstName lastName email'
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      supportTicket: updatedTicket
    }
  });
});

exports.updateTicketStatus = catchAsync(async (req, res, next) => {
  if (!req.body.status) {
    return next(new AppError('Status is required', 400));
  }
  
  let supportTicket = await SupportTicket.findById(req.params.id);
  
  if (!supportTicket) {
    return next(new AppError(`Support ticket not found with id of ${req.params.id}`, 404));
  }
  
  if (!isUserAdmin(req.user)) {
    return next(new AppError(`User is not authorized to update this ticket status`, 403));
  }
  
  supportTicket.status = req.body.status;
  
  if (req.body.status === 'resolved') {
    supportTicket.isResolved = true;
  }
  
  await supportTicket.save();
  
  const updatedTicket = await SupportTicket.findById(req.params.id).populate({
    path: 'user',
    select: 'firstName lastName email'
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      supportTicket: updatedTicket
    }
  });
});

exports.deleteTicket = catchAsync(async (req, res, next) => {
  const supportTicket = await SupportTicket.findById(req.params.id);
  
  if (!supportTicket) {
    return next(new AppError(`Support ticket not found with id of ${req.params.id}`, 404));
  }
  
  const isAdmin = isUserAdmin(req.user);
  const isOwner = supportTicket.user && 
                  supportTicket.user.toString() === req.user._id.toString();
  
  if (!isAdmin && !isOwner) {
    return next(new AppError(`User is not authorized to delete this ticket`, 403));
  }
  
  await SupportTicket.findByIdAndDelete(req.params.id);
  
  res.status(200).json({
    status: 'success',
    data: null
  });
});