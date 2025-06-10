require('dotenv').config();
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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// 🔑 Oturum yönetimi
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  }
}));

// 🛡️ CSRF koruması (cookie tabanlı)
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// ✅ CSRF token'ı cookie + ejs için ayarla
app.use((req, res, next) => {
  const token = req.csrfToken();
  res.cookie('_csrf', token, {
    secure: true,
    sameSite: 'none',
    httpOnly: false // input'tan erişmek için
  });
  res.locals.csrfToken = token;
  next();
});

// 📊 Ziyaretçi loglama
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

// 🖥️ View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 📌 Routes
app.use('/', sitemapRoutes);
app.use('/', userRoutes);

// 🚀 Server başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Sunucu çalışıyor: http://localhost:${PORT}`);
});