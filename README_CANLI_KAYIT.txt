Askerî Terimler Sözlüğü - canlı kayıt düzeltme notu

Bu paket, önceki güncel yayın paketindeki eksik Netlify Function katmanını tamamlar.
Sorun: site /api/content ve /api/content?check=auth adreslerine istek yapıyor; fakat son pakette netlify/functions dizini bulunmadığı için Netlify 404 dönüyordu.

Bu pakette bulunan kritik dosyalar:
- netlify/functions/content.js
- netlify/functions/_shared.js
- netlify/functions/default-content.json
- netlify.toml
- package.json
- _redirects

Netlify Environment Variables içinde şu değerlerin bulunması gerekir:
- EDITOR_PASSWORD_HASH: editör parolasının SHA-256 hash değeri
- NETLIFY_AUTH_TOKEN veya NETLIFY_BLOBS_TOKEN
- NETLIFY_SITE_ID veya NETLIFY_BLOBS_SITE_ID

GitHub'a ZIP içeriğini kök dizine açarak yükleyin. Yükleme sonrasında Netlify'de Clear cache and deploy site yapılmalıdır.


2026-07-09 ek düzeltme: Yayın Notu, Kaynakça, Gizlilik, Çerezler, Kullanım Şartları, İletişim ve Terimler Dizini yolları statik HTML yerine Netlify Functions üzerinden canlı Blobs verisinden üretilecek biçimde zorunlu rewrite edildi. Editör modunda kaydedilen sayfa metinleri doğrudan menü sayfalarında görünür.
