// src/controllers/cart.controller.js
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const Variant = require('../models/variant.model');
const Coupon = require('../models/coupon.model');
const Inventory = require('../models/inventory.model');
const {AppError} = require('../utils/appError');
const {catchAsync} = require('../utils/appError');

exports.getCart = catchAsync(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id })
    .populate({
      path: 'items.product',
      select: 'name images sku regularPrice salePrice'
    })
    .populate({
      path: 'items.variant',
      select: 'sku attributes price salePrice images'
    });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id });
  }

  // Calculate cart totals
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.addItem = catchAsync(async (req, res, next) => {
  const { productId, variantId, quantity } = req.body;

  // Validate product and check inventory
  const product = await Product.findById(productId);
  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  // Check if variant exists if provided
  let variant;
  if (variantId) {
    variant = await Variant.findOne({
      _id: variantId,
      product: productId
    });
    if (!variant) {
      return next(new AppError('Variant not found', 404));
    }
  }

  // Check inventory
  // const inventoryItem = await Inventory.findOne({
  //   product: productId,
  //   variant: variantId || null
  // });

  // if (!inventoryItem || inventoryItem.quantity < quantity) {
  //   return next(new AppError('Insufficient inventory', 400));
  // }

  // Get or create cart
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(item => 
    item.product.toString() === productId && 
    (variantId ? item.variant?.toString() === variantId : !item.variant)
  );

  if (existingItemIndex > -1) {
    // Update existing item quantity
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;
    if (newQuantity > inventoryItem.quantity) {
      return next(new AppError('Insufficient inventory', 400));
    }
    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    // Add new item
    const price = variant ? variant.salePrice || variant.price : product.salePrice || product.regularPrice;
    cart.items.push({
      product: productId,
      variant: variantId,
      quantity,
      price,
      total: price * quantity
    });
  }

  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.updateItem = catchAsync(async (req, res, next) => {
  const { quantity } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const itemIndex = cart.items.findIndex(item => 
    item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(new AppError('Item not found in cart', 404));
  }

  // Check inventory
  // const inventoryItem = await Inventory.findOne({
  //   product: cart.items[itemIndex].product,
  //   variant: cart.items[itemIndex].variant || null
  // });

  // if (!inventoryItem || inventoryItem.quantity < quantity) {
  //   return next(new AppError('Insufficient inventory', 400));
  // }

  cart.items[itemIndex].quantity = quantity;
  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.removeItem = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  cart.items = cart.items.filter(item => 
    item._id.toString() !== req.params.itemId
  );

  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.clearCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = [];
    cart.couponCode = null;
    cart.discount = 0;
    await cart.save();
    await calculateCartTotals(cart);
  }

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.applyCoupon = catchAsync(async (req, res, next) => {
  const { code } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });

  if (!coupon) {
    return next(new AppError('Invalid or expired coupon', 400));
  }

  // Validate coupon usage limits
  if (coupon.usageLimit.perCoupon && coupon.usageCount >= coupon.usageLimit.perCoupon) {
    return next(new AppError('Coupon usage limit reached', 400));
  }

  const userUsage = await Cart.countDocuments({
    user: req.user._id,
    couponCode: code.toUpperCase()
  });

  if (coupon.usageLimit.perUser && userUsage >= coupon.usageLimit.perUser) {
    return next(new AppError('You have reached the usage limit for this coupon', 400));
  }

  // Validate minimum purchase
  if (coupon.minPurchase && cart.subTotal < coupon.minPurchase) {
    return next(new AppError(`Minimum purchase amount of ${coupon.minPurchase} required`, 400));
  }

  // Apply coupon
  cart.couponCode = code.toUpperCase();
  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.removeCoupon = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  cart.couponCode = null;
  cart.discount = 0;
  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.calculateShipping = catchAsync(async (req, res, next) => {
  const { addressId } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  // Calculate shipping cost based on address and cart items
  const shippingCost = await calculateShippingCost(cart, addressId);
  cart.shippingCost = shippingCost;
  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.saveForLater = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const itemIndex = cart.items.findIndex(item => 
    item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(new AppError('Item not found in cart', 404));
  }

  // Move item to savedItems
  const item = cart.items[itemIndex];
  if (!cart.savedItems) {
    cart.savedItems = [];
  }
  cart.savedItems.push(item);
  cart.items.splice(itemIndex, 1);

  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.moveToCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const itemIndex = cart.savedItems.findIndex(item => 
    item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(new AppError('Item not found in saved items', 404));
  }

  // Check inventory before moving
  const item = cart.savedItems[itemIndex];
  const inventoryItem = await Inventory.findOne({
    product: item.product,
    variant: item.variant || null
  });

  if (!inventoryItem || inventoryItem.quantity < item.quantity) {
    return next(new AppError('Insufficient inventory', 400));
  }

  // Move item to cart
  cart.items.push(item);
  cart.savedItems.splice(itemIndex, 1);

  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.getSavedItems = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id })
    .populate({
      path: 'savedItems.product',
      select: 'name images sku regularPrice salePrice'
    })
    .populate({
      path: 'savedItems.variant',
      select: 'sku attributes price salePrice images'
    });

  res.status(200).json({
    status: 'success',
    data: {
      savedItems: cart ? cart.savedItems : []
    }
  });
});

exports.mergeCart = catchAsync(async (req, res) => {
  const { items } = req.body;
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      items: []
    });
  }

  // Merge items
  for (const item of items) {
    const existingItemIndex = cart.items.findIndex(cartItem => 
      cartItem.product.toString() === item.productId &&
      (item.variantId ? cartItem.variant?.toString() === item.variantId : !cartItem.variant)
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += item.quantity;
    } else {
      const product = await Product.findById(item.productId);
      const variant = item.variantId ? await Variant.findById(item.variantId) : null;
      
      if (product) {
        const price = variant ? variant.salePrice || variant.price : product.salePrice || product.regularPrice;
        cart.items.push({
          product: item.productId,
          variant: item.variantId,
          quantity: item.quantity,
          price,
          total: price * item.quantity
        });
      }
    }
  }

  await cart.save();
  await calculateCartTotals(cart);

  res.status(200).json({
    status: 'success',
    data: {
      cart
    }
  });
});

