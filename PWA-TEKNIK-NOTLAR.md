# PWA teknik notları

Bu katman, mevcut sözlük sitesini ayrı bir veri tabanı veya ikinci bir yönetim paneli oluşturmadan kurulabilir web uygulamasına dönüştürür.

## Temel bileşenler

- `site.webmanifest`: uygulama kimliği, renkler, kısayollar ve standart/maskelenebilir simgeler.
- `pwa.html`: kurulu uygulamanın ilk açılış ekranı, service worker kaydı ve güvenli yönlendirme.
- `uygulama/index.html`: Android, masaüstü ve iOS için iki dilli, cihaz duyarlı kurulum sayfası.
- `sw.js`: uygulama kabuğu, son başarılı `/api/content` yanıtı ve daha önce açılan sayfalar için çevrimdışı önbellek.
- `offline.html`: bağlantı bulunmadığında erişilebilir yedek ekran.
- `icons/`: 192 ve 512 piksel standart/maskelenebilir simgeler ile tek renk simge.

## Sürümleme

Service worker önbellek sürümü `ats-pwa-v3` olarak tanımlanmıştır. Önbelleğe alınan dosyalar değiştirildiğinde bu değer artırılmalıdır.

## Kurulum adresi

Kullanıcıya gösterilecek temiz kurulum adresi `/uygulama/` yoludur. Sayfa, desteklenen Chromium tarayıcılarda yerel kurulum istemini açar; iPhone ve iPad’de Safari’nin “Ana Ekrana Ekle” adımlarını gösterir. Uygulama zaten kuruluysa bunu algılayarak yeniden kurulum düğmesini gizler.

## Yayın sonrası kontrol

1. `/site.webmanifest` geçerli JSON olarak açılmalı.
2. `/sw.js` yanıtında `Service-Worker-Allowed: /` bulunmalı.
3. `/uygulama/` sayfası Türkçe ve İngilizce arayüzler arasında geçiş yapmalı.
4. Chromium tabanlı tarayıcıda manifest 192×192 ve 512×512 simgeleri tanımalı.
5. iOS Safari’de “Ana Ekrana Ekle” sonrasında uygulama bağımsız pencerede açılmalı.
6. Uygulama bir kez çevrimiçi açıldıktan sonra uçak modunda sözlük ana sayfası ve son alınan `/api/content` verisi erişilebilir olmalı.
7. `/api/editor/`, `/api/migration/` ve `/editor/` istekleri service worker tarafından önbelleğe alınmamalı.
