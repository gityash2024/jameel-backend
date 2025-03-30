const Banner = require('../models/banner.model');
const { catchAsync } = require('../utils/appError');
const AppError = require('../utils/appError');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');

// Create a new banner
exports.createBanner = catchAsync(async (req, res, next) => {
  try {
    // Debug the file object
    console.log('File object received:', req.file);
    console.log('Request body:', req.body);
    
    const bannerData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Handle boolean conversion (formData sends strings)
    if (bannerData.isActive === 'true') bannerData.isActive = true;
    if (bannerData.isActive === 'false') bannerData.isActive = false;

    // If this banner is being activated, deactivate all other banners
    if (bannerData.isActive) {
      await Banner.updateMany(
        { isActive: true },
        { isActive: false }
      );
    }

    // If image file is uploaded, process it
    if (req.file) {
      try {
        console.log('Processing uploaded file:', req.file.originalname);
        
        // Check if the file has necessary properties
        if (!req.file.buffer && !req.file.path) {
          console.error('File missing buffer or path:', req.file);
          return next(new AppError('Invalid file format: missing data', 400));
        }
        
        const result = await uploadToCloudinary(req.file, { folder: 'banners' });
        
        if (!result || !result.url) {
          console.error('Cloudinary result missing URL:', result);
          return next(new AppError('File upload failed: missing image URL', 400));
        }
        
        bannerData.image = {
          url: result.secure_url || result.url,
          alt: req.body.alt || 'Banner image'
        };
        
        console.log('Image data set:', bannerData.image);
      } catch (uploadError) {
        console.error('Error uploading image to Cloudinary:', uploadError);
        return next(new AppError(`Image upload failed: ${uploadError.message}`, 400));
      }
    } else {
      // Image is required for new banners
      console.error('No file was uploaded');
      return next(new AppError('Banner image is required', 400));
    }

    const banner = await Banner.create(bannerData);

    res.status(201).json({
      status: 'success',
      data: {
        banner
      }
    });
  } catch (error) {
    console.error('Error creating banner:', error);
    return next(error);
  }
});

// Get all banners
exports.getAllBanners = catchAsync(async (req, res) => {
  const banners = await Banner.find().sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: banners.length,
    data: {
      banners
    }
  });
});

// Get active banner
exports.getActiveBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findOne({ isActive: true });

  res.status(200).json({
    status: 'success',
    data: {
      banner
    }
  });
});

// Get a single banner
exports.getBanner = catchAsync(async (req, res, next) => {
  const banner = await Banner.findById(req.params.id);

  if (!banner) {
    return next(new AppError('No banner found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      banner
    }
  });
});

// Update a banner
exports.updateBanner = catchAsync(async (req, res, next) => {
  try {
    const bannerData = {
      ...req.body,
      updatedBy: req.user._id
    };

    // Handle boolean conversion (formData sends strings)
    if (bannerData.isActive === 'true') bannerData.isActive = true;
    if (bannerData.isActive === 'false') bannerData.isActive = false;

    // Get the existing banner
    const existingBanner = await Banner.findById(req.params.id);
    if (!existingBanner) {
      return next(new AppError('No banner found with that ID', 404));
    }

    // If image file is uploaded, process it
    if (req.file) {
      try {
        console.log('Processing uploaded file for update:', req.file.originalname);
        
        // Check if the file has necessary properties
        if (!req.file.buffer && !req.file.path) {
          console.error('File missing buffer or path:', req.file);
          return next(new AppError('Invalid file format: missing data', 400));
        }
        
        const result = await uploadToCloudinary(req.file, { folder: 'banners' });
        
        if (!result || !result.url) {
          console.error('Cloudinary result missing URL:', result);
          return next(new AppError('File upload failed: missing image URL', 400));
        }
        
        bannerData.image = {
          url: result.secure_url || result.url,
          alt: req.body.alt || existingBanner.image?.alt || 'Banner image'
        };
        
        console.log('Updated image data set:', bannerData.image);
        
        // Delete the old image from cloudinary if it exists
        if (existingBanner.image && existingBanner.image.url) {
          try {
            const publicId = existingBanner.image.url.split('/').pop().split('.')[0];
            console.log('Attempting to delete old image:', publicId);
            await deleteFromCloudinary(publicId);
          } catch (deleteError) {
            console.warn(`Failed to delete old image: ${deleteError.message}`);
            // Continue with update even if old image deletion fails
          }
        }
      } catch (uploadError) {
        console.error('Error uploading image to Cloudinary:', uploadError);
        return next(new AppError(`Image upload failed: ${uploadError.message}`, 400));
      }
    } else if (req.body.existingImageUrl) {
      // If no new image but there's an existing image URL passed from frontend
      bannerData.image = {
        url: req.body.existingImageUrl,
        alt: req.body.existingImageAlt || existingBanner.image?.alt || 'Banner image'
      };
    } else if (existingBanner.image) {
      // If no information about image was passed, keep the existing image
      bannerData.image = existingBanner.image;
    } else {
      // If there's no image at all (shouldn't happen but just in case)
      return next(new AppError('Banner image is required', 400));
    }

    // If this banner is being activated, deactivate all other banners
    if (bannerData.isActive) {
      await Banner.updateMany(
        { _id: { $ne: req.params.id }, isActive: true },
        { isActive: false }
      );
    }

    // Remove fields that shouldn't be updated
    delete bannerData.existingImageUrl;
    delete bannerData.existingImageAlt;

    const banner = await Banner.findByIdAndUpdate(req.params.id, bannerData, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      status: 'success',
      data: {
        banner
      }
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    return next(error);
  }
});

// Delete a banner
exports.deleteBanner = catchAsync(async (req, res, next) => {
  const banner = await Banner.findById(req.params.id);

  if (!banner) {
    return next(new AppError('No banner found with that ID', 404));
  }

  // Delete image from cloudinary if exists
  if (banner.image && banner.image.url) {
    const publicId = banner.image.url.split('/').pop().split('.')[0];
    await deleteFromCloudinary(publicId);
  }

  await Banner.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
}); 