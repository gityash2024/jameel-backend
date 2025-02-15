// src/controllers/dashboard.controller.js
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Review = require('../models/review.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const DateTimeUtil = require('../utils/dateTime');

exports.getOverviewStats = catchAsync(async (req, res) => {
  const today = new Date();
  const startOfDay = DateTimeUtil.startOf(today, 'day');
  const startOfMonth = DateTimeUtil.startOf(today, 'month');
  const startOfYear = DateTimeUtil.startOf(today, 'year');

  // Get statistics
  const [
    totalOrders,
    todayOrders,
    monthOrders,
    totalRevenue,
    todayRevenue,
    monthRevenue,
    totalCustomers,
    newCustomersToday,
    newCustomersMonth,
    totalProducts,
    lowStockProducts,
    outOfStockProducts
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ 
      role: 'customer',
      createdAt: { $gte: startOfDay }
    }),
    User.countDocuments({
      role: 'customer',
      createdAt: { $gte: startOfMonth }
    }),
    Product.countDocuments(),
    Product.countDocuments({ stockQuantity: { $lte: 10 } }),
    Product.countDocuments({ stockQuantity: 0 })
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      orders: {
        total: totalOrders,
        today: todayOrders,
        month: monthOrders
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        today: todayRevenue[0]?.total || 0,
        month: monthRevenue[0]?.total || 0
      },
      customers: {
        total: totalCustomers,
        newToday: newCustomersToday,
        newThisMonth: newCustomersMonth
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts,
        outOfStock: outOfStockProducts
      }
    }
  });
});

exports.getRevenueAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate, interval = 'day' } = req.query;

  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: { $nin: ['cancelled', 'refunded'] }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: interval === 'month' ? '%Y-%m' : '%Y-%m-%d',
            date: '$createdAt'
          }
        },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
        averageOrderValue: { $avg: '$total' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const revenueData = await Order.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      revenueData
    }
  });
});

exports.getProductAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: { $nin: ['cancelled', 'refunded'] }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        orderCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        name: '$product.name',
        sku: '$product.sku',
        totalQuantity: 1,
        totalRevenue: 1,
        orderCount: 1,
        averageOrderValue: { $divide: ['$totalRevenue', '$orderCount'] }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ];

  const productAnalytics = await Order.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      productAnalytics
    }
  });
});

exports.getCustomerAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: { $nin: ['cancelled', 'refunded'] }
      }
    },
    {
      $group: {
        _id: '$user',
        orderCount: { $sum: 1 },
        totalSpent: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        name: { 
          $concat: ['$user.firstName', ' ', '$user.lastName']
        },
        email: '$user.email',
        orderCount: 1,
        totalSpent: 1,
        averageOrderValue: 1,
        lastOrder: { $max: '$createdAt' }
      }
    },
    { $sort: { totalSpent: -1 } }
  ];

  const customerAnalytics = await Order.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      customerAnalytics
    }
  });
});

exports.getInventoryAnalytics = catchAsync(async (req, res) => {
  const pipeline = [
    {
      $group: {
        _id: '$stockStatus',
        count: { $sum: 1 },
        totalValue: {
          $sum: { $multiply: ['$regularPrice', '$stockQuantity'] }
        }
      }
    }
  ];

  const inventoryAnalytics = await Product.aggregate(pipeline);

  // Get low stock alerts
  const lowStockProducts = await Product.find({
    stockQuantity: { $lte: 10, $gt: 0 }
  })
    .select('name sku stockQuantity regularPrice')
    .sort('stockQuantity');

  res.status(200).json({
    status: 'success',
    data: {
      inventoryAnalytics,
      lowStockProducts
    }
  });
});

exports.getAppointmentAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const pipeline = [
    {
      $match: {
        appointmentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ];

  const appointmentAnalytics = await Appointment.aggregate(pipeline);

  // Get upcoming appointments
  const upcomingAppointments = await Appointment.find({
    appointmentDate: { $gte: new Date() },
    status: { $in: ['scheduled', 'confirmed'] }
  })
    .populate('user', 'firstName lastName email')
    .populate('service', 'name')
    .sort('appointmentDate')
    .limit(10);

  res.status(200).json({
    status: 'success',
    data: {
      appointmentAnalytics,
      upcomingAppointments
    }
  });
});

