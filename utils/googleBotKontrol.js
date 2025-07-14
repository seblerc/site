const dns = require('dns').promises;

async function isGooglebot(ip) {
  try {
    const hostnames = await dns.reverse(ip);
    return hostnames.some(host =>
      host.endsWith('.googlebot.com') || host.endsWith('.google.com')
    );
  } catch {
    return false;
  }
}

module.exports = isGooglebot;