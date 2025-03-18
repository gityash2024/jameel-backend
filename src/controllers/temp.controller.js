const { catchAsync } = require('../utils/appError');

exports.test = catchAsync(async (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Test endpoint working'
  });
}); 