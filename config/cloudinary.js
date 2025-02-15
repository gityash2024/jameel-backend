// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const logger = require('./logging');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Default upload options
const defaultOptions = {
  folder: 'jsk-jewelry',
  resource_type: 'auto',
  allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  transformation: [
    { quality: 'auto:best' },
    { fetch_format: 'auto' }
  ]
};

// Upload function with custom options
const uploadToCloudinary = async (file, customOptions = {}) => {
  try {
    const options = { ...defaultOptions, ...customOptions };
    const result = await cloudinary.uploader.upload(file.path, options);
    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    throw new Error('File upload failed');
  }
};

// Delete function
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw new Error('File deletion failed');
  }
};

// Create optimized transformations
const createImageTransformations = (publicId, options = {}) => {
  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto'
  } = options;

  return {
    original: cloudinary.url(publicId, {
      secure: true,
      fetch_format: format,
      quality
    }),
    thumbnail: cloudinary.url(publicId, {
      secure: true,
      width: 150,
      height: 150,
      crop: 'thumb',
      fetch_format: format,
      quality
    }),
    responsive: {
      small: cloudinary.url(publicId, {
        secure: true,
        width: width ? Math.min(width, 400) : 400,
        crop,
        fetch_format: format,
        quality
      }),
      medium: cloudinary.url(publicId, {
        secure: true,
        width: width ? Math.min(width, 800) : 800,
        crop,
        fetch_format: format,
        quality
      }),
      large: cloudinary.url(publicId, {
        secure: true,
        width: width ? Math.min(width, 1200) : 1200,
        crop,
        fetch_format: format,
        quality
      })
    }
  };
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  createImageTransformations
};