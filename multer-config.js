const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
require('dotenv').config(); // .env'den çekmek için


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const ALLOWED_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];


const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_TYPES.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Geçersiz dosya türü. Sadece resim yükleyebilirsiniz.'));
  }
};


const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const parsedName = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    const safeName = parsedName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');

    return {
      folder: 'haber_gorselleri',
      public_id: `haber_gorselleri/${safeName}`, 
        
      use_filename: true,
      unique_filename: false,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      overwrite: false,
      resource_type: 'image'
    };
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // max 5MB
});

module.exports = upload;