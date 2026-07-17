# Askerî Terimler Sözlüğü 2.0 — Cloudflare Mimarisi

## Hedef

Sözlüğü düşük maliyetli, güvenli, sürümlenebilir ve uluslararası akademik kullanıma uygun bir referans platformuna dönüştürmek.

## Bileşenler

- Cloudflare Pages: statik arayüz ve kalıcı içerik sayfaları
- Pages Functions: D1 arama API'si, kalıcı terim sayfaları, sitemap ve güvenli editör API'si
- Cloudflare D1: terimler, varyantlar, kaynaklar, sayfalar, revizyon geçmişi ve denetim izi
- GitHub: kaynak kodu, şema değişiklikleri, inceleme ve sürüm yönetimi
- Netlify: DNS geçişi sonrasındaki doğrulama süresi boyunca geri dönüş noktası

## Temel ilkeler

1. Canlı alan adı geçiş testleri tamamlanmadan taşınmaz.
2. Netlify, geçiş süresince geri dönüş noktası olarak korunur.
3. Kamuya açık API yalnız yayımlanmış kayıtları döndürür.
4. Editör oturumu kısa ömürlü, HttpOnly, Secure, SameSite=Strict ve CSRF korumalıdır.
5. Her editör değişikliği revizyon kaydı ve denetim izi üretir.
6. Sözlük maddeleri kalıcı slug ve sürüm numarası taşır.
7. Kod ile sözlük verisinin lisansları ayrıdır.
8. Gizli değerler yalnız Cloudflare secret olarak tutulur.

## Tamamlanan aşamalar

### Aşama 1 — Temel altyapı

- [x] Cloudflare Pages test projesi
- [x] Geçiş dalı
- [x] D1 şeması ve şema göçleri
- [x] Sağlık denetimi
- [x] Salt okunur terim API'si
- [x] D1 veritabanı ve `DB` bağlaması
- [x] `EDITOR_PASSWORD_HASH` ve `SESSION_SECRET` secret değerleri

### Aşama 2 — Veri göçü

- [x] Kaynak anlık görüntüsünün ve 1234 kaynak satırının denetlenmesi
- [x] Slug çakışmalarının birleştirme/ayırma kurallarıyla çözülmesi
- [x] D1 içe aktarma akışı
- [x] 1232 toplam kayıt ve 1218 yayımlanmış kayıt karşılaştırması
- [x] Varyant, kaynak ve örnek madde denetimi

### Aşama 3 — Güvenli editör

- [x] Giriş, oturum, çıkış ve CSRF
- [x] Madde ekleme, düzenleme ve kalıcı silme
- [x] Revizyon geçmişi kaydı
- [x] Denetim izi
- [x] Kaynak ve varyant yönetimi
- [x] Sayfa metni API'si
- [ ] Revizyon geri alma arayüzü

### Aşama 4 — Akademik yayın katmanı

- [x] Kalıcı Türkçe ve İngilizce terim URL'leri
- [x] DefinedTerm JSON-LD
- [x] D1 tabanlı terimler dizini
- [x] D1 tabanlı dinamik sitemap
- [x] Türkçe ve İngilizce D1 arayüzü
- [x] Kaynakça ve editoryal politika sayfaları
- [ ] BibTeX/RIS atıf dışa aktarımı

### Aşama 5 — Geçiş

- [x] Önizleme arama, ayrıntı ve dil testi
- [x] Güvenlik başlıkları ve editör erişim sınırları
- [x] Netlify çalışma zamanı bağımlılığının Cloudflare üretim yolundan kaldırılması
- [ ] D1 üretim yedeği
- [ ] Cloudflare özel alan adı ekleme ve DNS geçişi
- [ ] DNS sonrası HTTPS, canonical, sitemap ve editör doğrulaması
- [ ] Netlify geri dönüş süresinin tamamlanması

## Üretim yönlendirmesi

`functions/_middleware.js` şu üretim yollarını Cloudflare üzerinde yönetir:

- `/` → Türkçe D1 sözlük arayüzü
- `/en/` → İngilizce D1 sözlük arayüzü
- `/terimler/` ve `/en/terms/` → D1 terimler dizini
- `/terim/:slug/` ve `/en/term/:slug/` → kalıcı D1 madde sayfaları
- `/sitemap.xml` ve `/robots.txt` → D1 ve üretim alan adıyla oluşturulan SEO çıktıları
- `/editor/` ve `/api/editor/*` → güvenli editör

## D1 bağlama adı

Cloudflare Pages ayarlarında D1 binding adı kesin olarak:

`DB`

olmalıdır.

## Gizli değişkenler

- `EDITOR_PASSWORD_HASH`: editör parolasının küçük harfli SHA-256 özeti
- `SESSION_SECRET`: en az 32 karakterlik rastgele oturum imzalama anahtarı

Bu değerler GitHub'a, loglara veya ekran görüntülerine yazılmaz.

## Yapılandırma notu

Cloudflare Pages ayarları hâlen Dashboard tarafından yönetilmektedir. Resmî Cloudflare önerisi gereği, proje ayarlarını kaynak koduna taşımadan önce mevcut yapılandırma `npx wrangler pages download config <PROJECT_NAME>` komutuyla indirilip Dashboard değerleriyle karşılaştırılmalıdır. Veritabanı kimliği bilinmeden elle `wrangler.jsonc` oluşturulmamalıdır.
