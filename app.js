require('dotenv').config(); // .env dosyasını yükle
const helmet = require('helmet'); // Güvenlik başlıkları için

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');



const sitemapRoutes = require('./routes/sitemapRoutes');

const userRoutes = require('./routes/userRoutes');

const app = express();

// Güvenlik başlıkları
app.use(helmet());

// Statik dosyalar
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Oturum ayarları
app.set('trust proxy', 1); // Render için mutlaka gerekli

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,          // 🔥 HTTPS zorunlu
    sameSite: 'none'       // 🔥 Cross-origin form POST'ları için şart
  }
}));

// CSRF koruması tüm formlarda aktif
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Ziyaretçi log sistemi
app.use(async (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let cookieId = req.cookies.visitorId;

  if (!cookieId) {
    cookieId = uuidv4();
    res.cookie('visitorId', cookieId, {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      secure: true,            // 🔥 Burası da önemli
  sameSite: 'none'         // 🔥 Bunu da ekle
    });

    try {
      await db.query(`
        INSERT INTO ziyaretciler (ip, cookie_id) VALUES (?, ?)
      `, [ip, cookieId]);
    } catch (err) {
      console.error("Ziyaretçi ekleme hatası:", err);
    }
  } else {
    try {
      await db.query(`
        UPDATE ziyaretciler SET zaman = NOW()
        WHERE cookie_id = ?
      `, [cookieId]);
    } catch (err) {
      console.error("Zaman güncelleme hatası:", err);
    }
  }

  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Route'lar
app.use('/', sitemapRoutes);

app.use('/', userRoutes);

// Dinleme
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 http://localhost:${PORT} çalışıyor`);
});