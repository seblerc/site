const express = require('express');
const router = express.Router();
const request = require('request');
const path = require('path');
const fs = require('fs');

const mapPath = path.join(__dirname, '../seoImages.json');

router.get('/:filename', (req, res) => {
  const filename = req.params.filename;

  // 🧠 JSON oku ve fallback ver
  let imageMap = {};
  try {
    if (fs.existsSync(mapPath)) {
      const raw = fs.readFileSync(mapPath, 'utf-8');
      imageMap = JSON.parse(raw.trim() || '{}');
    }
  } catch (err) {
    console.error('🧨 JSON okuma hatası:', err);
    return res.status(500).send('Görsel yapılandırma hatası');
  }

  const cloudinaryFilename = imageMap[filename];
  if (!cloudinaryFilename) {
    return res.status(404).send('Görsel bulunamadı');
  }

  // 📦 Cloudinary'den yönlendir
  const cloudinaryUrl = `https://res.cloudinary.com/dawwc7cxy/image/upload/v1749667679/haber_gorselleri/${cloudinaryFilename}`;

  // 🔁 Görseli proxy olarak aktar
  request.get(cloudinaryUrl)
    .on('response', (proxiedRes) => {
      // Orijinal content-type (image/png vs.) korunsun
      res.setHeader('Content-Type', proxiedRes.headers['content-type']);
    })
    .on('error', (err) => {
      console.error('🧨 Cloudinary istek hatası:', err);
      res.status(500).send('Görsel alınamadı');
    })
    .pipe(res);
});

module.exports = router;