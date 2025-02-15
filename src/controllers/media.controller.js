// src/controllers/media.controller.js
const Media = require('../models/media.model');
const { uploadToCloudinary, deleteFromCloudinary, createImageTransformations } = require('../../config/cloudinary');
const { uploadFile, deleteFile, getSignedUrl } = require('../services/storage.service');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const multer = require('multer');

// Upload middleware setup
exports.uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/^(image|video|application)\//)) {
      return cb(new AppError('Invalid file type. Only images, videos, and documents are allowed.', 400));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
}).single('file');


// Additional methods for media.controller.js

exports.getPublicMedia = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  // Check if the media is meant to be public
  if (!media.isPublic) {
    return next(new AppError('Media is not publicly accessible', 403));
  }

  res.status(200).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.updateFolder = catchAsync(async (req, res, next) => {
  const { name, parentFolder } = req.body;

  // Validate folder name
  if (name && !/^[a-zA-Z0-9-_]+$/.test(name)) {
    return next(new AppError('Invalid folder name. Use only letters, numbers, hyphens, and underscores.', 400));
  }

  // Create new folder path
  const folderPath = parentFolder ? `${parentFolder}/${name}` : name;

  // Check if folder already exists
  const existingFolder = await Media.findOne({ folder: folderPath });
  if (existingFolder) {
    return next(new AppError('Folder already exists', 400));
  }

  // Update all media items in the old folder
  const oldFolder = await Media.findById(req.params.id);
  if (!oldFolder) {
    return next(new AppError('Folder not found', 404));
  }

  // Update media items with new folder path
  await Media.updateMany(
    { folder: oldFolder.folder }, 
    { $set: { folder: folderPath } }
  );

  res.status(200).json({
    status: 'success',
    data: {
      folder: folderPath
    }
  });
});

exports.deleteFolder = catchAsync(async (req, res, next) => {
  const folder = await Media.findById(req.params.id);

  if (!folder) {
    return next(new AppError('Folder not found', 404));
  }

  // Check if folder is empty
  const mediaInFolder = await Media.countDocuments({ folder: folder.folder });
  if (mediaInFolder > 0) {
    return next(new AppError('Cannot delete a non-empty folder', 400));
  }

  // Remove folder references
  await Media.deleteMany({ folder: folder.folder });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.uploadMedia = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }

  const { type, folder = 'general', alt, caption } = req.body;

  // Upload to cloud storage
  const result = await uploadToCloudinary(req.file, {
    folder: `media/${folder}`,
    resource_type: type
  });

  // Create media record
  const media = await Media.create({
    fileName: req.file.originalname,
    fileType: type,
    mimeType: req.file.mimetype,
    size: req.file.size,
    public_id: result.public_id,
    url: result.secure_url,
    thumbnailUrl: result.format === 'pdf' ? null : result.thumbnail_url,
    alt,
    caption,
    uploadedBy: req.user._id,
    folder,
    metadata: {
      width: result.width,
      height: result.height,
      duration: result.duration,
      format: result.format
    }
  });

  res.status(201).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.bulkUploadMedia = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('No files uploaded', 400));
  }

  const uploadPromises = req.files.map(async (file) => {
    const result = await uploadToCloudinary(file, {
      folder: `media/${req.body.folder || 'general'}`,
      resource_type: file.mimetype.split('/')[0]
    });

    return Media.create({
      fileName: file.originalname,
      fileType: file.mimetype.split('/')[0],
      mimeType: file.mimetype,
      size: file.size,
      public_id: result.public_id,
      url: result.secure_url,
      thumbnailUrl: result.thumbnail_url,
      uploadedBy: req.user._id,
      folder: req.body.folder || 'general',
      metadata: {
        width: result.width,
        height: result.height,
        duration: result.duration,
        format: result.format
      }
    });
  });

  const mediaFiles = await Promise.all(uploadPromises);

  res.status(201).json({
    status: 'success',
    results: mediaFiles.length,
    data: {
      media: mediaFiles
    }
  });
});

exports.getAllMedia = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Media.find(),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .search(['fileName', 'alt', 'caption']);

  const media = await features.query;
  const total = await Media.countDocuments();

  res.status(200).json({
    status: 'success',
    results: media.length,
    total,
    data: {
      media
    }
  });
});

