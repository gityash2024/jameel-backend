// src/middleware/upload.middleware.js
const multer = require('multer');
const path = require('path');
const AppError = require('../utils/appError');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Multer configuration for different types of uploads
const MIME_TYPES = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

// Configure Cloudinary storage
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
      // Determine folder based on upload type
      const uploadType = req.params.type || 'misc';
      return `uploads/${uploadType}`;
    },
    public_id: (req, file) => {
      // Generate unique filename
      const fileName = file.originalname.split(' ').join('_');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `${path.parse(fileName).name}-${uniqueSuffix}`;
    },
    // Add any transformation parameters here
    transformation: [{ quality: 'auto:best' }]
  }
});

// Configure local storage
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const name = file.originalname.split(' ').join('_');
    const extension = MIME_TYPES[file.mimetype];
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, name + '-' + uniqueSuffix + '.' + extension);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  if (!MIME_TYPES[file.mimetype]) {
    cb(new AppError('Invalid file type. Only images are allowed.', 400), false);
  } else {
    cb(null, true);
  }
};

// Create different upload configurations
const uploadConfig = {
  // Single image upload
  single: multer({
    storage: cloudinaryStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter
  }).single('image'),

  // Multiple images upload
  multiple: multer({
    storage: cloudinaryStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB per file
      files: 5 // Maximum 5 files
    },
    fileFilter
  }).array('images', 5),

  // Product images upload
  product: multer({
    storage: cloudinaryStorage,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 10
    },
    fileFilter
  }).array('productImages', 10),

  // Profile image upload
  profile: multer({
    storage: cloudinaryStorage,
    limits: {
      fileSize: 2 * 1024 * 1024 // 2MB
    },
    fileFilter
  }).single('profileImage'),

  // Blog image upload
  blog: multer({
    storage: cloudinaryStorage,
    limits: {
      fileSize: 3 * 1024 * 1024
    },
    fileFilter
  }).single('blogImage')
};

// Middleware wrapper for error handling
const upload = (type = 'single') => {
  return (req, res, next) => {
    const uploadMiddleware = uploadConfig[type];
    
    if (!uploadMiddleware) {
      return next(new AppError('Invalid upload type specified', 400));
    }

    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('File size too large', 400));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError('Too many files', 400));
        }
        return next(new AppError(err.message, 400));
      }
      if (err) {
        return next(new AppError(err.message, 400));
      }
      next();
    });
  };
};

// Clean up function for removing uploaded files
const cleanup = async (files) => {
  if (!files) return;

  const filesToDelete = Array.isArray(files) ? files : [files];

  for (const file of filesToDelete) {
    if (file.public_id) {
      try {
        await cloudinary.uploader.destroy(file.public_id);
      } catch (error) {
        console.error('Error deleting file from Cloudinary:', error);
      }
    }
  }
};

module.exports = {
  upload,
  cleanup
};