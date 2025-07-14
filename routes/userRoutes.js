const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../multer-config');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
const path = require('path');
const slugify = require('slugify');
const db = require('../db');

// const { RecaptchaV2 } = require('express-recaptcha');
// const recaptcha = new RecaptchaV2(
//   process.env.RECAPTCHA_SITE_KEY,
//   process.env.RECAPTCHA_SECRET_KEY
// );


const adminOnly = (req, res, next) => {
  if (!req.session.kullanici || req.session.kullanici.rol !== 'admin') {
    return res.status(403).send("Bu işlem sadece adminler içindir.");
  }
  next();
};


router.get('/', userController.anasayfa);
router.get('/index', userController.anasayfa);
router.get('/login', csrfProtection,userController.loginSayfasi);
router.post('/login', csrfProtection, userController.loginIslem);
router.get('/register', csrfProtection, userController.registerSayfasi);
router.post('/register',  csrfProtection, userController.registerIslem);
router.get('/logout', userController.logout);


router.get('/profil', csrfProtection, userController.profilSayfasi);
router.post('/profil', upload.single('profil_resim'),csrfProtection,  userController.profilGuncelle);


router.get('/admin', csrfProtection, adminOnly, userController.adminPanel);
router.post('/admin/rol-guncelle', adminOnly, csrfProtection, userController.rolGuncelle);
router.post('/admin/banla/:id', adminOnly, csrfProtection, userController.kullaniciBanla);
router.post('/admin/sil/:id', adminOnly, csrfProtection, userController.kullaniciSil);
router.post('/admin/haber-ekle', upload.single('resim'), adminOnly, csrfProtection, userController.haberEkle);

router.post('/admin/duyuru-ekle', csrfProtection, adminOnly, userController.duyuruEkle);
router.get('/admin/ekle', csrfProtection, adminOnly, userController.haberDuyuruEkleSayfasi);


router.get('/news/:slug', csrfProtection, userController.haberDetay);

router.get('/haber/:slug', (req, res) => {
  res.redirect(301, `/news/${req.params.slug}`);
});

router.get('/haber/duzenle/:id', adminOnly, csrfProtection,userController.haberDuzenleSayfasi);
router.post('/haber/duzenle/:id',upload.single('resim'), adminOnly, csrfProtection, userController.haberDuzenleIslem);
router.post('/haber/sil/:id', adminOnly, csrfProtection, userController.haberSil);


router.post('/upload-image', upload.single('upload'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      uploaded: false,
      error: { message: 'Dosya yüklenemedi' }
    });
  }

  const seoName = slugify(path.parse(req.file.originalname).name) + path.extname(req.file.originalname);
  const cloudinaryId = req.file.path.split('/image/upload/')[1]; // 🔥 en kritik düzeltme

  try {
    await db.query(
      'REPLACE INTO seo_images (seo_name, cloudinary_id) VALUES (?, ?)',
      [seoName, cloudinaryId]
    );
  } catch (err) {
    console.error("❌ CKEditor görseli DB’ye yazılamadı:", err);
  }

  const url = `/resimler/${seoName}`;

  res.status(200).json({
    uploaded: true,
    url
  });
});


router.post('/yorum-ekle', csrfProtection, userController.yorumEkle);
router.post('/yorum-begen/:id', csrfProtection, userController.yorumBegen);
router.post('/yorum-sil/:id', csrfProtection, userController.yorumSil);


router.get('/kategori/:id', userController.kategoriyeGoreListele);

router.get('/istatistik', userController.istatistik);


router.post('/favori/ekle/:id', userController.favoriEkle);
router.post('/favori/kaldir/:id', userController.favoriKaldir);
router.get('/favorilerim', userController.favorilerSayfasi);

router.get('/_bot-trap', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'bilinmiyor';

  
  await db.query('INSERT IGNORE INTO banned_ips (ip, sebep) VALUES (?, ?)', [ip, 'Honeypot tuzağı']);

  
  await db.query(`
    INSERT INTO ziyaret_log (ip, cookie_id, kullanici_email, user_agent, sayfa, bot_mu, islem, sehir, ulke)
    VALUES (?, NULL, NULL, ?, '/_bot-trap', 1, 'Honeypot yakalama', 'Bilinmiyor', 'Bilinmiyor')
  `, [ip, userAgent]);

  return res.status(403).send('⛔ HoneyPot Triggered. Access Denied.');
});

module.exports = router;