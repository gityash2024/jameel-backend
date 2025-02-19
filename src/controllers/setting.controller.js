// src/controllers/setting.controller.js
const Setting = require('../models/setting.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const cache = require('../middleware/cache.middleware');

exports.getPublicSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find({ isPublic: true })
    .select('-_id -__v -isPublic -lastUpdatedBy');

  const formattedSettings = settings.reduce((obj, setting) => {
    obj[setting.key] = setting.value;
    return obj;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      settings: formattedSettings
    }
  });
});

exports.getAllSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find()
    .select('-__v');

  res.status(200).json({
    status: 'success',
    results: settings.length,
    data: {
      settings
    }
  });
});

exports.getSettingsByGroup = catchAsync(async (req, res) => {
  const settings = await Setting.find({ group: req.params.group })
    .select('-__v');

  res.status(200).json({
    status: 'success',
    results: settings.length,
    data: {
      settings
    }
  });
});

exports.createSetting = catchAsync(async (req, res) => {
  const setting = await Setting.create({
    ...req.body,
    lastUpdatedBy: req.user._id
  });

  // Clear cache

  res.status(201).json({
    status: 'success',
    data: {
      setting
    }
  });
});

exports.updateSetting = catchAsync(async (req, res, next) => {
  const setting = await Setting.findOne({
    group: req.params.group,
    key: req.params.key
  });

  if (!setting) {
    return next(new AppError('Setting not found', 404));
  }

  Object.assign(setting, req.body);
  setting.lastUpdatedBy = req.user._id;
  await setting.save();

  // Clear cache

  res.status(200).json({
    status: 'success',
    data: {
      setting
    }
  });
});

exports.deleteSetting = catchAsync(async (req, res, next) => {
  const setting = await Setting.findOne({
    group: req.params.group,
    key: req.params.key
  });

  if (!setting) {
    return next(new AppError('Setting not found', 404));
  }

  await setting.deleteOne();


  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.bulkUpdateSettings = catchAsync(async (req, res) => {
  const operations = req.body.settings.map((setting) => ({
    updateOne: {
      filter: { group: setting.group, key: setting.key },
      update: { value: setting.value, lastUpdatedBy: req.user._id }
    }
  }));

  await Setting.bulkWrite(operations);


  res.status(200).json({
    status: 'success',
    message: 'Settings updated successfully'
  });
});

exports.getStoreSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find({ group: 'store' })
    .select('-_id -__v -group');

  const storeSettings = settings.reduce((obj, setting) => {
    obj[setting.key] = setting.value;
    return obj;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      settings: storeSettings
    }
  });
});

exports.updateStoreSettings = catchAsync(async (req, res) => {
  const allowedFields = [
    'storeName',
    'storeEmail',
    'storePhone',
    'timezone',
    'dateFormat',
    'timeFormat',
    'currency',
    'defaultLanguage'
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedFields.includes(key))
    .map(key => ({ 
      updateOne: {
        filter: { group: 'store', key },
        update: { value: req.body[key], lastUpdatedBy: req.user._id },
        upsert: true
      }
    }));

  await Setting.bulkWrite(updates);


  res.status(200).json({
    status: 'success',
    message: 'Store settings updated successfully'
  });
});

exports.getSeoSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find({ group: 'seo' })
    .select('-_id -__v -group');

  const seoSettings = settings.reduce((obj, setting) => {
    obj[setting.key] = setting.value;
    return obj;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      settings: seoSettings
    }
  });
});

exports.updateSeoSettings = catchAsync(async (req, res) => {
  const allowedFields = [
    'metaTitle',
    'metaDescription',
    'metaKeywords',
    'googleAnalyticsId',
    'facebookPixelId'  
  ];

  const updates = Object.keys(req.body)  
    .filter(key => allowedFields.includes(key))
    .map(key => ({
      updateOne: {
        filter: { group: 'seo', key },
        update: { value: req.body[key], lastUpdatedBy: req.user._id },
        upsert: true
      }
    }));

  await Setting.bulkWrite(updates);


  res.status(200).json({
    status: 'success',
    message: 'SEO settings updated successfully' 
  });
});

exports.getEmailSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find({ group: 'email' })
    .select('-_id -__v -group');

  const emailSettings = settings.reduce((obj, setting) => {
    obj[setting.key] = setting.value;
    return obj;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      settings: emailSettings
    }
  });
});

exports.updateEmailSettings = catchAsync(async (req, res) => {
  const allowedFields = [
    'fromName',
    'fromEmail',
    'smtpHost',
    'smtpPort',
    'smtpUser',
    'smtpPassword',
    'enableSsl'
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedFields.includes(key))  
    .map(key => ({
      updateOne: {
        filter: { group: 'email', key },
        update: { value: req.body[key], lastUpdatedBy: req.user._id },
        upsert: true  
      }
    }));

  await Setting.bulkWrite(updates);


  res.status(200).json({
    status: 'success',
    message: 'Email settings updated successfully'
  });
});

