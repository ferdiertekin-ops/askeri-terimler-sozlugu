ASKERÎ TERİMLER SÖZLÜĞÜ — CANLI KAYITLI SÜRÜM

Bu paket, editör panelinde yapılan düzenlemeleri yeniden ZIP indirip manuel deploy yapmadan canlı veriye yazmak için hazırlanmıştır.

ÖNEMLİ:
Bu sürüm Netlify Functions ve Netlify Blobs kullanır. Bu nedenle eski “ZIP’i Netlify Drop’a sürükle” yöntemi bu özellik için yeterli değildir. Paket bir defaya mahsus GitHub bağlantılı Netlify deploy veya Netlify CLI ile deploy edilmelidir. Sonraki sözlük/sayfa düzenlemeleri editör panelindeki Kaydet butonuyla canlı veriye yazılır.

KURULUM ÖZETİ:
1. Bu klasörü bir GitHub deposuna yükleyin.
2. Netlify’da mevcut siteyi bu GitHub deposuna bağlayın veya yeni proje olarak içe aktarın.
3. Build command: npm run build
4. Publish directory: .
5. Functions directory: netlify/functions
6. Deploy tamamlanınca şu adresleri kontrol edin:
   /api/content
   /robots.txt
   /sitemap.xml
   /terimler/
   /kaynakca/

İŞLEYİŞ:
- Editör parolasıyla giriş yapıldığında “Kaydet” artık değişiklikleri Netlify Blobs üzerindeki canlı veriye yazar.
- Ziyaretçiler ana sayfayı açtığında canlı veri okunur.
- /terimler/, /terim/.../, /kaynakca/, /yayin-notu/, /iletisim/ gibi sayfalar Netlify Function tarafından canlı veriden HTML olarak üretilir. Bu, Google’ın doğrudan HTML içerik görmesi için özellikle tercih edilmiştir.
- /sitemap.xml canlı sözlük maddelerine göre dinamik üretilir.
- /robots.txt içinde canlı sitemap adresi otomatik gösterilir.

YEDEKLEME:
Editör panelindeki “Yedek yayın paketini indir” butonu korunmuştur. Bu buton artık zorunlu yayın yöntemi değil, arşiv/yedek alma aracıdır.


ÇİFT DİL NOTU
Bu sürümde Türkçe ana görünüm /, İngilizce görünüm /en/ altındadır. Sözlük verisi ortaktır; İngilizce görünümde başlık, menü, açıklamalar ve statik bilgilendirme sayfaları İngilizce sunulur. Kitap tanıtımı Türkçe bırakılmıştır.
