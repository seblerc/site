const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/sitemap.xml', async (req, res) => {
  try {
    const [haberler] = await db.query('SELECT slug, resim, baslik FROM haberler');
    const [duyurular] = await db.query('SELECT id FROM duyurular');

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    sitemap += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    sitemap += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Statik sayfalar
    const staticPages = ['/', '/galeri', '/duyurular', '/kategori/genel'];
    staticPages.forEach(path => {
      sitemap += `  <url><loc>${baseUrl}${path}</loc></url>\n`;
    });

    // Haberler
    haberler.forEach(haber => {
      if (haber.slug && haber.slug.trim() !== '') {
        sitemap += `  <url>\n`;
        sitemap += `    <loc>${baseUrl}/haber/${haber.slug}</loc>\n`;

        if (haber.resim && haber.resim.trim() !== '') {
          sitemap += `    <image:image>\n`;
          sitemap += `      <image:loc>${baseUrl}/resimler/${haber.resim}</image:loc>\n`;
          sitemap += `      <image:title><![CDATA[${haber.baslik || 'Haber Görseli'}]]></image:title>\n`;
          sitemap += `    </image:image>\n`;
        }

        sitemap += `  </url>\n`;
      }
    });

    // Duyurular
    duyurular.forEach(duyuru => {
      sitemap += `  <url><loc>${baseUrl}/duyuru/${duyuru.id}</loc></url>\n`;
    });

    sitemap += `</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);

  } catch (error) {
    console.error('Sitemap oluşturulamadı:', error);
    res.status(500).send('Sitemap oluşturulurken hata oluştu');
  }
});

module.exports = router;