const express = require('express');
const router = express.Router();
const db = require('../db');
const request = require('request');

router.get('/:filename', async (req, res) => {
  const filename = req.params.filename;

  try {
    const [rows] = await db.query(
      'SELECT cloudinary_id FROM seo_images WHERE seo_name = ?',
      [filename]
    );

    if (rows.length === 0) {
      return res.status(404).send('Görsel bulunamadı');
    }

    const cloudinaryFilename = rows[0].cloudinary_id;
const cloudinaryUrl = `https://res.cloudinary.com/dawwc7cxy/image/upload/haber_gorselleri/${cloudinaryFilename}`;

    request.get(cloudinaryUrl)
      .on('response', (proxiedRes) => {
        res.setHeader('Content-Type', proxiedRes.headers['content-type']);
      })
      .on('error', (err) => {
        console.error('🧨 Cloudinary istek hatası:', err);
        res.status(500).send('Görsel alınamadı');
      })
      .pipe(res);

  } catch (err) {
    console.error('❌ DB hatası:', err);
    res.status(500).send('Veritabanı hatası');
  }
});

module.exports = router;