const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the uploads directory
const uploadsDir = path.join(__dirname, '../uploads');

// Create uploads directory if it doesn't exist
console.log('Ensuring uploads directory exists:', uploadsDir);
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
    
    // Set proper permissions (755) - read/write for owner, read/execute for others
    fs.chmodSync(uploadsDir, 0o755);
  }
} catch (err) {
  console.error('Error creating uploads directory:', err);
}

// Configure storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    console.log('Multer receiving file:', file.originalname, 'mimetype:', file.mimetype);
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    console.log('Multer generated filename:', filename);
    cb(null, filename);
  }
});

// Filter files by mime type
const fileFilter = (req, file, cb) => {
  console.log('Multer file filter checking:', file.mimetype);
  if (
    file.mimetype === 'image/jpeg' || 
    file.mimetype === 'image/png' || 
    file.mimetype === 'image/jpg' || 
    file.mimetype === 'image/webp'
  ) {
    cb(null, true);
  } else {
    console.error('File rejected - unsupported format:', file.mimetype);
    cb(new Error('Unsupported file format. Only JPEG, PNG, JPG, and WEBP are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload; 