const Role = require('../models/roles.model');
const { AppError, catchAsync } = require('../utils/appError');

exports.getAllRoles = catchAsync(async (req, res) => {
  const roles = await Role.find();

  res.status(200).json({
    status: 'success',
    data: {
      roles
    }
  });
});

exports.createRole = catchAsync(async (req, res) => {
  const { name, permissions } = req.body;

  const role = await Role.create({ name, permissions });

  res.status(201).json({
    status: 'success',
    data: {
      role
    }
  });
});

exports.updateRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body;

  const role = await Role.findByIdAndUpdate(id, { name, permissions }, { new: true });

  if (!role) {
    return next(new AppError('Role not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      role
    }
  });
});

exports.deleteRole = catchAsync(async (req, res) => {
  const { id } = req.params;

  const role = await Role.findByIdAndDelete(id);

  if (!role) {
    return next(new AppError('Role not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});