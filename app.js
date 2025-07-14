require('dotenv').config();

const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const isGooglebot = require('./utils/googleBotKontrol');
const sitemapRoutes = require('./routes/sitemapRoutes');
const userRoutes = require('./routes/userRoutes');
const imageProxyRoutes = require('./routes/imageProxy');
const express = require('express');
const app = express();

const izinliIp = process.env.IZINLI_IP || '';

if (process.env.BAKIM_MODU === 'true') {
  app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    if (!ip.includes(izinliIp)) {
      return res.status(503).send(`
        <html><head><title>Site Bakımda</title></head>
        <body style="text-align:center;padding:50px;font-family:sans-serif;">
          <h1>🛠️ Site Geçici Olarak Bakımda</h1>
          <p>Lütfen daha sonra tekrar deneyin.</p>
        </body></html>
      `);
    }
    next();
  });
}




const isProd = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);


function normalizeIP(ip) {
  return ip ? ip.replace(/^::ffff:/, '').trim() : '';
}


async function logKaydet(mesaj) {
  try {
    await db.query("INSERT INTO logs (log_mesaj) VALUES (?)", [mesaj]);
  } catch (e) {
    console.error("❌ DB log hatası:", e.message);
  }
}

const suspectPaths = [
  '/wp-includes', '/wlwmanifest.xml', '/xmlrpc.php',
  '/cms/', '/wp2/', '/wp-admin', '/wp-login.php',
  '/wp-admin/setup-config.php',
  '/wordpress', '/wordpress/wp-admin', '/wordpress/wp-admin/setup-config.php'
];

const botKeywords = [
  'bot', 'crawl', 'spider', 'python', 'requests', 'scanner',
  'go-http-client', 'wget', 'curl', 'libwww', 'httpclient', 'trident', 'appengine'
];


app.use(async (req, res, next) => {
  let ip = normalizeIP(req.headers['x-forwarded-for'] || req.socket.remoteAddress);
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const pathUrl = (req.url || '').toLowerCase();

  await logKaydet("👾 UA geldi: " + userAgent + " | IP: " + ip);

  const isBot = botKeywords.some(k => userAgent.includes(k));
  const isSuspicious = suspectPaths.some(p => pathUrl.includes(p));
  let banReason = null;

  if (userAgent.includes('googlebot')) {
    const gercekGoogleMi = await isGooglebot(ip);
    if (!gercekGoogleMi) banReason = 'Sahte Googlebot';
  } else if (isBot || isSuspicious) {
    banReason = isBot ? 'Bot user-agent' : 'Şüpheli URL erişimi';
  }

  if (banReason) {
    await db.query('INSERT IGNORE INTO banned_ips (ip, sebep) VALUES (?, ?)', [ip, banReason]);
    await db.query(`
      INSERT INTO ziyaret_log (ip, cookie_id, kullanici_email, user_agent, sayfa, bot_mu, islem, sehir, ulke)
      VALUES (?, NULL, NULL, ?, ?, 1, ?, ?, ?)
    `, [ip, userAgent, pathUrl, 'engellendi', 'Bilinmiyor', 'Bilinmiyor']);
    return res.status(403).send('⛔ Güvenlik duvarı bu isteği reddetti.');
  }

  next();
});


app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "https://res.cloudinary.com", "data:"],
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.ckeditor.com"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"]
    }
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'no-referrer' }
}));


app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());


app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 60 * 1000
  }
}));


app.get('/ping', (req, res) => {
  res.sendStatus(200);
});


app.use(async (req, res, next) => {
  const ip = normalizeIP(req.headers['x-forwarded-for'] || req.socket.remoteAddress);
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


app.use(async (req, res, next) => {
  const ip = normalizeIP(req.headers['x-forwarded-for'] || req.socket.remoteAddress);
  const cookieId = req.cookies.visitorId || uuidv4();
  const userAgent = req.headers['user-agent'] || 'bilinmiyor';
  const sayfa = req.originalUrl;
  const kullanici = req.session?.kullanici?.email || null;
  const isBot = botKeywords.some(k => userAgent.toLowerCase().includes(k));
  const islem = isBot ? 'bot taraması' : 'ziyaret';

  try {
    await db.query(`
      INSERT INTO ziyaret_log (ip, cookie_id, kullanici_email, user_agent, sayfa, bot_mu, islem)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [ip, cookieId, kullanici, userAgent, sayfa, isBot ? 1 : 0, islem]);
  } catch (err) {
    console.error("Ziyaret log hatası:", err.message);
  }

  next();
});


app.use('/resimler', imageProxyRoutes);
app.use('/', sitemapRoutes);
app.use('/', userRoutes);

app.use((req, res, next) => {
  res.status(403).send("🚫 Erişim engellendi.");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Sunucu çalışıyor: http://localhost:${PORT}`);
});
