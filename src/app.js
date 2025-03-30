const userRouter = require('./routes/user.routes');
const productsRouter = require('./routes/product.routes');
const categoryRouter = require('./routes/category.routes');
const subcategoryRouter = require('./routes/subcategory.routes');
const tagRouter = require('./routes/tag.routes');
const orderRouter = require('./routes/order.routes');
const reviewRouter = require('./routes/review.routes');
const paymentRouter = require('./routes/payment.routes');
// const couponRouter = require('./routes/coupon.routes');
const tempRouter = require('./routes/temp.routes');
const appointmentRouter = require('./routes/appointment.routes');
const mediaRouter = require('./routes/media.routes');

// ROUTES
app.use('/api/v1/user', userRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/subcategories', subcategoryRouter);
app.use('/api/v1/tags', tagRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/payments', paymentRouter);
// app.use('/api/v1/coupons', couponRouter); 
app.use('/api/v1/temp', tempRouter);
app.use('/api/v1/appointments', appointmentRouter);
app.use('/api/v1/files', mediaRouter); 