const Media = require('../models/media.model');
const { AppError, catchAsync } = require('../utils/appError');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const multer = require('multer');
const path = require('path');

// Set up multer for handling file uploads
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter
}).single('file');

// Simple file upload handler - this doesn't use catchAsync because multer requires a different error handling approach
exports.uploadMedia = (req, res) => {
  console.log('Upload media route hit');
  
  upload(req, res, async function(err) {
    // Handle multer errors
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        status: 'fail',
        message: err.message
      });
    }
    
    // Check if file exists
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }
    
    try {
      console.log('Uploading file to Cloudinary:', req.file.originalname);
      
      // Upload to Cloudinary
      const result = await uploadToCloudinary(req.file);
      console.log('Cloudinary upload successful:', result.url);
      
      // Save to database
      const media = await Media.create({
        fileName: req.file.originalname,
        fileType: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
        url: result.url,
        alt: req.body.alt || req.file.originalname,
        caption: req.body.caption || '',
        uploadedBy: req.user ? req.user._id : null,
        folder: req.body.folder || 'general'
      });
      
      // Return success response
      return res.status(200).json({
        status: 'success',
        data: {
          media,
          fileUrl: result.url,
          publicId: result.public_id,
          fileDetails: {
            format: result.format,
            size: result.bytes,
            width: result.width,
            height: result.height
          }
        }
      });
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      return res.status(500).json({
        status: 'error',
        message: `File upload failed: ${error.message}`
      });
    }
  });
};

// Get all media with pagination and filters
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

// Save media to database
exports.createMedia = catchAsync(async (req, res) => {
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

// Update media
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

// Delete media
exports.deleteMedia = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { publicId } = req.body;
  
  const media = await Media.findById(id);
  
  if (!media) {
    throw new AppError('Media not found', 404);
  }
  
  if (publicId) {
    try {
      await deleteFromCloudinary(publicId);
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      // Continue anyway to remove from DB
    }
  }
  
  await Media.findByIdAndDelete(id);
  
  res.status(200).json({
    status: 'success',
    message: 'Media deleted successfully'
  });
});