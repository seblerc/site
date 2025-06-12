const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Cloudinary yapılandırması
cloudinary.config({
  cloud_name: 'dawvc7cxy',
  api_key: '184495391799179',
  api_secret: 'Vqm3wKNF_s0P2Qy9QcP6pqrT-eo'
});

// Sadece belirli uzantılara izin ver
const ALLOWED_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];

// Dosya filtreleme fonksiyonu
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_TYPES.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Geçersiz dosya türü. Sadece resim yükleyebilirsiniz.'));
  }
};

// Cloudinary storage ayarları
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    return {
      folder: 'haber_gorselleri',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      use_filename: true,           // ✅ Dosyanın adını kullan
      unique_filename: false,       // ✅ Rastgele ek yapmasın
      overwrite: false              // Aynı isim varsa yeni versiyon yaratmasın (opsiyonel)
    };
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // max 5MB
});

module.exports = upload;