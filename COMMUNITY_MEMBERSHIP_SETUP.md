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

## Üretim kill switch'i

Üyelik kodunun repoda ve canlı deploy içinde bulunması, üyeliğin otomatik olarak etkinleşmesi anlamına gelmez.

Üretimde üyelik ancak aşağıdaki değişken ayrıca açıkça tanımlanırsa görünür ve API yazma işlemleri kabul edilir:

- `COMMUNITY_FEATURE_ENABLED=true`

Bu bayrak kapalı veya tanımsızken:

- ana sözlükte `Oturum Aç / Üye Ol` bağlantıları gösterilmez,
- üyelik API'leri kişisel veri kabul etmez,
- bildirim e-postaları gönderilmez,
- editör Topluluk paneli açılmaz,
- `/api/account/config` üyeliği `registrationReady:false` olarak bildirir.

Bayrağın tek başına açılması da yeterli değildir. D1, güvenlik secret'ı, Turnstile ve e-posta yapılandırmasının tamamı hazır değilse sistem yine kapalı kalır.

## D1 migrasyonları

Etkinleştirmeden önce ayrı bir Preview/Test D1 üzerinde, sonra üretim D1 üzerinde sırasıyla uygulanmalıdır:

1. `migrations/20260721_community_membership.sql`
2. `migrations/20260721_community_password_reset.sql`

Migrasyonlar mevcut `terms` veya editör tablolarına dokunmaz; yalnız `community_*` tablolarını oluşturur.

## Gerekli Cloudflare ortam değişkenleri / secrets

Aşağıdaki değerler kod deposuna yazılmamalıdır.

### Özellik bayrağı ve üyelik güvenliği

- `COMMUNITY_FEATURE_ENABLED=true` — yalnız bütün teknik ve hukukî kapılar tamamlandıktan sonra
- `COMMUNITY_SECURITY_SECRET` — en az 32 karakterlik güçlü, rastgele secret
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY` — secret olarak saklanmalı

### E-posta doğrulama ve bildirimleri

- `CF_ACCOUNT_ID`
- `CF_EMAIL_API_TOKEN` — Cloudflare Email Sending için mümkün olan en dar yetkili API token
- `COMMUNITY_EMAIL_FROM` — örn. `uyelik@askeriterimlersozlugu.com`

E-posta alan adı Cloudflare Email Sending tarafında doğrulanmalı ve gerekli DNS kimlik doğrulama kayıtları tamamlanmalıdır.

## Turnstile ve CSP

Sitenin genel Content Security Policy başlığı Turnstile için yalnız gerekli iki kaynağı ayrıca izinli kılar:

- `script-src`: `https://challenges.cloudflare.com`
- `frame-src`: `https://challenges.cloudflare.com`

Bunun dışındaki mevcut CSP sınırlamaları korunur. `community-check` bu iki izni otomatik olarak denetler.

## D1 veri konumu ve zorunlu hukukî kapı

Cloudflare D1'in güncel yargı alanı kısıtları Türkiye seçeneği sunmamaktadır; desteklenen jurisdiction seçenekleri `eu` ve `fedramp` ile sınırlıdır ve bu tercih veritabanı oluşturulurken yapılır. Bu nedenle D1 üzerinde üyelik verisi tutulması, Türkiye bakımından yurt dışı aktarım değerlendirmesini ortadan kaldırmaz.

**Üretim üyeliği, 6698 sayılı Kanun'un 9. maddesine uygun yurt dışına veri aktarım mekanizması somut olarak doğrulanıp tesis edilmeden etkinleştirilmemelidir.** Gerekli durumda KVKK kapsamındaki standart sözleşme veya uygulanabilir başka uygun güvence mekanizması kullanılmalı ve ilgili bildirim yükümlülükleri yerine getirilmelidir.

Cloudflare'ın genel Data Processing Addendum'ındaki AB/İngiltere standart sözleşme hükümleri, Türkiye'deki KVKK standart sözleşmesi yerine kendiliğinden geçmez. Türkiye bakımından uygulanabilir mekanizma ayrıca kurulmalıdır.

Bu nedenle `COMMUNITY_FEATURE_ENABLED` hukukî kontrol tamamlanıncaya kadar kapalı tutulur.

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
4. Preview ortamında `COMMUNITY_FEATURE_ENABLED=true` yap.
5. `/uye-ol/` üzerinden test hesabı oluştur.
6. Doğrulama e-postasını aç ve hesabı etkinleştir.
7. `/oturum-ac/` ile giriş yap.
8. Bir maddeyi favoriye ekle ve `/hesabim/` içinde doğrula.
9. Katkı/düzeltme önerisi gönder; editör oturumunda `/editor/community/` panelinde göründüğünü doğrula.
10. Bildirim tercihlerini aç/kapat ve `community_consents` kaydını denetle.
11. Parola sıfırlama ve kalıcı hesap silme akışlarını test et.
12. Mobil görünümü ve TR/EN sayfalarını kontrol et.
13. Türkiye bakımından yurt dışı aktarım mekanizmasını tamamla.
14. Ancak bütün teknik ve hukukî kontroller tamamlandıktan sonra üretimde `COMMUNITY_FEATURE_ENABLED=true` yap.

## TTS özellik bayrağı

Türkçe/Osmanlıca seslendirme kodu aynı yayında bulunabilir. Ses düğmeleri ancak şu şartlar birlikte sağlanırsa görünür:

- `TTS_FEATURE_ENABLED=true`
- `GOOGLE_TTS_CLIENT_EMAIL` tanımlı
- `GOOGLE_TTS_PRIVATE_KEY` tanımlı

İsteğe bağlı olarak `GOOGLE_TTS_VOICE` ve `GOOGLE_CLOUD_PROJECT_ID` tanımlanabilir. Bayrak kapalıyken sözlüğün mevcut seslendirme davranışı bozulmaz ve yeni TTS istemcisi sayfaya enjekte edilmez.

## Otomatik kontroller

PR üzerinde `.github/workflows/community-check.yml` çalışır:

- üyelik ve TTS JavaScript dosyalarının sözdizimi
- üyelik sayfalarında yinelenen `id` kontrolü
- noindex kontrolü
- Turnstile CSP izinleri
- açık erişim ve özellik bayrağı entegrasyon kontrolleri
- Roma rakamı / IPA TTS altyapısının temel statik kontrolleri
- iki D1 migrasyonunun gerçek SQLite motorunda uygulanabilirliği
- statik build smoke check
