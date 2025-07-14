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

    const cloudinaryId = rows[0].cloudinary_id;
    const cloudinaryUrl = `https://res.cloudinary.com/dawvc7cxy/image/upload/${cloudinaryId}`;

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
    console.error('❌ Veritabanı hatası:', err);
    res.status(500).send('Sunucu hatası');
  }
});

module.exports = router;