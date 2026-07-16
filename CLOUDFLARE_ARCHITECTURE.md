# Askerî Terimler Sözlüğü 2.0 — Cloudflare Mimarisi

## Hedef

Sözlüğü düşük maliyetli, güvenli, sürümlenebilir ve uluslararası akademik kullanıma uygun bir referans platformuna dönüştürmek.

## Bileşenler

- Cloudflare Pages: statik arayüz ve kalıcı içerik sayfaları
- Pages Functions: salt okunur API, editör API'si ve güvenli oturum
- Cloudflare D1: terimler, varyantlar, kaynaklar, sayfalar ve revizyon geçmişi
- GitHub: kaynak kodu, şema değişiklikleri, inceleme ve sürüm yönetimi

## Temel ilkeler

1. Canlı alan adı geçiş testleri tamamlanmadan taşınmaz.
2. Netlify, geçiş süresince geri dönüş noktası olarak korunur.
3. Kamuya açık API yalnız yayımlanmış kayıtları döndürür.
4. Editör oturumu kısa ömürlü, HttpOnly ve CSRF korumalıdır.
5. Her değişiklik revizyon kaydı ve denetim izi üretir.
6. Sözlük maddeleri kalıcı slug ve sürüm numarası taşır.
7. Kod ile sözlük verisinin lisansları ayrıdır.

## Aşamalar

### Aşama 1 — Temel altyapı

- [x] Cloudflare Pages test projesi
- [x] Geçiş dalı
- [x] D1 şeması
- [x] Sağlık denetimi
- [x] Salt okunur terim API'si
- [ ] D1 veritabanının oluşturulması ve `DB` bağlaması
- [ ] Secrets tanımlanması

### Aşama 2 — Veri göçü

- [ ] Mevcut sözlük anlık görüntüsünün doğrulanması
- [ ] Tekrarlı ve eksik kayıt denetimi
- [ ] D1 içe aktarma betiği
- [ ] Kayıt sayısı ve örneklem karşılaştırması

### Aşama 3 — Güvenli editör

- [ ] Giriş, oturum, çıkış ve CSRF
- [ ] Madde ekleme, düzenleme ve silme
- [ ] Revizyon geçmişi
- [ ] Geri alma
- [ ] Kaynak ve varyant yönetimi

### Aşama 4 — Akademik yayın katmanı

- [ ] Kalıcı terim URL'leri
- [ ] JSON-LD ve Schema.org
- [ ] Atıf dışa aktarımı
- [ ] Sürüm ve yayın tarihi
- [ ] Türkçe ve İngilizce arayüz
- [ ] Kaynakça ve editoryal politika

### Aşama 5 — Geçiş

- [ ] Tam işlev testi
- [ ] Güvenlik testi
- [ ] Performans testi
- [ ] D1 yedeği
- [ ] DNS geçişi
- [ ] Netlify geri dönüş süresi

## D1 bağlama adı

Cloudflare Pages ayarlarında D1 binding adı kesin olarak:

`DB`

olmalıdır.

## Gizli değişkenler

- `EDITOR_PASSWORD_HASH`
- `SESSION_SECRET`

Bu değerler GitHub'a yazılmaz ve ekran görüntülerinde paylaşılmaz.
