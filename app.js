require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const sitemapRoutes = require('./routes/sitemapRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// 🛡️ Güvenlik başlıkları
app.use(helmet());

// 🧱 Temel middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// 📦 Session ayarları
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax'
  }
}));

// 🧱 Layout sistemi
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout'); // layout.ejs varsayılan şablon

// 🛡️ CSRF koruması
app.use(csrf({ cookie: true }));
app.use((req, res, next) => {
  try {
    const token = req.csrfToken();
    res.cookie('_csrf', token, {
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      httpOnly: false
    });
    res.locals.csrfToken = token; // Tüm EJS dosyalarında erişilebilir
  } catch (e) {
    console.warn('CSRF token oluşturulamadı:', e.message);
  }
  next();
});

// 🧠 Ziyaretçi takibi
app.use(async (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let cookieId = req.cookies.visitorId;

  if (!cookieId) {
    cookieId = uuidv4();
    res.cookie('visitorId', cookieId, {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
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
      console.error("Ziyaretçi zaman güncelleme hatası:", err);
    }
  }

  next();
});

// 🛣️ Rotalar
app.use('/', sitemapRoutes);
app.use('/', userRoutes);

// 🚀 Sunucu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Sunucu çalışıyor: http://localhost:${PORT}`);
});