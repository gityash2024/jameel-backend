const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Variant'
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    }
  }],
  shippingAddress: {
    firstName: String,
    lastName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },
  billingAddress: {
    firstName: String,
    lastName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'cash_on_delivery', 'bank_transfer']
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'],
    default: 'pending'
  },
  subTotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true,
    default: 0
  },
  shippingCost: {
    type: Number,
    required: true,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  coupon: {
    code: {
      type: String,
      trim: true,
      uppercase: true
    },
    value: {
      type: Number
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon'
    }
  },
  total: {
    type: Number,
    required: true
  },
  couponCode: {
    type: String
  },
  shippingMethod: {
    type: String,
    required: true
  },
  shipping: {
    trackingNumber: {
      type: String,
      trim: true,
    },
    trackingUrl: {
      type: String,
      trim: true,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    carrier: {
      type: String,
      default: 'FedEx',
      enum: ['FedEx', 'USPS', 'UPS', 'DHL', 'Other'],
    },
    serviceType: {
      type: String,
      trim: true,
    },
    estimatedDeliveryDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'ready_for_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'exception', 'returned', 'cancelled'],
      default: 'pending',
    },
    packageDetails: {
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
          type: String,
          default: 'IN',
          enum: ['IN', 'CM']
        }
      },
      packageType: String,
    },
    labelUrl: {
      type: String,
      trim: true,
    },
    shipmentId: {
      type: String,
      trim: true,
    },
    packageCount: {
      type: Number,
      default: 1
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    trackingHistory: [{
      status: {
        type: String,
        required: true
      },
      statusDetails: {
        type: String
      },
      location: {
        type: String
      },
      timestamp: {
        type: Date,
        required: true
      },
      isException: {
        type: Boolean,
        default: false
      }
    }],
    receivedBy: {
      type: String,
      trim: true
    },
    proofOfDeliveryUrl: {
      type: String,
      trim: true
    },
    signature: {
      type: String,
      trim: true
    },
    cancellationDate: {
      type: Date
    },
    comments: {
      type: String
    }
  },
  trackingNumber: String,
  actualDeliveryDate: Date,
  notes: String,
  cancelReason: String,
  returnReason: String,
  refundAmount: Number,
  paymentIntentId: String,
  invoiceNumber: String,
  isGift: {
    type: Boolean,
    default: false
  },
  giftMessage: String,
  layaway: {
    isLayaway: {
      type: Boolean,
      default: false
    },
    downPayment: Number,
    installments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Installment'
    }]
  }
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const count = await this.constructor.countDocuments() + 1;
    this.orderNumber = `ORD-${year}${month}-${count.toString().padStart(4, '0')}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;