exports.getMediaById = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.getMediaByFolder = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Media.find({ folder: req.params.folderName }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const media = await features.query;
  const total = await Media.countDocuments({ folder: req.params.folderName });

  res.status(200).json({
    status: 'success',
    results: media.length,
    total,
    data: {
      media
    }
  });
});

exports.updateMedia = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  Object.assign(media, req.body);
  await media.save();

  res.status(200).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.deleteMedia = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  // Delete from cloud storage
  await deleteFromCloudinary(media.public_id);

  // Delete from database
  await media.remove();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.bulkDeleteMedia = catchAsync(async (req, res) => {
  const media = await Media.find({ _id: { $in: req.body.ids } });

  // Delete from cloud storage
  await Promise.all(
    media.map(file => deleteFromCloudinary(file.public_id))
  );

  // Delete from database
  await Media.deleteMany({ _id: { $in: req.body.ids } });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getAllFolders = catchAsync(async (req, res) => {
  const folders = await Media.distinct('folder');

  res.status(200).json({
    status: 'success',
    data: {
      folders
    }
  });
});

exports.createFolder = catchAsync(async (req, res) => {
  const { name, parentFolder } = req.body;

  // Validate folder name
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    return next(new AppError('Invalid folder name. Use only letters, numbers, hyphens, and underscores.', 400));
  }

  // Create folder path
  const folderPath = parentFolder ? `${parentFolder}/${name}` : name;

  // Check if folder exists
  const existingFolder = await Media.findOne({ folder: folderPath });
  if (existingFolder) {
    return next(new AppError('Folder already exists', 400));
  }

  res.status(201).json({
    status: 'success',
    data: {
      folder: folderPath
    }
  });
});

exports.optimizeImage = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  if (media.fileType !== 'image') {
    return next(new AppError('File is not an image', 400));
  }

  const { quality, width, height, format } = req.body;

  // Create optimized version
  const result = await createImageTransformations(media.public_id, {
    width,
    height,
    quality,
    format
  });

  // Update media record
  media.url = result.secure_url;
  media.metadata.width = result.width;
  media.metadata.height = result.height;
  media.metadata.format = result.format;
  await media.save();

  res.status(200).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.bulkOptimizeImages = catchAsync(async (req, res) => {
  const { ids, quality, format } = req.body;

  const media = await Media.find({
    _id: { $in: ids },
    fileType: 'image'
  });

  const optimizedMedia = await Promise.all(
    media.map(async (file) => {
      const result = await createImageTransformations(file.public_id, {
        quality,
        format
      });

      file.url = result.secure_url;
      file.metadata.format = result.format;
      await file.save();

      return file;
    })
  );

  res.status(200).json({
    status: 'success',
    results: optimizedMedia.length,
    data: {
      media: optimizedMedia
    }
  });
});

exports.transformMedia = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  const { operations } = req.body;

  let result = { public_id: media.public_id };

  // Apply each transformation
  for (const operation of operations) {
    switch (operation.type) {
      case 'resize':
        result = await createImageTransformations(result.public_id, {
          width: operation.params.width,
          height: operation.params.height,
          crop: operation.params.crop
        });
        break;
      case 'rotate':
        result = await createImageTransformations(result.public_id, {
          angle: operation.params.angle
        });
        break;
      case 'watermark':
        result = await createImageTransformations(result.public_id, {
          overlay: operation.params.watermarkId,
          opacity: operation.params.opacity
        });
        break;
      default:
        return next(new AppError(`Unsupported transformation: ${operation.type}`, 400));
    }
  }

  // Update media record
  media.url = result.secure_url;
  media.metadata = {
    ...media.metadata,
    width: result.width,
    height: result.height
  };
  await media.save();

  res.status(200).json({
    status: 'success',
    data: {
      media
    }
  });
});

