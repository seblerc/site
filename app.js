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
// 💣 Herkese bakım sayfası göster, sadece sen hariç
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

   //Sadece senin IP adresine izin ver
  //const benimIP = "88.240.27.109"; // kendi IP adresini yaz buraya

  //if (ip.includes(benimIP)) {
    //return next(); // sen geç, diğerleri giremez
  //}

  //res.send(`
    //<h1>🛠 Site şu anda bakımda</h1>
    //<p>Lütfen daha sonra tekrar deneyiniz.</p>
  //`);
 });
// 🛡️ Güvenlik
app.use(helmet());

// 📂 Statik dosyalar ve veri
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());



// 🧠 Layout sistemi
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// 🔑 Oturum ayarları
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 60 * 1000 // 💣 30 dakika boyunca afk atmaz
  }
}));
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", 
  "default-src 'self'; img-src 'self' https://res.cloudinary.com data:; script-src 'self' 'unsafe-inline' https://cdn.ckeditor.com; style-src 'self' 'unsafe-inline';"
);
  next();
});

app.get('/ping', (req, res) => {
  res.sendStatus(200);
});



// 👁 Ziyaretçi takibi
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

// 💉 CSRF KORUMA BURAYA
//const csrfProtection = csrf({ cookie: true });
//app.use(csrfProtection);

const imageProxyRoutes = require('./routes/imageProxy');
app.use('/resimler', imageProxyRoutes);
// 🔀 Rotalar
app.use('/', sitemapRoutes);
app.use('/', userRoutes);

// 🚀 Sunucuyu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Sunucu çalışıyor: http://0.0.0.0:${PORT}`);
});