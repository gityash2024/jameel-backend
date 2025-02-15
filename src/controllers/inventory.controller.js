// src/controllers/inventory.controller.js
const Inventory = require('../models/inventory.model');
const Product = require('../models/product.model');
const Store = require('../models/store.model');
const AppError = require('../utils/appError');
const {catchAsync} = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const { sendEmail } = require('../services/email.service');
const { createNotification } = require('../services/notification.service');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const path = require('path');

// Bulk operations
exports.bulkCreateInventory = catchAsync(async (req, res) => {
  const { items } = req.body;

  const inventoryItems = await Promise.all(
    items.map(async (item) => {
      // Validate product exists
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new AppError(`Product not found: ${item.productId}`, 404);
      }

      // Check if inventory already exists for this product and store
      const existingInventory = await Inventory.findOne({
        product: item.productId,
        store: item.storeId
      });

      if (existingInventory) {
        throw new AppError(`Inventory already exists for product ${item.productId} in this store`, 400);
      }

      return {
        product: item.productId,
        store: item.storeId,
        quantity: item.quantity,
        sku: item.sku || `${product.sku}-${item.storeId}`,
        lastStockUpdate: {
          date: new Date(),
          quantity: item.quantity,
          type: 'bulk_create',
          updatedBy: req.user._id
        }
      };
    })
  );

  const createdInventory = await Inventory.insertMany(inventoryItems);

  res.status(201).json({
    status: 'success',
    results: createdInventory.length,
    data: {
      inventory: createdInventory
    }
  });
});

exports.bulkUpdateInventory = catchAsync(async (req, res) => {
  const { items } = req.body;

  const updatedInventory = await Promise.all(
    items.map(async (item) => {
      const inventory = await Inventory.findById(item.id);
      
      if (!inventory) {
        throw new AppError(`Inventory item not found: ${item.id}`, 404);
      }

      // If quantity is provided, update it
      if (item.quantity !== undefined) {
        const quantityChange = item.quantity - inventory.quantity;
        
        inventory.quantity = item.quantity;
        inventory.lastStockUpdate = {
          date: new Date(),
          quantity: quantityChange,
          type: 'bulk_update',
          updatedBy: req.user._id
        };
      }

      // Update other fields if provided
      Object.assign(inventory, item);
      
      await inventory.save();
      return inventory;
    })
  );

  res.status(200).json({
    status: 'success',
    results: updatedInventory.length,
    data: {
      inventory: updatedInventory
    }
  });
});

// Alerts and Notifications
exports.getInventoryAlerts = catchAsync(async (req, res) => {
  const lowStockItems = await Inventory.find({
    $or: [
      {
        quantity: { $lte: '$lowStockAlert.threshold' },
        'lowStockAlert.enabled': true
      },
      { quantity: 0 }
    ]
  })
    .populate('product', 'name sku')
    .populate('store', 'name branchCode')
    .sort('quantity');

  res.status(200).json({
    status: 'success',
    results: lowStockItems.length,
    data: {
      alerts: lowStockItems
    }
  });
});

exports.updateAlertSettings = catchAsync(async (req, res) => {
  const { 
    lowStockThreshold, 
    notificationEmail, 
    enableNotifications 
  } = req.body;

  // Update global inventory alert settings
  const setting = await Setting.findOneAndUpdate(
    { group: 'inventory', key: 'alertSettings' },
    {
      value: {
        lowStockThreshold,
        notificationEmail,
        enableNotifications
      },
      dataType: 'object'
    },
    { upsert: true, new: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      alertSettings: setting.value
    }
  });
});

