// src/utils/fileUpload.js
const cloudinary = require('../../config/cloudinary');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const AppError = require('./appError');
const { FILE_TYPES, FILE_SIZE_LIMITS } = require('../constants');

class FileUploadUtil {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }

  /**
   * Validate file
   * @param {Object} file - File object
   * @param {Array} allowedTypes - Allowed file types
   * @param {number} maxSize - Maximum file size
   */
  validateFile(file, allowedTypes, maxSize) {
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError('Invalid file type', 400);
    }

    // Check file size
    if (file.size > maxSize) {
      throw new AppError(`File size cannot exceed ${maxSize / (1024 * 1024)}MB`, 400);
    }
  }

  /**
   * Upload file to Cloudinary
   * @param {Object} file - File object
   * @param {Object} options - Upload options
   * @returns {Promise} Upload result
   */
  async uploadToCloudinary(file, options = {}) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: options.folder || 'uploads',
        resource_type: 'auto',
        ...options
      });

      // Clean up temporary file
      if (file.path) {
        fs.unlinkSync(file.path);
      }

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        resourceType: result.resource_type
      };
    } catch (error) {
      throw new AppError('File upload failed', 500);
    }
  }

// src/utils/fileUpload.js (continued)

async uploadToS3(file, options = {}) {
    try {
      const fileStream = fs.createReadStream(file.path);
      const fileKey = `${options.folder || 'uploads'}/${Date.now()}-${file.originalname}`;

      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        Body: fileStream,
        ContentType: file.mimetype,
        ACL: options.acl || 'public-read',
        ...options
      };

      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams
      });

      const result = await upload.done();

      // Clean up temporary file
      if (file.path) {
        fs.unlinkSync(file.path);
      }

      return {
        url: result.Location,
        key: result.Key,
        bucket: result.Bucket
      };
    } catch (error) {
      throw new AppError('S3 upload failed', 500);
    }
  }

  /**
   * Optimize image
   * @param {Object} file - Image file
   * @param {Object} options - Optimization options
   * @returns {Promise} Optimized image buffer
   */
  async optimizeImage(file, options = {}) {
    try {
      const {
        width,
        height,
        quality = 80,
        format = 'jpeg'
      } = options;

      let imageProcessor = sharp(file.path);

      // Resize if dimensions provided
      if (width || height) {
        imageProcessor = imageProcessor.resize(width, height, {
          fit: 'cover',
          withoutEnlargement: true
        });
      }

      // Convert and compress
      imageProcessor = imageProcessor.toFormat(format, { quality });

      // Save optimized image
      const optimizedBuffer = await imageProcessor.toBuffer();
      
      return {
        buffer: optimizedBuffer,
        info: await imageProcessor.metadata()
      };
    } catch (error) {
      throw new AppError('Image optimization failed', 500);
    }
  }

  /**
   * Create image thumbnails
   * @param {Object} file - Image file
   * @param {Array} sizes - Thumbnail sizes
   * @returns {Promise} Generated thumbnails
   */
  async createThumbnails(file, sizes = []) {
    try {
      const thumbnails = {};
      const image = sharp(file.path);

      for (const size of sizes) {
        const { width, height } = size;
        const thumbnail = await image
          .resize(width, height, { fit: 'cover' })
          .toBuffer();

        thumbnails[`${width}x${height}`] = thumbnail;
      }

      return thumbnails;
    } catch (error) {
      throw new AppError('Thumbnail creation failed', 500);
    }
  }

  /**
   * Delete file from Cloudinary
   * @param {string} publicId - Public ID of the file
   */
  async deleteFromCloudinary(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new AppError('File deletion failed', 500);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 object key
   */
  async deleteFromS3(key) {
    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      }));
    } catch (error) {
      throw new AppError('S3 file deletion failed', 500);
    }
  }

  /**
   * Handle multiple file uploads
   * @param {Array} files - Array of files
   * @param {Object} options - Upload options
   * @returns {Promise} Upload results
   */
  async handleMultipleUploads(files, options = {}) {
    const uploadPromises = files.map(file => 
      options.storage === 's3' 
        ? this.uploadToS3(file, options)
        : this.uploadToCloudinary(file, options)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Get file extension
   * @param {string} filename - Original filename
   * @returns {string} File extension
   */
  getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  /**
   * Generate unique filename
   * @param {string} originalname - Original filename
   * @returns {string} Unique filename
   */
  generateUniqueFilename(originalname) {
    const extension = this.getFileExtension(originalname);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}${extension}`;
  }

  /**
   * Check if file is image
   * @param {string} mimetype - File mimetype
   * @returns {boolean}
   */
  isImage(mimetype) {
    return FILE_TYPES.IMAGE.includes(mimetype);
  }

  /**
   * Get file size in MB
   * @param {number} bytes - File size in bytes
   * @returns {number} File size in MB
   */
  getFileSizeInMB(bytes) {
    return bytes / (1024 * 1024);
  }
}

module.exports = new FileUploadUtil();