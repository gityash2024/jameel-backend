// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const logger = require('./logging');
const fs = require('fs');

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
    
    console.log('Attempting Cloudinary upload with file:', {
      type: typeof file,
      isEmpty: !file,
      hasBuffer: file && !!file.buffer,
      hasPath: file && !!file.path,
      mimeType: file && file.mimetype,
      size: file && file.size,
      fieldname: file && file.fieldname,
      originalname: file && file.originalname
    });
    
    // Handle different file formats
    let result;
    
    if (!file) {
      throw new Error('No file provided for upload');
    }
    
    try {
      if (file.buffer) {
        // If file has a buffer (memory storage)
        console.log('Uploading from buffer with mimetype:', file.mimetype);
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        result = await cloudinary.uploader.upload(dataURI, options);
      } else if (file.path) {
        // If file has a path (disk storage)
        console.log('Uploading from path:', file.path);
        // Verify file exists before upload
        if (fs.existsSync(file.path)) {
          result = await cloudinary.uploader.upload(file.path, options);
          
          // Clean up the temp file after upload
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkError) {
            logger.warn(`Failed to remove temp file ${file.path}: ${unlinkError.message}`);
          }
        } else {
          throw new Error(`File path does not exist: ${file.path}`);
        }
      } else if (typeof file === 'string') {
        // If file is already a string (URL or base64)
        console.log('Uploading from string');
        result = await cloudinary.uploader.upload(file, options);
      } else {
        console.error('Invalid file format:', JSON.stringify(file, null, 2));
        throw new Error('Invalid file format. Expected buffer, path, or string.');
      }
    } catch (uploadErr) {
      console.error('Error during Cloudinary upload operation:', uploadErr);
      throw new Error(`Upload operation failed: ${uploadErr.message}`);
    }
    
    if (!result || !result.secure_url) {
      console.error('Cloudinary response missing secure_url:', result);
      throw new Error('Invalid response from Cloudinary: Missing image URL');
    }
    
    console.log('Cloudinary upload successful:', {
      public_id: result.public_id,
      secure_url: result.secure_url
    });
    
    logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
    
    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload detailed error:', error);
    logger.error('Cloudinary upload error:', error);
    throw new Error(`File upload failed: ${error.message}`);
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