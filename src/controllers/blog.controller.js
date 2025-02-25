// src/controllers/blog.controller.js
const Blog = require('../models/blog.model');
const BlogComment = require('../models/blogComment.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../config/cloudinary');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const cache = require('../middleware/cache.middleware');

// Upload handler for featured image
exports.uploadFeaturedImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  const result = await uploadToCloudinary(req.file, {
    folder: 'blog/featured'
  });

  req.body.featuredImage = {
    public_id: result.public_id,
    url: result.secure_url,
    alt: req.body.imageAlt || req.body.title
  };

  next();
});


// Category Management
exports.createCategory = catchAsync(async (req, res) => {
  const category = await Category.create({
    name: req.body.name,
    description: req.body.description,
    createdBy: req.user._id
  });

  // Clear cache

  res.status(201).json({
    status: 'success',
    data: {
      category
    }
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  Object.assign(category, req.body);
  await category.save();

  // Clear cache

  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  // Check if category is used in any blog posts
  const blogCount = await Blog.countDocuments({ categories: category._id });
  if (blogCount > 0) {
    return next(new AppError('Cannot delete category with associated blog posts', 400));
  }

  await category.deleteOne();

  // Clear cache

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Tag Management
exports.createTag = catchAsync(async (req, res) => {
  const tag = await Tag.create({
    name: req.body.name,
    description: req.body.description,
    createdBy: req.user._id
  });

  // Clear cache

  res.status(201).json({
    status: 'success',
    data: {
      tag
    }
  });
});

exports.updateTag = catchAsync(async (req, res, next) => {
  const tag = await Tag.findById(req.params.id);

  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  Object.assign(tag, req.body);
  await tag.save();

  // Clear cache

  res.status(200).json({
    status: 'success',
    data: {
      tag
    }
  });
});

exports.deleteTag = catchAsync(async (req, res, next) => {
  const tag = await Tag.findById(req.params.id);

  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  // Check if tag is used in any blog posts
  const blogCount = await Blog.countDocuments({ tags: tag._id });
  if (blogCount > 0) {
    return next(new AppError('Cannot delete tag with associated blog posts', 400));
  }

  await tag.deleteOne();

  // Clear cache

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Comment Moderation
exports.updateCommentStatus = catchAsync(async (req, res, next) => {
  const comment = await BlogComment.findById(req.params.id);

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  comment.status = req.body.status;
  await comment.save();

  res.status(200).json({
    status: 'success',
    data: {
      comment
    }
  });
});

// Like/Unlike Routes
exports.likePost = catchAsync(async (req, res, next) => {
  const post = await Blog.findOne({ slug: req.params.slug });

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  // Check if user has already liked the post
  if (post.likes.includes(req.user._id)) {
    return next(new AppError('You have already liked this post', 400));
  }

  post.likes.push(req.user._id);
  await post.save();

  res.status(200).json({
    status: 'success',
    data: {
      post
    }
  });
});

exports.unlikePost = catchAsync(async (req, res, next) => {
  const post = await Blog.findOne({ slug: req.params.slug });

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  // Remove user's like
  post.likes = post.likes.filter(
    userId => userId.toString() !== req.user._id.toString()
  );
  await post.save();

  res.status(200).json({
    status: 'success',
    data: {
      post
    }
  });
});
// Blog Post Controllers
exports.getAllPosts = catchAsync(async (req, res) => {
  const features = new APIFeatures(Blog.find({ status: 'published' }), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate()
    .search(['title', 'content', 'summary']);

  const posts = await features.query
    .populate('author', 'firstName lastName')
    .populate('categories')
    .populate('tags');

  const total = await Blog.countDocuments({ status: 'published' });

  res.status(200).json({
    status: 'success',
    results: posts.length,
    total,
    data: {
      posts
    }
  });
});

exports.getFeaturedPosts = catchAsync(async (req, res) => {
  const posts = await Blog.find({ status: 'published', isFeature: true })
    .sort('-publishDate')
    .limit(6)
    .populate('author', 'firstName lastName')
    .populate('categories');

  res.status(200).json({
    status: 'success',
    data: {
      posts
    }
  });
});

exports.getPostBySlug = catchAsync(async (req, res, next) => {
  const post = await Blog.findOne({ 
    slug: req.params.slug,
    status: 'published'
  })
    .populate('author', 'firstName lastName')
    .populate('categories')
    .populate('tags');

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  // Increment view count
  post.viewCount += 1;
  await post.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    data: {
      post
    }
  });
});

exports.createPost = catchAsync(async (req, res) => {
  const post = await Blog.create({
    ...req.body,
    author: req.user._id
  });


  res.status(201).json({
    status: 'success',
    data: {
      post
    }
  });
});

exports.updatePost = catchAsync(async (req, res, next) => {
  const post = await Blog.findById(req.params.id);

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  // Handle featured image update
  if (req.body.featuredImage && post.featuredImage.public_id) {
    await deleteFromCloudinary(post.featuredImage.public_id);
  }

  Object.assign(post, req.body);
  await post.save();

  // Clear cache

  res.status(200).json({
    status: 'success',
    data: {
      post
    }
  });
});

exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Blog.findById(req.params.id);

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  // Delete featured image
  if (post.featuredImage.public_id) {
    await deleteFromCloudinary(post.featuredImage.public_id);
  }

  await post.deleteOne();

  // Clear cache

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Comment Controllers
exports.getPostComments = catchAsync(async (req, res) => {
  const post = await Blog.findOne({ slug: req.params.slug });
  
  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  const features = new APIFeatures(
    BlogComment.find({ 
      blog: post._id,
      status: 'approved',
      parent: null // Get only top-level comments
    }),
    req.query
  )
    .sort()
    .paginate();

  const comments = await features.query
    .populate('user', 'firstName lastName avatar')
    .populate({
      path: 'replies',
      populate: {
        path: 'user',
        select: 'firstName lastName avatar'
      }
    });

  const total = await BlogComment.countDocuments({
    blog: post._id,
    status: 'approved',
    parent: null
  });

  res.status(200).json({
    status: 'success',
    results: comments.length,
    total,
    data: {
      comments
    }
  });
});

exports.addComment = catchAsync(async (req, res, next) => {
  const post = await Blog.findOne({ slug: req.params.slug });
  
  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  const comment = await BlogComment.create({
    blog: post._id,
    user: req.user._id,
    content: req.body.content,
    parent: req.body.parent || null,
    status: 'approved'
  });

  res.status(201).json({
    status: 'success',
    data: {
      comment
    }
  });
});

exports.updateComment = catchAsync(async (req, res, next) => {
  const comment = await BlogComment.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  comment.content = req.body.content;
  comment.isEdited = true;
  comment.editHistory.push({
    content: comment.content,
    editedAt: Date.now()
  });

  await comment.save();

  res.status(200).json({
    status: 'success',
    data: {
      comment
    }
  });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
  const comment = await BlogComment.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  await comment.deleteOne();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Category Controllers
exports.getCategories = catchAsync(async (req, res) => {
  const categories = await Blog.aggregate([
    { $unwind: '$categories' },
    {
      $group: {
        _id: '$categories',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' },
    {
      $project: {
        _id: 1,
        name: '$category.name',
        slug: '$category.slug',
        count: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      categories
    }
  });
});

exports.getPostsByCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.slug });
  
  if (!category) {
    return next(new AppError('Category not found', 404));
  }

  const features = new APIFeatures(
    Blog.find({ 
      categories: category._id,
      status: 'published'
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const posts = await features.query
    .populate('author', 'firstName lastName')
    .populate('categories')
    .populate('tags');

  const total = await Blog.countDocuments({
    categories: category._id,
    status: 'published'
  });

  res.status(200).json({
    status: 'success',
    results: posts.length,
    total,
    data: {
      category,
      posts
    }
  });
});

// Tag Controllers
exports.getTags = catchAsync(async (req, res) => {
  const tags = await Blog.aggregate([
    { $unwind: '$tags' },
    {
      $group: {
        _id: '$tags',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'tags',
        localField: '_id',
        foreignField: '_id',
        as: 'tag'
      }
    },
    { $unwind: '$tag' },
    {
      $project: {
        _id: 1,
        name: '$tag.name',
        slug: '$tag.slug',
        count: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      tags
    }
  });
});

exports.getPostsByTag = catchAsync(async (req, res, next) => {
  const tag = await Tag.findOne({ slug: req.params.slug });
  
  if (!tag) {
    return next(new AppError('Tag not found', 404));
  }

  const features = new APIFeatures(
    Blog.find({ 
      tags: tag._id,
      status: 'published'
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const posts = await features.query
    .populate('author', 'firstName lastName')
    .populate('categories')
    .populate('tags');

  const total = await Blog.countDocuments({
    tags: tag._id,
    status: 'published'
  });

  res.status(200).json({
    status: 'success',
    results: posts.length,
    total,
    data: {
      tag,
      posts
    }
  });
});

// Analytics Controllers
exports.getViewsAnalytics = catchAsync(async (req, res) => {
  const views = await Blog.aggregate([
    {
      $match: {
        status: 'published'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$publishDate'
          }
        },
        totalViews: { $sum: '$viewCount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      views
    }
  });
});

exports.getPopularPosts = catchAsync(async (req, res) => {
  const posts = await Blog.find({ status: 'published' })
    .sort('-viewCount')
    .limit(10)
    .select('title slug viewCount publishDate');

  res.status(200).json({
    status: 'success',
    data: {
      posts
    }
  });
});

exports.getEngagementMetrics = catchAsync(async (req, res) => {
  const metrics = await Blog.aggregate([
    {
      $match: {
        status: 'published'
      }
    },
    {
      $lookup: {
        from: 'blogcomments',
        localField: '_id',
        foreignField: 'blog',
        as: 'comments'
      }
    },
    {
      $project: {
        title: 1,
        slug: 1,
        viewCount: 1,
        commentCount: { $size: '$comments' },
        engagement: {
          $divide: [
            { $size: '$comments' },
            { $cond: [{ $eq: ['$viewCount', 0] }, 1, '$viewCount'] }
          ]
        }
      }
    },
    { $sort: { engagement: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      metrics
    }
  });
});