exports.getMediaUsage = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  // Get usage information from all related collections
  const usage = await Media.aggregate([
    {
      $match: { _id: media._id }
    },
    {
      $lookup: {
        from: 'products',
        let: { mediaId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ['$$mediaId', '$images']
              }
            }
          }
        ],
        as: 'productUsage'
      }
    },
    {
      $lookup: {
        from: 'blogs',
        let: { mediaId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$$mediaId', '$featuredImage']
              }
            }
          }
        ],
        as: 'blogUsage'
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      usage: usage[0]
    }
  });
});

exports.getStorageAnalytics = catchAsync(async (req, res) => {
  const analytics = await Media.aggregate([
    {
      $group: {
        _id: '$fileType',
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' }
      }
    }
  ]);

  const totalStorage = await Media.aggregate([
    {
      $group: {
        _id: null,
        totalSize: { $sum: '$size' },
        totalFiles: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      byType: analytics,
      total: totalStorage[0]
    }
  });
});

exports.getUsageAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const analytics = await Media.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        uploadCount: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

exports.cleanupUnusedMedia = catchAsync(async (req, res) => {
  // Find unused media files
  const unusedMedia = await Media.aggregate([
    {
      $lookup: {
        from: 'products',
        let: { mediaId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ['$$mediaId', '$images']
              }
            }
          }
        ],
        as: 'productUsage'
      }
    },
    {
      $lookup: {
        from: 'blogs',
        let: { mediaId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$$mediaId', '$featuredImage']
              }
            }
          }
        ],
        as: 'blogUsage'
      }
    },
    {
      $match: {
        productUsage: { $size: 0 },
        blogUsage: { $size: 0 }
      }
    }
  ]);

  // Delete unused files
  await Promise.all(
    unusedMedia.map(async (file) => {
      await deleteFromCloudinary(file.public_id);
      await Media.findByIdAndDelete(file._id);
    })
  );

  res.status(200).json({
    status: 'success',
    results: unusedMedia.length,
    data: {
      deletedFiles: unusedMedia
    }
  });
});

exports.cleanupDuplicates = catchAsync(async (req, res) => {
  // Find duplicate files based on hash/checksum
  const duplicates = await Media.aggregate([
    {
      $group: {
        _id: { 
          size: '$size',
          hash: '$metadata.hash'
        },
        files: { $push: '$ROOT' },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  // Keep one file from each duplicate group and delete others
  const deletedFiles = [];
  await Promise.all(
    duplicates.map(async (group) => {
      const [keep, ...remove] = group.files;
      
      await Promise.all(
        remove.map(async (file) => {
          await deleteFromCloudinary(file.public_id);
          await Media.findByIdAndDelete(file._id);
          deletedFiles.push(file);
        })
      );
    })
  );

  res.status(200).json({
    status: 'success',
    results: deletedFiles.length,
    data: {
      deletedFiles
    }
  });
});

exports.searchMedia = catchAsync(async (req, res) => {
  const { query, type, folder, metadata } = req.body;

  const searchQuery = {
    $and: [
      {
        $or: [
          { fileName: { $regex: query, $options: 'i' } },
          { alt: { $regex: query, $options: 'i' } },
          { caption: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  };

  if (type) {
    searchQuery.$and.push({ fileType: type });
  }

  if (folder) {
    searchQuery.$and.push({ folder });
  }

  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      searchQuery.$and.push({ [`metadata.${key}`]: value });
    });
  }

  const media = await Media.find(searchQuery)
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: media.length,
    data: {
      media
    }
  });
});

exports.generateSignedUrl = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  const signedUrl = await getSignedUrl(media.public_id);

  res.status(200).json({
    status: 'success',
    data: {
      url: signedUrl
    }
  });
});

exports.generateThumbnail = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('Media not found', 404));
  }

  if (media.fileType !== 'image' && media.fileType !== 'video') {
    return next(new AppError('Thumbnails can only be generated for images and videos', 400));
  }

  const { width = 150, height = 150 } = req.query;

  const result = await createImageTransformations(media.public_id, {
    width: parseInt(width),
    height: parseInt(height),
    crop: 'thumb'
  });

  media.thumbnailUrl = result.secure_url;
  await media.save();

  res.status(200).json({
    status: 'success',
    data: {
      media
    }
  });
});

// Helper Functions

const calculateHash = (buffer) => {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
};