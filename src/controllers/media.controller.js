const Media = require('../models/media.model');
const {AppError} = require('../utils/appError');
const {catchAsync} = require('../utils/appError');

exports.getAllMedia = catchAsync(async (req, res) => {
  const { page = 1, limit = 30, search = '', type = '', folder = '' } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  
  if (search) {
    query.$or = [
      { fileName: { $regex: search, $options: 'i' } },
      { alt: { $regex: search, $options: 'i' } }
    ];
  }

  if (type) {
    query.fileType = type;
  }

  if (folder) {
    query.folder = folder;
  }

  const [media, total] = await Promise.all([
    Media.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Media.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    status: 'success',
    results: media.length,
    total,
    totalPages,
    currentPage: parseInt(page),
    data: {
      media
    }
  });
});

exports.uploadMedia = catchAsync(async (req, res) => {
  const { url, type, folder = 'general', alt = '', caption = '' } = req.body;

  if (!url) {
    throw new AppError('No file URL provided', 400);
  }

  const media = await Media.create({
    fileName: url.split('/').pop(),
    fileType: type || 'image',
    url,
    alt,
    caption,
    uploadedBy: req.user ? req.user._id : null,
    folder
  });

  res.status(201).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.updateMedia = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { alt, caption, folder } = req.body;

  const media = await Media.findByIdAndUpdate(
    id, 
    { alt, caption, folder },
    { new: true, runValidators: true }
  );

  if (!media) {
    throw new AppError('Media not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.deleteMedia = catchAsync(async (req, res) => {
  const { id } = req.params;

  const media = await Media.findByIdAndDelete(id);

  if (!media) {
    throw new AppError('Media not found', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});