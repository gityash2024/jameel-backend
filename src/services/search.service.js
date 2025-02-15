const Product = require('../models/product.model');

const searchProducts = async (query, page = 1, limit = 10) => {
  const products = await Product.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .skip((page - 1) * limit)
    .limit(limit)
    .exec();

  return products;
};

const getSearchSuggestions = async (query, limit = 5) => {
  const suggestions = await Product.find(
    { $text: { $search: query } },
    { name: 1, _id: 0 }
  )
    .limit(limit)
    .exec();

  return suggestions.map((suggestion) => suggestion.name);
};

module.exports = {
  searchProducts,
  getSearchSuggestions
};