exports.getReviewAnalytics = catchAsync(async (req, res) => {
  const pipeline = [
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: {
            rating: '$rating',
            count: 1
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        averageRating: 1,
        totalReviews: 1,
        ratingDistribution: {
          $reduce: {
            input: '$ratingDistribution',
            initialValue: {
              '1': 0, '2': 0, '3': 0, '4': 0, '5': 0
            },
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $literal: {
                    $concat: [
                      '$$this.rating',
                      ': ',
                      { $add: ['$$value.$$this.rating', 1] }
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    }
  ];

  const reviewAnalytics = await Review.aggregate(pipeline);

  // Get recent reviews
  const recentReviews = await Review.find()
    .populate('user', 'firstName lastName')
    .populate('product', 'name')
    .sort('-createdAt')
    .limit(10);

  res.status(200).json({
    status: 'success',
    data: {
      reviewAnalytics,
      recentReviews
    }
  });
});

exports.getSearchAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Implement search term analytics based on your search logging system
  // This is a placeholder implementation
  const searchAnalytics = {
    topSearchTerms: [],
    searchesWithNoResults: [],
    averageSearchResultsCount: 0
  };

  res.status(200).json({
    status: 'success',
    data: {
      searchAnalytics
    }
  });
});

exports.exportDashboardReport = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Gather all relevant data
  const [
    orderStats,
    productStats,
    customerStats,
    appointmentStats,
    reviewStats
  ] = await Promise.all([
    // Get order statistics
    Order.aggregate([
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
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]),
    // Get product statistics
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: {
            $sum: { $multiply: ['$regularPrice', '$stockQuantity'] }
          },
          averagePrice: { $avg: '$regularPrice' }
        }
      }
    ]),
    // Get customer statistics
    User.aggregate([
      {
        $match: {
          role: 'customer',
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          newCustomers: { $sum: 1 }
        }
      }
    ]),
    // Get appointment statistics
    Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalAppointments: { $sum: 1 },
          completedAppointments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]),
    // Get review statistics
    Review.aggregate([
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
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      }
    ])
  ]);

  // Format data for report
  const reportData = {
    period: {
      startDate,
      endDate
    },
    orders: orderStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0
    },
    products: productStats[0] || {
      totalProducts: 0,
      totalValue: 0,
      averagePrice: 0
    },
    customers: customerStats[0] || {
      totalCustomers: 0,
      newCustomers: 0
    },
    appointments: appointmentStats[0] || {
      totalAppointments: 0,
      completedAppointments: 0
    },
    reviews: reviewStats[0] || {
      totalReviews: 0,
      averageRating: 0
    }
  };

  // Generate CSV
  const csv = await generateReportCSV(reportData);

  res.attachment('dashboard-report.csv');
  res.status(200).send(csv);
});

exports.getPerformanceMetrics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Calculate key performance indicators
  const metrics = await Order.aggregate([
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
        _id: null,
        conversionRate: {
          $avg: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        averageOrderValue: { $avg: '$total' },
        totalRevenue: { $sum: '$total' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        conversionRate: { $multiply: ['$conversionRate', 100] },
        averageOrderValue: 1,
        totalRevenue: 1,
        orderCount: 1,
        revenuePerDay: {
          $divide: [
            '$totalRevenue',
            {
              $divide: [
                { $subtract: [new Date(endDate), new Date(startDate)] },
                1000 * 60 * 60 * 24
              ]
            }
          ]
        }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      metrics: metrics[0] || {
        conversionRate: 0,
        averageOrderValue: 0,
        totalRevenue: 0,
        orderCount: 0,
        revenuePerDay: 0
      }
    }
  });
});

exports.getCategoryPerformance = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const categoryStats = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        orders: { $sum: 1 },
        unitsSold: { $sum: '$items.quantity' }
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
        categoryName: '$category.name',
        revenue: 1,
        orders: 1,
        unitsSold: 1,
        averageOrderValue: { $divide: ['$revenue', '$orders'] }
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      categoryStats
    }
  });
});

// Helper Functions

const generateReportCSV = async (data) => {
  const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
  
  const csvStringifier = createCsvStringifier({
    header: [
      { id: 'metric', title: 'Metric' },
      { id: 'value', title: 'Value' }
    ]
  });

  const records = [
    { metric: 'Report Period', value: `${data.period.startDate} to ${data.period.endDate}` },
    { metric: 'Total Orders', value: data.orders.totalOrders },
    { metric: 'Total Revenue', value: data.orders.totalRevenue.toFixed(2) },
    { metric: 'Average Order Value', value: data.orders.averageOrderValue.toFixed(2) },
    { metric: 'Total Products', value: data.products.totalProducts },
    { metric: 'Inventory Value', value: data.products.totalValue.toFixed(2) },
    { metric: 'Average Product Price', value: data.products.averagePrice.toFixed(2) },
    { metric: 'Total Customers', value: data.customers.totalCustomers },
    { metric: 'New Customers', value: data.customers.newCustomers },
    { metric: 'Total Appointments', value: data.appointments.totalAppointments },
    { metric: 'Completed Appointments', value: data.appointments.completedAppointments },
    { metric: 'Total Reviews', value: data.reviews.totalReviews },
    { metric: 'Average Rating', value: data.reviews.averageRating.toFixed(1) }
  ];

  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
};