// Reports and Analytics
exports.getStockMovementsReport = catchAsync(async (req, res) => {
  const { startDate, endDate, storeId } = req.query;

  const matchStage = {
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (storeId) {
    matchStage.store = mongoose.Types.ObjectId(storeId);
  }

  const stockMovements = await Inventory.aggregate([
    {
      $match: matchStage
    },
    {
      $group: {
        _id: {
          product: '$product',
          type: '$lastStockUpdate.type'
        },
        totalQuantity: { $sum: '$lastStockUpdate.quantity' },
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id.product',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    { $unwind: '$productDetails' }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stockMovements
    }
  });
});

exports.getInventoryTurnoverAnalytics = catchAsync(async (req, res) => {
  const turnoverAnalytics = await Inventory.aggregate([
    {
      $lookup: {
        from: 'orders',
        let: { productId: '$product' },
        pipeline: [
          {
            $unwind: '$items'
          },
          {
            $match: {
              $expr: {
                $eq: ['$items.product', '$$productId']
              }
            }
          }
        ],
        as: 'sales'
      }
    },
    {
      $addFields: {
        totalSold: { $sum: '$sales.items.quantity' }
      }
    },
    {
      $project: {
        product: 1,
        quantity: 1,
        totalSold: 1,
        turnoverRate: {
          $divide: ['$totalSold', { $max: ['$quantity', 1] }]
        }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    { $unwind: '$productDetails' },
    { $sort: { turnoverRate: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      turnoverAnalytics
    }
  });
});

exports.getInventoryPerformanceMetrics = catchAsync(async (req, res) => {
  const performanceMetrics = await Inventory.aggregate([
    {
      $lookup: {
        from: 'orders',
        let: { productId: '$product' },
        pipeline: [
          {
            $unwind: '$items'
          },
          {
            $match: {
              $expr: {
                $eq: ['$items.product', '$$productId']
              }
            }
          }
        ],
        as: 'sales'
      }
    },
    {
      $addFields: {
        totalSold: { $sum: '$sales.items.quantity' },
        totalRevenue: { $sum: '$sales.items.total' }
      }
    },
    {
      $project: {
        product: 1,
        quantity: 1,
        totalSold: 1,
        totalRevenue: 1,
        stockValue: { $multiply: ['$quantity', '$productDetails.regularPrice'] },
        profitability: {
          $divide: ['$totalRevenue', { $max: ['$quantity', 1] }]
        }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    { $unwind: '$productDetails' },
    { $sort: { profitability: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      performanceMetrics
    }
  });
});

// CSV Export/Import functionality
exports.exportInventoryCSV = catchAsync(async (req, res) => {
  const inventory = await Inventory.find()
    .populate('product', 'name sku')
    .populate('store', 'name branchCode');

  const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
  
  const csvStringifier = createCsvStringifier({
    header: [
      { id: 'product', title: 'Product Name' },
      { id: 'sku', title: 'SKU' },
      { id: 'store', title: 'Store' },
      { id: 'quantity', title: 'Quantity' },
      { id: 'location', title: 'Location' }
    ]
  });

  const records = inventory.map(item => ({
    product: item.product.name,
    sku: item.sku,
    store: item.store.name,
    quantity: item.quantity,
    location: `${item.location?.aisle || ''} ${item.location?.shelf || ''} ${item.location?.bin || ''}`.trim()
  }));

  const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

  res.attachment('inventory.csv');
  res.status(200).send(csv);
});

// Upload middleware for CSV import
exports.uploadCSV = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
      cb(null, `inventory-${Date.now()}.csv`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV files are allowed', 400), false);
    }
  }
}).single('file');

exports.importInventoryCSV = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }

  const results = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', async (data) => {
      try {
        // Find product by SKU
        const product = await Product.findOne({ sku: data.SKU });
        if (!product) {
          errors.push(`Product with SKU ${data.SKU} not found`);
          return;
        }

        // Find store by name
        const store = await Store.findOne({ name: data.Store });
        if (!store) {
          errors.push(`Store ${data.Store} not found`);
          return;
        }

        // Create or update inventory
        const inventory = await Inventory.findOneAndUpdate(
          { 
            product: product._id, 
            store: store._id 
          },
          {
            quantity: parseInt(data.Quantity),
            location: {
              aisle: data.Aisle || '',
              shelf: data.Shelf || '',
              bin: data.Bin || ''
            },
            lastStockUpdate: {
              date: new Date(),
              quantity: parseInt(data.Quantity),
              type: 'csv_import',
              updatedBy: req.user._id
            }
          },
          { upsert: true, new: true }
        );

        results.push(inventory);
      } catch (error) {
        errors.push(error.message);
      }
    })
    .on('end', async () => {
      // Remove the uploaded file
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        status: 'success',
        results: results.length,
        data: {
          inventory: results,
          errors
        }
      });
    });
});
exports.getAllInventory = catchAsync(async (req, res) => {
  const features = new APIFeatures(
    Inventory.find()
      .populate('product', 'name sku images')
      .populate('variant', 'sku attributes')
      .populate('store', 'name branchCode'),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const inventory = await features.query;
  const total = await Inventory.countDocuments();

  res.status(200).json({
    status: 'success',
    results: inventory.length,
    total,
    data: {
      inventory
    }
  });
});

exports.getLowStockItems = catchAsync(async (req, res) => {
  const lowStockItems = await Inventory.find({
    $or: [
      {
        quantity: { $lte: '$lowStockAlert.threshold' },
        'lowStockAlert.enabled': true
      },
      { quantity: 0 }
    ]
  })
    .populate('product', 'name sku images regularPrice')
    .populate('variant', 'sku attributes')
    .populate('store', 'name branchCode')
    .sort('quantity');

  res.status(200).json({
    status: 'success',
    results: lowStockItems.length,
    data: {
      inventory: lowStockItems
    }
  });
});




exports.getOutOfStockItems = catchAsync(async (req, res) => {
  const outOfStockItems = await Inventory.find({ quantity: 0 })
    .populate('product', 'name sku images regularPrice')
    .populate('variant', 'sku attributes')
    .populate('store', 'name branchCode')
    .sort('updatedAt');

  res.status(200).json({
    status: 'success',
    results: outOfStockItems.length,
    data: {
      inventory: outOfStockItems
    }
  });
});

exports.getStoreInventory = catchAsync(async (req, res, next) => {
  const store = await Store.findById(req.params.storeId);
  if (!store) {
    return next(new AppError('Store not found', 404));
  }

  const features = new APIFeatures(
    Inventory.find({ store: req.params.storeId })
      .populate('product', 'name sku images regularPrice')
      .populate('variant', 'sku attributes')
      .populate('store', 'name branchCode'),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const inventory = await features.query;
  const total = await Inventory.countDocuments({ store: req.params.storeId });

  res.status(200).json({
    status: 'success',
    results: inventory.length,
    total,
    data: {
      store,
      inventory
    }
  });
});

exports.getInventoryItemById = catchAsync(async (req, res, next) => {
  const inventory = await Inventory.findById(req.params.id)
    .populate('product', 'name sku images regularPrice')
    .populate('variant', 'sku attributes')
    .populate('store', 'name branchCode');

  if (!inventory) {
    return next(new AppError('Inventory item not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

exports.createInventoryItem = catchAsync(async (req, res, next) => {
  // Validate product and variant
  const product = await Product.findById(req.body.productId);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  if (req.body.variantId) {
    const variant = await Variant.findOne({
      _id: req.body.variantId,
      product: req.body.productId
    });
    if (!variant) {
      return next(new AppError('Variant not found', 404));
    }
  }

  // Check if inventory already exists
  const existingInventory = await Inventory.findOne({
    product: req.body.productId,
    variant: req.body.variantId || null,
    store: req.body.storeId
  });

  if (existingInventory) {
    return next(new AppError('Inventory already exists for this product/variant in the store', 400));
  }

  const inventory = await Inventory.create({
    product: req.body.productId,
    variant: req.body.variantId,
    store: req.body.storeId,
    quantity: req.body.quantity,
    sku: req.body.sku,
    location: req.body.location,
    lowStockAlert: req.body.lowStockAlert
  });

  res.status(201).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

exports.updateInventoryItem = catchAsync(async (req, res, next) => {
  const inventory = await Inventory.findById(req.params.id);
  if (!inventory) {
    return next(new AppError('Inventory item not found', 404));
  }

  Object.assign(inventory, req.body);
  await inventory.save();

  res.status(200).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

exports.adjustStock = catchAsync(async (req, res, next) => {
  const { adjustmentType, quantity, reason, notes } = req.body;
  
  const inventory = await Inventory.findById(req.params.id);
  if (!inventory) {
    return next(new AppError('Inventory item not found', 404));
  }

  let newQuantity;
  switch (adjustmentType) {
    case 'add':
      newQuantity = inventory.quantity + quantity;
      break;
    case 'remove':
      newQuantity = inventory.quantity - quantity;
      if (newQuantity < 0) {
        return next(new AppError('Insufficient stock', 400));
      }
      break;
    case 'set':
      newQuantity = quantity;
      break;
    default:
      return next(new AppError('Invalid adjustment type', 400));
  }

  inventory.quantity = newQuantity;
  inventory.lastStockUpdate = {
    date: new Date(),
    quantity,
    type: adjustmentType,
    note: notes,
    updatedBy: req.user._id
  };

  await inventory.save();

  // Send low stock notification if applicable
  if (inventory.lowStockAlert.enabled && 
      inventory.quantity <= inventory.lowStockAlert.threshold) {
    await sendLowStockNotification(inventory);
  }

  res.status(200).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

exports.transferStock = catchAsync(async (req, res, next) => {
  const { fromStoreId, toStoreId, items } = req.body;

  // Validate stores
  const [fromStore, toStore] = await Promise.all([
    Store.findById(fromStoreId),
    Store.findById(toStoreId)
  ]);

  if (!fromStore || !toStore) {
    return next(new AppError('Store not found', 404));
  }

  // Process transfer
  const transferResults = await Promise.all(
    items.map(async (item) => {
      const sourceInventory = await Inventory.findOne({
        product: item.productId,
        store: fromStoreId
      });

      if (!sourceInventory || sourceInventory.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for product ${item.productId}`, 400);
      }

      let destinationInventory = await Inventory.findOne({
        product: item.productId,
        store: toStoreId
      });

      // Reduce source inventory
      sourceInventory.quantity -= item.quantity;
      sourceInventory.lastStockUpdate = {
        date: new Date(),
        quantity: -item.quantity,
        type: 'transfer_out',
        note: `Transferred to ${toStore.name}`,
        updatedBy: req.user._id
      };

      // Increase destination inventory
      if (destinationInventory) {
        destinationInventory.quantity += item.quantity;
        destinationInventory.lastStockUpdate = {
          date: new Date(),
          quantity: item.quantity,
          type: 'transfer_in',
          note: `Transferred from ${fromStore.name}`,
          updatedBy: req.user._id
        };
      } else {
        destinationInventory = new Inventory({
          product: item.productId,
          store: toStoreId,
          quantity: item.quantity,
          sku: sourceInventory.sku,
          lastStockUpdate: {
            date: new Date(),
            quantity: item.quantity,
            type: 'transfer_in',
            note: `Transferred from ${fromStore.name}`,
            updatedBy: req.user._id
          }
        });
      }

      await Promise.all([
        sourceInventory.save(),
        destinationInventory.save()
      ]);

      return {
        product: item.productId,
        quantity: item.quantity,
        fromStore: fromStoreId,
        toStore: toStoreId
      };
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      transfers: transferResults
    }
  });
});

exports.recordStockCount = catchAsync(async (req, res, next) => {
  const { storeId, countedBy, items, notes } = req.body;

  const stockCount = {
    date: new Date(),
    countedBy,
    notes,
    items: []
  };

  await Promise.all(
    items.map(async (item) => {
      const inventory = await Inventory.findOne({
        product: item.productId,
        store: storeId
      });

      if (!inventory) {
        return next(new AppError(`Inventory not found for product ${item.productId}`, 404));
      }

      const discrepancy = item.countedQuantity - inventory.quantity;
      
      stockCount.items.push({
        product: item.productId,
        systemQuantity: inventory.quantity,
        countedQuantity: item.countedQuantity,
        discrepancy
      });

      if (discrepancy !== 0) {
        inventory.quantity = item.countedQuantity;
        inventory.lastStockUpdate = {
          date: new Date(),
          quantity: discrepancy,
          type: 'stock_count',
          note: notes,
          updatedBy: countedBy
        };
        await inventory.save();
      }
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      stockCount
    }
  });
});

exports.reconcileInventory = catchAsync(async (req, res, next) => {
  const { storeId, items, reason } = req.body;

  const reconciliations = await Promise.all(
    items.map(async (item) => {
      const inventory = await Inventory.findOne({
        product: item.productId,
        store: storeId
      });

      if (!inventory) {
        return next(new AppError(`Inventory not found for product ${item.productId}`, 404));
      }

      const adjustment = item.adjustedQuantity - inventory.quantity;
      inventory.quantity = item.adjustedQuantity;
      inventory.lastStockUpdate = {
        date: new Date(),
        quantity: adjustment,
        type: 'reconciliation',
        note: reason,
        updatedBy: req.user._id
      };

      await inventory.save();

      return {
        product: item.productId,
        previousQuantity: inventory.quantity - adjustment,
        adjustedQuantity: inventory.quantity,
        adjustment
      };
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      reconciliations
    }
  });
});

exports.getStockLevelsReport = catchAsync(async (req, res) => {
  const stockLevels = await Inventory.aggregate([
    {
      $group: {
        _id: '$store',
        totalItems: { $sum: 1 },
        totalUnits: { $sum: '$quantity' },
        lowStockItems: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $lte: ['$quantity', '$lowStockAlert.threshold'] },
                  '$lowStockAlert.enabled'
                ]
              },
              1,
              0
            ]
          }
        },
        outOfStockItems: {
          $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: 'stores',
        localField: '_id',
        foreignField: '_id',
        as: 'store'
      }
    },
    { $unwind: '$store' }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stockLevels
    }
  });
});

// Helper Functions

const sendLowStockNotification = async (inventory) => {
  const product = await Product.findById(inventory.product);
  const store = await Store.findById(inventory.store);

  // Send email notification
  await sendEmail(
    process.env.INVENTORY_NOTIFICATION_EMAIL,
    'Low Stock Alert',
    'low-stock-alert',
    {
      product: product.name,
      sku: inventory.sku,
      quantity: inventory.quantity,
      threshold: inventory.lowStockAlert.threshold,
      store: store.name
    }
  );

  // Create system notification
  await createNotification(
    null,
    'system',
    'Low Stock Alert',
    `${product.name} (${inventory.sku}) is running low on stock at ${store.name}`
  );
};