exports.getCartSummary = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id })
    .populate({
      path: 'items.product',
      select: 'name images'
    });

  if (!cart) {
    return res.status(200).json({
      status: 'success',
      data: {
        itemCount: 0,
        total: 0
      }
    });
  }

  const summary = {
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    total: cart.total,
    items: cart.items.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      total: item.total
    }))
  };

  res.status(200).json({
    status: 'success',
    data: summary
  });
});

// Helper Functions

const calculateCartTotals = async (cart) => {
  // Calculate subtotal
  cart.subTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Apply coupon if exists
  if (cart.couponCode) {
    const coupon = await Coupon.findOne({ code: cart.couponCode });
    if (coupon) {
      if (coupon.type === 'percentage') {
        cart.discount = (cart.subTotal * coupon.value) / 100;
      } else if (coupon.type === 'fixed') {
        cart.discount = coupon.value;
      } else if (coupon.type === 'free_shipping') {
        cart.shippingCost = 0;
      }

      // Apply maximum discount if set
      if (coupon.maxDiscount && cart.discount > coupon.maxDiscount) {
        cart.discount = coupon.maxDiscount;
      }
    }
  }

  // Calculate tax (if applicable)
  cart.tax = ((cart.subTotal - cart.discount) * (process.env.TAX_RATE || 0)) / 100;

  // Calculate total
  cart.total = cart.subTotal + cart.tax + cart.shippingCost - cart.discount;

  await cart.save();
  return cart;
};

const calculateShippingCost = async (cart, addressId) => {
  // Get address details
  const address = await Address.findById(addressId);
  if (!address) {
    throw new AppError('Address not found', 404);
  }

  // Get shipping zones and rates
  const shippingZone = await Shipping.findOne({
    'zones.countries': address.country,
    'zones.states': address.state
  });

  if (!shippingZone) {
    throw new AppError('Shipping not available for this location', 400);
  }

  // Calculate total weight and dimensions
  let totalWeight = 0;
  let totalVolume = 0;

  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    const variant = item.variant ? await Variant.findById(item.variant) : null;

    // Use variant weight/dimensions if available, otherwise use product's
    const weight = (variant?.weight?.value || product.weight?.value || 0) * item.quantity;
    totalWeight += weight;

    if (product.dimensions || variant?.dimensions) {
      const dims = variant?.dimensions || product.dimensions;
      const volume = dims.length * dims.width * dims.height * item.quantity;
      totalVolume += volume;
    }
  }

  // Find applicable rate based on weight
  const zone = shippingZone.zones.find(z => 
    z.countries.includes(address.country) && 
    (!z.states.length || z.states.includes(address.state))
  );

  const rate = zone.rates.find(r => 
    totalWeight >= r.minWeight && 
    (!r.maxWeight || totalWeight <= r.maxWeight)
  );

  if (!rate) {
    throw new AppError('No shipping rate available for this order', 400);
  }

  let shippingCost = rate.price;

  // Apply dimensional weight if applicable
  const dimensionalWeight = totalVolume / 5000; // Industry standard divisor
  if (dimensionalWeight > totalWeight) {
    const dimensionalRate = zone.rates.find(r => 
      dimensionalWeight >= r.minWeight && 
      (!r.maxWeight || dimensionalWeight <= r.maxWeight)
    );
    if (dimensionalRate && dimensionalRate.price > shippingCost) {
      shippingCost = dimensionalRate.price;
    }
  }

  // Apply additional fees
  if (shippingZone.conditions) {
    // Handling fee
    if (shippingZone.conditions.handlelingFee) {
      shippingCost += shippingZone.conditions.handlelingFee;
    }

    // Additional fees based on item value
    if (shippingZone.conditions.additionalFees) {
      for (const fee of shippingZone.conditions.additionalFees) {
        if (fee.type === 'fixed') {
          shippingCost += fee.amount;
        } else if (fee.type === 'percentage') {
          shippingCost += (cart.subTotal * fee.amount) / 100;
        }
      }
    }

    // Free shipping threshold
    if (shippingZone.conditions.freeShippingThreshold && 
        cart.subTotal >= shippingZone.conditions.freeShippingThreshold) {
      return 0;
    }
  }

  // Apply insurance if required
  if (shippingZone.restrictions?.isInsured) {
    const insuranceRate = (cart.subTotal * (process.env.INSURANCE_RATE || 1)) / 100;
    shippingCost += insuranceRate;
  }

  // Apply minimum shipping cost if set
  const minShippingCost = process.env.MIN_SHIPPING_COST || 0;
  if (shippingCost < minShippingCost) {
    shippingCost = minShippingCost;
  }

  return Math.round(shippingCost * 100) / 100; // Round to 2 decimal places
};
  