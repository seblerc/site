const db = require('../db');
const bcrypt = require('bcryptjs');
const slugify = require('../utils/slugify');
const fs = require('fs');
const path = require('path');


exports.anasayfa = async (req, res) => {
  try {
    
    const [haberler] = await db.query(`
      SELECT h.*, k.isim AS kategori_adi
      FROM haberler h
      LEFT JOIN kategoriler k ON h.kategori_id = k.id
      ORDER BY h.tarih DESC
    `);

    
    const [duyurular] = await db.query(`
      SELECT * FROM duyurular
      WHERE tarih >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      ORDER BY tarih DESC
    `);

    
    const [kategoriler] = await db.query(`SELECT * FROM kategoriler`);

    
    const [duyuruBildirimleri] = await db.query(`
      SELECT 'duyuru' AS tur, baslik AS mesaj, NULL AS slug
      FROM duyurular
      WHERE tarih >= NOW() - INTERVAL 1 DAY
    `);

    const [haberBildirimleri] = await db.query(`
      SELECT 'haber' AS tur, baslik AS mesaj, slug
      FROM haberler
      WHERE tarih >= NOW() - INTERVAL 1 DAY
    `);

    const bildirimler = [...duyuruBildirimleri, ...haberBildirimleri]
      .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
      .slice(0, 10);

    res.render('index', {
      kullanici: req.session.kullanici,
      haberler,
      duyurular,
      bildirimler,
      kategoriler  
    });

  } catch (err) {
    console.error("Anasayfa hatası:", err);
    res.send("Bir hata oluştu.");
  }
};

exports.loginSayfasi = (req, res) => {
  const mesaj = req.session.flashMesaj || null;
  req.session.flashMesaj = null; 

  res.render('login', {
  mesaj,
  csrfToken: req.csrfToken()
});
};

exports.registerSayfasi = (req, res) => {
  res.render('register', {
  mesaj: null,
  csrfToken: req.csrfToken()
});
};

exports.loginIslem = async (req, res) => {
  const { email, sifre } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM kullanicilar WHERE email = ?", [email]);

    if (rows.length === 0) {
      return res.render('login', {
        mesaj: "❌ E-posta bulunamadı!",
        csrfToken: req.csrfToken()
      });
    }

    const kullanici = rows[0];

    if (kullanici.banli) {
      return res.render('login', {
        mesaj: "🚫 Hesabınız engellenmiştir.",
        csrfToken: req.csrfToken()
      });
    }

    const uyusuyorMu = await bcrypt.compare(sifre, kullanici.sifre);
    if (!uyusuyorMu) {
      return res.render('login', {
        mesaj: "❌ Şifre yanlış!",
        csrfToken: req.csrfToken()
      });
    }

    req.session.kullanici = kullanici;
    return res.redirect('/index');
  } catch (err) {
    console.error("Giriş hatası:", err);
    res.render('login', {
      mesaj: "⚠️ Sunucu hatası oluştu!",
      csrfToken: req.csrfToken()
    });
  }
};

