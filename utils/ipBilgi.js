const axios = require('axios');

async function ipBilgi(ip) {
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    if (res.data.status === 'success') {
      return {
        sehir: res.data.city || 'Bilinmiyor',
        ulke: res.data.country || 'Bilinmiyor'
      };
    }
  } catch (err) {
    console.error("IP konum bilgisi alınamadı:", err.message);
  }
  return { sehir: 'Bilinmiyor', ulke: 'Bilinmiyor' };
}

module.exports = ipBilgi;