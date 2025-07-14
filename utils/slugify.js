module.exports = function slugify(str) {
  return str
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9 -]/g, '') 
    .replace(/\s+/g, '-')        
    .replace(/-+/g, '-')         
    .replace(/^-+|-+$/g, '');    
};