exports.registerIslem = async (req, res) => {
  const { isim, email, sifre } = req.body;

  const sifreGecerliMi = sifre.length >= 8 && /[A-Z]/.test(sifre) && /\d/.test(sifre);
  if (!sifreGecerliMi) {
    return res.render('register', {
      mesaj: "❌ Şifre en az 8 karakter olmalı, en az bir büyük harf ve bir sayı içermelidir.",
      csrfToken: req.csrfToken()
    });
  }

  try {
    const [emailKontrol] = await db.query("SELECT * FROM kullanicilar WHERE email = ?", [email]);
    if (emailKontrol.length > 0) {
      return res.render('register', {
        mesaj: "❌ Bu e-posta zaten kayıtlı!",
        csrfToken: req.csrfToken()
      });
    }

    const [isimKontrol] = await db.query("SELECT * FROM kullanicilar WHERE isim = ?", [isim]);
    if (isimKontrol.length > 0) {
      return res.render('register', {
        mesaj: "❌ Bu isim zaten alınmış!",
        csrfToken: req.csrfToken()
      });
    }

    const hashliSifre = await bcrypt.hash(sifre, 10);
    await db.query(
      "INSERT INTO kullanicilar (isim, email, sifre, rol) VALUES (?, ?, ?, 'user')",
      [isim, email, hashliSifre]
    );

    req.session.flashMesaj = "✅ Kayıt başarılı, şimdi giriş yapabilirsin.";
    return res.redirect('/login');
  } catch (err) {
    console.error("Kayıt hatası:", err);
    return res.render('register', {
      mesaj: "⚠️ Kayıt sırasında bir hata oluştu.",
      csrfToken: req.csrfToken()
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    res.redirect('/');
  });
};

exports.profilSayfasi = async (req, res) => {
  console.log("Oturumdaki kullanıcı:", req.session.kullanici);
  const [kategoriler] = await db.query("SELECT * FROM kategoriler"); 
  res.render('profil', {
    kullanici: req.session.kullanici,   
    mesaj: null,
    kategoriler,
    csrfToken: req.csrfToken()
  });
};

exports.profilGuncelle = async (req, res) => {
  if (!req.session.kullanici) return res.redirect('/login');

  const { isim, sifre } = req.body;
  let yeniSifre = null;

  if (sifre && sifre.trim() !== "") {
    yeniSifre = await bcrypt.hash(sifre, 10);
  }

  let profilResimYolu = null;
  if (req.file) {
    profilResimYolu = req.file.path;
    req.session.kullanici.profil_resim = profilResimYolu;
  }

  try {
    const alanlar = [];
    const degerler = [];

    if (isim) {
      alanlar.push("isim = ?");
      degerler.push(isim);
      req.session.kullanici.isim = isim;
    }

    if (yeniSifre) {
      alanlar.push("sifre = ?");
      degerler.push(yeniSifre);
    }

    if (profilResimYolu) {
      alanlar.push("profil_resim = ?");
      degerler.push(profilResimYolu);
    }

    degerler.push(req.session.kullanici.id);

    await db.query(
      `UPDATE kullanicilar SET ${alanlar.join(", ")} WHERE id = ?`,
      degerler
    );

    res.render("profil", {
      kullanici: req.session.kullanici,
      mesaj: "Bilgiler güncellendi ✅",
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error("Profil güncelleme hatası:", err);
    res.render("profil", {
      kullanici: req.session.kullanici,
      mesaj: "Hata oluştu!",
      csrfToken: req.csrfToken()
    });
  }
};

exports.adminPanel = async (req, res) => {
  if (!req.session.kullanici || req.session.kullanici.rol !== 'admin') {
    return res.status(403).send("⛔ Yetkisiz erişim");
  }

  try {
    const [kullanicilar] = await db.query("SELECT * FROM kullanicilar");
    res.render('admin', { kullanici: req.session.kullanici, kullanicilar, mesaj: null, csrfToken: req.csrfToken() });
  } catch (err) {
    console.error("Admin panel hatası:", err);
    res.send("Veritabanı hatası");
  }
};

exports.rolGuncelle = async (req, res) => {
  if (!req.session.kullanici || req.session.kullanici.rol !== 'admin') {
    return res.status(403).send("Yetkisiz");
  }

  const { kullanici_id, yeni_rol } = req.body;

  try {
    await db.query("UPDATE kullanicilar SET rol = ? WHERE id = ?", [yeni_rol, kullanici_id]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Rol güncelleme hatası:", err);
    res.send("Rol güncellenemedi");
  }
};

exports.kullaniciBanla = async (req, res) => {
  const { id } = req.params;

  try {
    
    const [rows] = await db.query("SELECT banli FROM kullanicilar WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.send("Kullanıcı bulunamadı");
    }

    const mevcutDurum = rows[0].banli;

    
    const yeniDurum = mevcutDurum ? 0 : 1;

    await db.query("UPDATE kullanicilar SET banli = ? WHERE id = ?", [yeniDurum, id]);

    res.redirect("/admin");
  } catch (err) {
    console.error("Ban işlemi hatası:", err);
    res.send("Bir hata oluştu.");
  }
};

exports.kullaniciSil = async (req, res) => {
  const id = req.params.id;
  await db.query('DELETE FROM kullanicilar WHERE id = ?', [id]);
  res.redirect('/admin');
};

exports.haberEkle = async (req, res) => {
  if (!req.session.kullanici || req.session.kullanici.rol !== 'admin') {
    return res.status(403).send("Yetkisiz");
  }

  const { baslik, icerik, kategori_id,etiketler } = req.body;
  const slug = slugify(baslik);
  const tarih = new Date();
  const yazar_id = req.session.kullanici.id;

  let resim = null;

  try {
    if (req.file && req.file.path.includes('cloudinary.com')) {
      
      const seoName = slugify(path.parse(req.file.originalname).name) + path.extname(req.file.originalname);

      // ✅ Cloudinary'den tam yol
      const cloudinaryPath = new URL(req.file.path).pathname; // /dawvc7cxy/image/upload/vXXXX/haber_gorselleri/abc.png
      const cloudinaryId = cloudinaryPath.split('/upload/')[1]; // 🔥 vXXXX/haber_gorselleri/abc.png

      try {
        await db.query(
          'REPLACE INTO seo_images (seo_name, cloudinary_id) VALUES (?, ?)',
          [seoName, cloudinaryId]
        );
        console.log("✅ Veritabanına SEO görsel eşleşmesi yazıldı:", seoName, cloudinaryId);
      } catch (err) {
        console.error("❌ SEO görseli veritabanına yazılamadı:", err);
      }

      
      resim = `/resimler/${seoName}`;
    } else if (req.file) {
      
      resim = req.file.path;
    }

    await db.query(`
      INSERT INTO haberler (baslik, icerik, slug, tarih, yazar_id, kategori_id, resim,etiketler)
      VALUES (?, ?, ?, ?, ?, ?, ?,?)
    `, [baslik, icerik, slug, tarih, yazar_id, kategori_id, resim,etiketler]);

    res.redirect('/');
  } catch (err) {
    console.error("❌ Haber eklenemedi:", err);
    res.send("Haber eklenirken bir hata oluştu.");
  }
};


exports.haberDetay = async (req, res) => {
  const slug = req.params.slug;

  try {
    const [rows] = await db.query(`
      SELECT h.*, k.isim AS kategori_adi, u.isim AS yazar_adi
      FROM haberler h
      LEFT JOIN kategoriler k ON h.kategori_id = k.id
      LEFT JOIN kullanicilar u ON h.yazar_id = u.id
      WHERE h.slug = ?
      LIMIT 1
    `, [slug]);

    if (rows.length === 0) {
      return res.status(404).send("Haber bulunamadı.");
    }

    const haber = rows[0];

    let favorideMi = false;
if (req.session.kullanici) {
  const [fav] = await db.query(`
    SELECT 1 FROM favoriler WHERE kullanici_id = ? AND haber_id = ?
  `, [req.session.kullanici.id, haber.id]);
  favorideMi = fav.length > 0;
}
    
    const [yorumlar] = await db.query(`
  SELECT y.*, k.isim, k.rol, k.profil_resim
  FROM yorumlar y
  LEFT JOIN kullanicilar k ON y.kullanici_id = k.id
  WHERE y.haber_id = ?
  ORDER BY y.parent_id ASC, y.tarih ASC
`, [haber.id]);

    res.render('haber-detay', { haber, kullanici: req.session.kullanici, yorumlar, favorideMi,csrfToken: req.csrfToken() });

  } catch (err) {
    console.error("Haber detay hatası:", err);
    res.status(500).send("Bir hata oluştu.");
  }
};
exports.haberSil = async (req, res) => {
  const haberId = req.params.id;

  if (!req.session.kullanici || req.session.kullanici.rol !== 'admin') {
    return res.status(403).send("Yetkisiz işlem");
  }

  try {
    await db.query("DELETE FROM haberler WHERE id = ?", [haberId]);
    res.redirect('/');
  } catch (err) {
    console.error("Haber silme hatası:", err);
    res.status(500).send("Haber silinirken bir hata oluştu.");
  }
};

exports.duyuruEkle = async (req, res) => {
  if (!req.session.kullanici || req.session.kullanici.rol !== 'admin') {
    return res.status(403).send("Yetkisiz");
  }

  const { baslik, icerik } = req.body;
  const tarih = new Date();

  try {
    await db.query(`INSERT INTO duyurular (baslik, icerik, tarih) VALUES (?, ?, ?)`, [baslik, icerik, tarih]);
    res.redirect('/');
  } catch (err) {
    console.error("Duyuru eklenemedi:", err);
    res.send("Duyuru eklenirken hata oluştu.");
  }
};

exports.haberDuyuruEkleSayfasi = async (req, res) => {
  if (!req.session.kullanici || req.session.kullanici.rol !== 'admin') {
    return res.status(403).send("Yetkisiz erişim");
  }

  const [kategoriler] = await db.query("SELECT * FROM kategoriler");
  
  res.render('ekle', {
    csrfToken: req.csrfToken(),
  kategoriler,
  kullanici: req.session.kullanici
  });
};

exports.yorumEkle = async (req, res) => {
  const { haber_id, yorum, parent_id } = req.body; 
  const kullanici_id = req.session.kullanici?.id;

  if (!kullanici_id || !yorum) return res.redirect('/login');

  try {
    await db.query(`
      INSERT INTO yorumlar (haber_id, kullanici_id, yorum, tarih, parent_id)
      VALUES (?, ?, ?, NOW(), ?)
    `, [haber_id, kullanici_id, yorum, parent_id || null]); 

    const [slugRow] = await db.query("SELECT slug FROM haberler WHERE id = ?", [haber_id]);
    res.redirect(`/haber/${slugRow[0].slug}`);
  } catch (err) {
    console.error("Yorum ekleme hatası:", err);
    res.send("Yorum eklenemedi.");
  }
};

exports.yorumBegen = async (req, res) => {
  const yorumId = req.params.id;
  const kullaniciId = req.session.kullanici?.id;

  if (!kullaniciId) return res.redirect('/login');

  try {
    const [varMi] = await db.query(`
      SELECT * FROM yorum_begenme WHERE kullanici_id = ? AND yorum_id = ?
    `, [kullaniciId, yorumId]);

    if (varMi.length === 0) {
      await db.query(`UPDATE yorumlar SET begeni = begeni + 1 WHERE id = ?`, [yorumId]);
      await db.query(`INSERT INTO yorum_begenme (kullanici_id, yorum_id) VALUES (?, ?)`, [kullaniciId, yorumId]);
    }

    res.redirect(req.get('Referrer') || '/');
  } catch (err) {
    console.error("Beğeni hatası:", err);
    res.redirect('/');
  }
};

exports.yorumSil = async (req, res) => {
  const yorumId = req.params.id;
  const kullanici = req.session.kullanici;

  try {
    
    const [rows] = await db.query(`SELECT * FROM yorumlar WHERE id = ?`, [yorumId]);
    if (rows.length === 0) return res.status(404).send("Yorum bulunamadı");

    const yorum = rows[0];

    
    if (kullanici.rol !== 'admin' && yorum.kullanici_id !== kullanici.id) {
      return res.status(403).send("Bu yorumu silmeye yetkin yok.");
    }

    await db.query(`DELETE FROM yorumlar WHERE id = ?`, [yorumId]);

    const [slugRow] = await db.query("SELECT slug FROM haberler WHERE id = ?", [yorum.haber_id]);
    res.redirect(`/haber/${slugRow[0].slug}`);
  } catch (err) {
    console.error("Yorum silme hatası:", err);
    res.status(500).send("Yorum silinemedi.");
  }
};

exports.kategoriyeGoreListele = async (req, res) => {
  const kategoriId = req.params.id;
  try {
    const [haberler] = await db.query(`
      SELECT h.*, k.isim AS kategori_adi
      FROM haberler h
      LEFT JOIN kategoriler k ON h.kategori_id = k.id
      WHERE h.kategori_id = ?
      ORDER BY h.tarih DESC
    `, [kategoriId]);

    const [kategoriler] = await db.query("SELECT * FROM kategoriler");

    res.render('index', {
      kullanici: req.session.kullanici,
      haberler,
      duyurular: [], 
      bildirimler: [],
      kategoriler
    });
  } catch (err) {
    console.error("Kategori haber listesi hatası:", err);
    res.send("Kategoriye göre haberler yüklenemedi.");
  }
};

exports.galeri = async (req, res) => {
  try {
    const [haberler] = await db.query(`
      SELECT id, baslik, slug, resim 
      FROM haberler 
      WHERE resim IS NOT NULL 
      ORDER BY id DESC
    `);
    res.render('galeri', { haberler, kullanici: req.session.kullanici });
  } catch (err) {
    console.error("Galeri hatası:", err);
    res.status(500).send("Galeri yüklenemedi.");
  }
};

exports.istatistik = async (req, res) => {
  try {
    const [toplam] = await db.query(`
      SELECT COUNT(DISTINCT cookie_id) AS toplam FROM ziyaretciler
    `);

    const [online] = await db.query(`
      SELECT COUNT(DISTINCT cookie_id) AS online
      FROM ziyaretciler
      WHERE zaman > NOW() - INTERVAL 5 MINUTE
    `);

    res.json({
      toplam: toplam[0].toplam,
      online: online[0].online
    });
  } catch (err) {
    console.error("İstatistik hatası:", err);
    res.status(500).json({ hata: "Veri alınamadı" });
  }
};

exports.haberDuzenleSayfasi = async (req, res) => {
  const haberId = req.params.id;
  const kullanici = req.session.kullanici;

  try {
    const [sonuclar] = await db.query(`
      SELECT h.*, k.isim AS kategori_adi
      FROM haberler h
      LEFT JOIN kategoriler k ON h.kategori_id = k.id
      WHERE h.id = ?
    `, [haberId]);

    const haber = sonuclar[0];

    if (!haber) return res.status(404).send("Haber bulunamadı");

    
    if (kullanici.rol !== 'admin' && kullanici.id !== haber.kullanici_id) {
      return res.status(403).send("Bu haberi düzenlemeye yetkiniz yok");
    }

    const [kategoriler] = await db.query(`SELECT * FROM kategoriler`);

    res.render('haberDuzenle', {
      haber,
      kategoriler,
      kullanici,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Sunucu hatası");
  }
};

exports.haberDuzenleIslem = async (req, res) => {
  const haberId = req.params.id;
  const { baslik, icerik, kategori_id } = req.body;

  let guncelResim = req.body.mevcutResim;

  if (req.file) {
    guncelResim = req.file.filename; 
  }

  try {
    await db.query(`
      UPDATE haberler
      SET baslik = ?, icerik = ?, kategori_id = ?, resim = ?
      WHERE id = ?
    `, [baslik, icerik, kategori_id, guncelResim, haberId]);

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send("Hata oluştu");
  }
};

exports.favoriEkle = async (req, res) => {
  const haberId = req.params.id;
  const kullaniciId = req.session.kullanici?.id;
  if (!kullaniciId) return res.redirect("/login");

  try {
    await db.query(`
      INSERT IGNORE INTO favoriler (kullanici_id, haber_id) VALUES (?, ?)
    `, [kullaniciId, haberId]);

    
    const [rows] = await db.query(`SELECT slug FROM haberler WHERE id = ?`, [haberId]);
    const slug = rows[0]?.slug;

    if (slug) {
      res.redirect(`/haber/${slug}`);
    } else {
      res.redirect("/");
    }
  } catch (err) {
    console.error("Favori ekleme hatası:", err);
    res.redirect("/");
  }
};

exports.favoriKaldir = async (req, res) => {
  const haberId = req.params.id;
  const kullaniciId = req.session.kullanici?.id;
  if (!kullaniciId) return res.redirect("/login");

  const nereden = req.body.nereden;

  try {
    await db.query(`DELETE FROM favoriler WHERE kullanici_id = ? AND haber_id = ?`, [kullaniciId, haberId]);

    if (nereden === "detay") {
      
      const [rows] = await db.query(`SELECT slug FROM haberler WHERE id = ?`, [haberId]);
      const slug = rows[0]?.slug;
      return res.redirect(`/haber/${slug}`);
    }

    res.redirect("/favorilerim"); 
  } catch (err) {
    console.error("Favori silme hatası:", err);
    res.redirect("/");
  }
};

exports.favorilerSayfasi = async (req, res) => {
  const kullaniciId = req.session.kullanici?.id;
  if (!kullaniciId) return res.redirect("/login");

  try {
    const [favoriler] = await db.query(`
      SELECT h.* FROM favoriler f
      JOIN haberler h ON f.haber_id = h.id
      WHERE f.kullanici_id = ?
      ORDER BY f.id DESC
    `, [kullaniciId]);

    res.render("favoriler", {
      favoriler,
      kullanici: req.session.kullanici
    });
  } catch (err) {
    console.error("Favori listeleme hatası:", err);
    res.redirect("/");
  }
};