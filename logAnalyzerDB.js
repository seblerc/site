const fs = require('fs');
const mysql = require('mysql2/promise');
const readline = require('readline');

const suspectKeywords = [
  'wlwmanifest.xml', 'wp-includes', 'wp-content',
  '/cms/', '/blog/', '/shop/', '/xmlrpc.php'
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('🔐 Şifreyi gir: ', async (password) => {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: password,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    ca: fs.readFileSync(process.env.DB_CA_PATH)
  }
    });

    console.log('✅ Bağlantı başarılı!\n');

    const [rows] = await db.query('SELECT ip, sayfa, user_agent, zaman FROM ziyaret_log');

    const ipCounter = {};
    const suspectIPs = {};

    rows.forEach(row => {
      const ip = row.ip;
      const path = (row.sayfa || '').toLowerCase();

      ipCounter[ip] = (ipCounter[ip] || 0) + 1;

      if (suspectKeywords.some(keyword => path.includes(keyword))) {
        suspectIPs[ip] = (suspectIPs[ip] || 0) + 1;
      }
    });

    console.log('🚨 Şüpheli IP’ler:\n');
    for (const [ip, count] of Object.entries(suspectIPs)) {
      console.log(`${ip} - ${count} şüpheli istek`);
    }

    console.log('\n📊 En çok istek atan IP’ler:\n');
    const sorted = Object.entries(ipCounter).sort((a, b) => b[1] - a[1]);
    sorted.slice(0, 10).forEach(([ip, count]) => {
      console.log(`${ip} - toplam ${count} istek`);
    });

    await db.end();
  } catch (err) {
    console.error('❌ Hata:', err);
  } finally {
    rl.close();
  }
});