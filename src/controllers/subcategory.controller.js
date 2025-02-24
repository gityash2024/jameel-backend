
// controllers/subcategory.controller.js
const Subcategory = require('../models/subcategory.model');
const Category = require('../models/category.model');

exports.getAllSubcategories = async (req, res) => {
  try {
    const filter = {};
    
    // Filter by category if provided
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    const subcategories = await Subcategory.find(filter)
      .populate('category', 'name')
      .sort('-createdAt');
      
    res.status(200).json({
      status: 'success',
      results: subcategories.length,
      data: subcategories
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getSubcategoriesByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found'
      });
    }
    
    const subcategories = await Subcategory.find({ category: categoryId })
      .populate('category', 'name')
      .sort('-createdAt');
      
    res.status(200).json({
      status: 'success',
      results: subcategories.length,
      data: subcategories
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getSubcategory = async (req, res) => {
  try {
    const subcategory = await Subcategory.findById(req.params.id)
      .populate('category', 'name');
      
    if (!subcategory) {
      return res.status(404).json({
        status: 'error',
        message: 'Subcategory not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: subcategory
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.createSubcategory = async (req, res) => {
  try {
    // Check if category exists
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Category not found'
      });
    }
    
    const subcategory = await Subcategory.create(req.body);
    
    // Populate category details in response
    await subcategory.populate('category', 'name');
    
    res.status(201).json({
      status: 'success',
      data: subcategory
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.updateSubcategory = async (req, res) => {
  try {
    // If category is being updated, check if new category exists
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          status: 'error',
          message: 'Category not found'
        });
      }
    }
    
    const subcategory = await Subcategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('category', 'name');
    
    if (!subcategory) {
      return res.status(404).json({
        status: 'error',
        message: 'Subcategory not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: subcategory
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.deleteSubcategory = async (req, res) => {
  try {
    const subcategory = await Subcategory.findByIdAndDelete(req.params.id);
    
    if (!subcategory) {
      return res.status(404).json({
        status: 'error',
        message: 'Subcategory not found'
      });
    }
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

