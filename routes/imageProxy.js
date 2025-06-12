const express = require('express');
const router = express.Router();
const request = require('request');
const path = require('path');
const fs = require('fs');

const mapPath = path.join(__dirname, '../seoImages.json');

router.get('/:filename', (req, res) => {
  const filename = req.params.filename;

  const raw = fs.readFileSync(mapPath);
  const imageMap = JSON.parse(raw);

  const cloudinaryPublicId = imageMap[filename];
  if (!cloudinaryPublicId) return res.status(404).send('Görsel bulunamadı');

  const cloudinaryUrl = `https://res.cloudinary.com/dawwc7cxy/image/upload/v1749667679/haber_gorselleri/${cloudinaryPublicId}`;
  request.get(cloudinaryUrl).pipe(res);
});

module.exports = router;