exports.getSocialMediaSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find({ group: 'social' })
    .select('-_id -__v -group');

  const socialSettings = settings.reduce((obj, setting) => {
    obj[setting.key] = setting.value;
    return obj;
  }, {});

  res.status(200).json({
    status: 'success', 
    data: {
      settings: socialSettings
    }
  });
});

exports.updateSocialMediaSettings = catchAsync(async (req, res) => {
  const allowedFields = [
    'facebook',
    'twitter', 
    'instagram',
    'pinterest',
    'youtube'
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedFields.includes(key))
    .map(key => ({
      updateOne: {
        filter: { group: 'social', key },
        update: { value: req.body[key], lastUpdatedBy: req.user._id },
        upsert: true
      }
    }));

  await Setting.bulkWrite(updates);


  res.status(200).json({ 
    status: 'success',
    message: 'Social media settings updated successfully'
  }); 
});

exports.getApiSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find({ group: 'api' })
    .select('-_id -__v -group');

  const apiSettings = settings.reduce((obj, setting) => {
    obj[setting.key] = setting.value;
    return obj;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      settings: apiSettings  
    }
  });
});

exports.updateApiSettings = catchAsync(async (req, res) => {
  const allowedFields = [
    'allowedOrigins',
    'rateLimits',
    'cacheSettings' 
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedFields.includes(key))
    .map(key => ({
      updateOne: {
        filter: { group: 'api', key },
        update: { value: req.body[key], lastUpdatedBy: req.user._id },
        upsert: true
      }
    }));

  await Setting.bulkWrite(updates);


  res.status(200).json({
    status: 'success',
    message: 'API settings updated successfully'
  });
});

exports.getSecuritySettings = catchAsync(async (req, res) => {
  const settings = await Setting.find({ group: 'security' })
    .select('-_id -__v -group');

  const securitySettings = settings.reduce((obj, setting) => {
    obj[setting.key] = setting.value;
    return obj;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      settings: securitySettings
    }
  });
});

exports.updateSecuritySettings = catchAsync(async (req, res) => {
  const allowedFields = [
    'passwordPolicy',
    'sessionTimeout',
    'maxLoginAttempts',
    'twoFactorAuth' 
  ];

  const updates = Object.keys(req.body)
    .filter(key => allowedFields.includes(key))
    .map(key => ({
      updateOne: {
        filter: { group: 'security', key },
        update: { value: req.body[key], lastUpdatedBy: req.user._id },
        upsert: true
      }
    }));

  await Setting.bulkWrite(updates);


  res.status(200).json({
    status: 'success',
    message: 'Security settings updated successfully'
  });
});

exports.clearCache = catchAsync(async (req, res, next) => {
  const { group, key } = req.body;

  if (group && key) {
  } else if (group) {
  } else {
    return next(new AppError('Group or group and key must be provided', 400));
  }

  res.status(200).json({
    status: 'success',
    message: 'Cache cleared successfully'
  });
});

exports.clearAllCache = catchAsync(async (req, res) => {

  res.status(200).json({
    status: 'success',
    message: 'All settings cache cleared successfully'
  });
});

exports.createSettingsBackup = catchAsync(async (req, res) => {
  const settings = await Setting.find();

  const backup = {
    createdAt: new Date(),
    settings
  };

  // Store backup in database or file system
  // Implement based on your preferred backup storage method

  res.status(200).json({
    status: 'success',
    message: 'Settings backup created successfully'
  });
});

exports.restoreSettingsFromBackup = catchAsync(async (req, res) => {
  // Retrieve backup from database or file system
  // Implement based on your backup storage method

  const backupSettings = backup.settings;

  await Setting.deleteMany();
  await Setting.insertMany(backupSettings);

    
  res.status(200).json({
    status: 'success',
    message: 'Settings restored successfully'
  });
});

exports.exportSettings = catchAsync(async (req, res) => {
  const settings = await Setting.find();

  const csv = await generateSettingsCsv(settings);

  res.attachment('settings.csv');
  res.status(200).send(csv);
});

exports.importSettings = catchAsync(async (req, res) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }

  const settings = await parseCsvToJson(req.file.buffer);

  await Setting.deleteMany();
  await Setting.insertMany(settings);


  res.status(200).json({
    status: 'success',
    message: 'Settings imported successfully'
  });
});

// Helper Functions

const generateSettingsCsv = async (settings) => {
  const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
  
  const csvStringifier = createCsvStringifier({
    header: [
      { id: 'group', title: 'GROUP' },
      { id: 'key', title: 'KEY' },
      { id: 'value', title: 'VALUE' },
      { id: 'dataType', title: 'DATA TYPE' }
    ]
  });

  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(settings);
};

const parseCsvToJson = async (csvBuffer) => {
  return new Promise((resolve, reject) => {
    const csvString = csvBuffer.toString();
    csv.parse(csvString, (err, records) => {
      if (err) {
        return reject(err);
      }
      
      const settings = records.map((record) => ({
        group: record[0],
        key: record[1], 
        value: record[2],
        dataType: record[3]
      }));

      resolve(settings);
    });
  });
};