// src/utils/apiFeatures.js
class APIFeatures {
    constructor(query, queryString) {
      this.query = query;
      this.queryString = queryString;
    }
  
    filter() {
      // 1) Basic Filtering
      const queryObj = { ...this.queryString };
      const excludedFields = ['page', 'sort', 'limit', 'fields', 'search', 'q'];
      excludedFields.forEach(el => delete queryObj[el]);
  
      // 2) Advanced Filtering
      let queryStr = JSON.stringify(queryObj);
      queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
  
      this.query = this.query.find(JSON.parse(queryStr));
  
      return this;
    }
  
    search(searchFields = []) {
      if (this.queryString.search || this.queryString.q) {
        const searchTerm = this.queryString.search || this.queryString.q;
        const searchQuery = searchFields.map(field => ({
          [field]: { $regex: searchTerm, $options: 'i' }
        }));
        
        this.query = this.query.find({ $or: searchQuery });
      }
      return this;
    }
  
    sort() {
      if (this.queryString.sort) {
        const sortBy = this.queryString.sort.split(',').join(' ');
        this.query = this.query.sort(sortBy);
      } else {
        // Default sort by creation date
        this.query = this.query.sort('-createdAt');
      }
      return this;
    }
  
    limitFields() {
      if (this.queryString.fields) {
        const fields = this.queryString.fields.split(',').join(' ');
        this.query = this.query.select(fields);
      } else {
        // Exclude internal fields by default
        this.query = this.query.select('-__v');
      }
      return this;
    }
  
    paginate() {
      const page = parseInt(this.queryString.page, 10) || 1;
      const limit = parseInt(this.queryString.limit, 10) || 10;
      const skip = (page - 1) * limit;
  
      this.query = this.query.skip(skip).limit(limit);
      return this;
    }
  
    // Additional feature for population
    populate(options) {
      if (options) {
        this.query = this.query.populate(options);
      }
      return this;
    }
  
    // Feature for date range filtering
    dateFilter(fieldName) {
      if (this.queryString.startDate && this.queryString.endDate) {
        this.query = this.query.find({
          [fieldName]: {
            $gte: new Date(this.queryString.startDate),
            $lte: new Date(this.queryString.endDate)
          }
        });
      }
      return this;
    }
  
    // Feature for price range filtering
    priceFilter() {
      if (this.queryString.minPrice || this.queryString.maxPrice) {
        const priceFilter = {};
        if (this.queryString.minPrice) {
          priceFilter.$gte = parseFloat(this.queryString.minPrice);
        }
        if (this.queryString.maxPrice) {
          priceFilter.$lte = parseFloat(this.queryString.maxPrice);
        }
        this.query = this.query.find({ price: priceFilter });
      }
      return this;
    }
  
    // Feature for geographical queries
    geoNear(options) {
      if (options.longitude && options.latitude && options.distance) {
        this.query = this.query.find({
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [options.longitude, options.latitude]
              },
              $maxDistance: options.distance * 1000 // Convert to meters
            }
          }
        });
      }
      return this;
    }
  
    // Feature for full-text search
    fullTextSearch(searchTerm) {
      if (searchTerm) {
        this.query = this.query.find(
          { $text: { $search: searchTerm } },
          { score: { $meta: 'textScore' } }
        ).sort({ score: { $meta: 'textScore' } });
      }
      return this;
    }
  
    // Feature for aggregation pipeline
    aggregate(pipeline) {
      if (pipeline && Array.isArray(pipeline)) {
        this.query = this.query.aggregate(pipeline);
      }
      return this;
    }
  }
  
  module.exports = APIFeatures;