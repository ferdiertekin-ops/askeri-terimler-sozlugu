# Topluluk / Üyelik Pilotu

Bu özellik, Askerî Terimler Sözlüğü'nün açık erişim ilkesini değiştirmez. Sözlüğün bütün maddeleri üyelik olmadan okunur. Üyelik yalnız kişisel çalışma araçları ve topluluk katılımı sağlar.

## Sağlanan özellikler

- E-posta doğrulamalı üyelik
- Güvenli üye oturumu (`HttpOnly`, `Secure`, `SameSite=Strict`)
- Turnstile korumalı kayıt, giriş, doğrulama tekrar gönderimi ve parola sıfırlama
- Favori madde listesi
- İsteğe bağlı profil: ad/soyad, kurum/üniversite, çalışma alanı
- Editöre katkı/düzeltme/kaynak/yeni terim önerisi
- İsteğe bağlı yeni madde ve güncelleme e-posta bildirimleri
- Bildirimlerden tek tıklamayla ayrılma bağlantısı
- Üye parola değiştirme ve hesabı kalıcı silme
- Editör için salt-okunur Topluluk paneli
- Üyelik ve editör kimlik doğrulaması birbirinden tamamen ayrıdır

## D1 migrasyonları

Canlıya geçmeden önce önce ayrı bir Preview/Test D1 üzerinde, sonra üretim D1 üzerinde sırasıyla uygulanmalıdır:

1. `migrations/20260721_community_membership.sql`
2. `migrations/20260721_community_password_reset.sql`

Migrasyonlar mevcut `terms` veya editör tablolarına dokunmaz; yalnız `community_*` tablolarını oluşturur.

## Gerekli Cloudflare ortam değişkenleri / secrets

Aşağıdaki değerler kod deposuna yazılmamalıdır.

### Üyelik güvenliği

- `COMMUNITY_SECURITY_SECRET` — en az 32 karakterlik güçlü, rastgele secret
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY` — secret olarak saklanmalı

### E-posta doğrulama ve bildirimleri

- `CF_ACCOUNT_ID`
- `CF_EMAIL_API_TOKEN` — Cloudflare Email Sending için mümkün olan en dar yetkili API token
- `COMMUNITY_EMAIL_FROM` — örn. `Askerî Terimler Sözlüğü <uyelik@askeriterimlersozlugu.com>`

E-posta alan adı Cloudflare Email Sending tarafında doğrulanmalı ve gerekli SPF/DKIM kayıtları tamamlanmalıdır.

## Canlıya geçmeden önce zorunlu hukukî kapı

Üyelik e-posta ve profil verisi topladığı için, Cloudflare altyapısında kişisel verilerin yurt dışında işlenmesi/aktarılması ihtimali bulunmaktadır.

**Üretim üyeliği, 6698 sayılı Kanun'un 9. maddesine uygun yurt dışına veri aktarım mekanizması somut olarak doğrulanıp tesis edilmeden etkinleştirilmemelidir.** Gerekli durumda standart sözleşme veya uygulanabilir başka uygun güvence mekanizması kullanılmalı ve ilgili bildirim yükümlülükleri yerine getirilmelidir.

Bu nedenle bu özellik, teknik olarak hazır olsa bile söz konusu hukukî kontrol tamamlanıncaya kadar pilot/preview durumunda tutulmalıdır.

## KVKK tasarım ilkeleri

- Kayıt ekranında aydınlatma metni için zorunlu bir “kabul ediyorum” kutusu yoktur.
- Aydınlatma metni kayıt anında görünür biçimde bağlantılanır.
- Yeni madde/güncelleme e-postaları için açık rıza seçenekleri aydınlatmadan ayrı ve isteğe bağlıdır.
- Bildirim rızası verilmemesi üyeliği engellemez.
- Telefon, doğum tarihi, T.C. kimlik numarası veya adres toplanmaz.
- Ad/soyad, kurum ve çalışma alanı isteğe bağlıdır.
- Hız sınırlamasında ham IP adresi kalıcı olarak saklanmaz; HMAC ile üretilmiş kova anahtarı tutulur.

## Preview test sırası

1. Preview D1 binding'ini bağla ve iki migrasyonu uygula.
2. Preview için Turnstile anahtarlarını ekle; preview alan adını Turnstile host listesinde doğrula.
3. E-posta gönderim ayarlarını ekle.
4. `/uye-ol/` üzerinden test hesabı oluştur.
5. Doğrulama e-postasını aç ve hesabı etkinleştir.
6. `/oturum-ac/` ile giriş yap.
7. Bir maddeyi favoriye ekle ve `/hesabim/` içinde doğrula.
8. Katkı/düzeltme önerisi gönder; editör oturumunda `/editor/community/` panelinde göründüğünü doğrula.
9. Bildirim tercihlerini aç/kapat ve `community_consents` kaydını denetle.
10. Parola sıfırlama ve kalıcı hesap silme akışlarını test et.
11. Mobil görünümü ve TR/EN sayfalarını kontrol et.
12. Ancak bütün teknik ve hukukî kontroller tamamlandıktan sonra `main` ile birleştir.

## Otomatik kontroller

PR üzerinde `.github/workflows/community-check.yml` çalışır:

- yeni JavaScript dosyalarının sözdizimi
- üyelik sayfalarında yinelenen `id` kontrolü
- noindex kontrolü
- temel güvenlik/entegrasyon kontrolleri
- iki D1 migrasyonunun gerçek SQLite motorunda uygulanabilirliği
- statik build smoke check
