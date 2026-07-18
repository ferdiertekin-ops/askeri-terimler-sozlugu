# PWA teknik notları

Bu katman, mevcut sözlük sitesini ayrı bir veri tabanı veya ikinci bir yönetim paneli oluşturmadan kurulabilir web uygulamasına dönüştürür.

## Temel bileşenler

- `site.webmanifest`: uygulama kimliği, renkler, kısayollar ve standart/maskelenebilir simgeler.
- `pwa.html`: ilk uygulama açılışında service worker kaydı ve güvenli yönlendirme.
- `sw.js`: uygulama kabuğu, son başarılı `/api/content` yanıtı ve daha önce açılan sayfalar için çevrimdışı önbellek.
- `offline.html`: bağlantı bulunmadığında erişilebilir yedek ekran.
- `icons/`: 192 ve 512 piksel standart/maskelenebilir simgeler ile tek renk simge.

## Sürümleme

Service worker önbellek sürümü `ats-pwa-v2` olarak tanımlanmıştır. Önbelleğe alınan dosyalar değiştirildiğinde bu değer artırılmalıdır.

## Yayın sonrası kontrol

1. `/site.webmanifest` geçerli JSON olarak açılmalı.
2. `/sw.js` yanıtında `Service-Worker-Allowed: /` bulunmalı.
3. Chromium tabanlı tarayıcıda manifest 192×192 ve 512×512 simgeleri tanımalı.
4. iOS Safari’de “Ana Ekrana Ekle” sonrasında uygulama bağımsız pencerede açılmalı.
5. Uygulama bir kez çevrimiçi açıldıktan sonra uçak modunda sözlük ana sayfası ve son alınan `/api/content` verisi erişilebilir olmalı.
