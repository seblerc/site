require('dotenv').config(); // Çevresel değişkenleri yükle
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const sitemapRoutes = require('./routes/sitemapRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// 🔐 Güvenlik başlıkları
app.use(helmet());

// 📂 Statik dosyalar ve body-parser
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Form verisini okuyabilmek için
app.use(express.json()); // JSON veri kullanıyorsan bunu da ekle

// 🍪 Cookie işlemleri
app.use(cookieParser());

// 🔑 Oturum yönetimi
app.set('trust proxy', 1); // Render gibi servisler için gerekli
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true, // 🔥 HTTPS zorunlu
    sameSite: 'none' // 🔥 Cross-origin istekler için şart
  }
}));

// 🛡️ CSRF koruması **session'dan sonra** gelmeli!
const csrfProtection = csrf();
app.use(csrfProtection);

// 🔎 CSRF Token’i view'lara aktarma & test logları
app.use((req, res, next) => {
  console.log("Oluşturulan CSRF Token:", req.csrfToken());
  res.locals.csrfToken = req.csrfToken();
  next();
});
const bodyCsrf = req.body ? req.body._csrf : undefined;
  const headerCsrf = req.headers ? req.headers['csrf-token'] : undefined;
  const cookieCsrf = req.cookies ? req.cookies['_csrf'] : undefined;

console.log("Gönderilen CSRF Token (body):", bodyCsrf);
  console.log("Gönderilen CSRF Token (header):", headerCsrf);
  console.log("CSRF Token (cookie):", cookieCsrf);

// 📊 Ziyaretçi loglama sistemi
app.use(async (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let cookieId = req.cookies.visitorId;

  if (!cookieId) {
    cookieId = uuidv4();
    res.cookie('visitorId', cookieId, {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      secure: true,
      sameSite: 'none'
    });

    try {
      await db.query(`INSERT INTO ziyaretciler (ip, cookie_id) VALUES (?, ?)`, [ip, cookieId]);
    } catch (err) {
      console.error("Ziyaretçi ekleme hatası:", err);
    }
  } else {
    try {
      await db.query(`UPDATE ziyaretciler SET zaman = NOW() WHERE cookie_id = ?`, [cookieId]);
    } catch (err) {
      console.error("Zaman güncelleme hatası:", err);
    }
  }

  next();
});

// 🖥️ Görüntüleme motoru ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 🔗 Route'ları ekleme
app.use('/', sitemapRoutes);
app.use('/', userRoutes);

// 🚀 Sunucuyu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Sunucu çalışıyor: http://localhost:${PORT}`);
});