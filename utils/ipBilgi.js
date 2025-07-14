const axios = require('axios');

async function ipBilgi(ip) {
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city`, {
      timeout: 3000  
    });

    if (res.data.status === 'success') {
      return {
        sehir: res.data.city || 'Bilinmiyor',
        ulke: res.data.country || 'Bilinmiyor'
      };
    }
  } catch (err) {
    console.error(`IP konum bilgisi alınamadı [${ip}]:`, err.code || err.message);
  }

  
  return { sehir: 'Bilinmiyor', ulke: 'Bilinmiyor' };
}

module.exports = ipBilgi;