# Güvenlik Değişiklik Günlüğü

## Hazırlık dalı: `agent/secure-editor-session`

### Tamamlananlar

- İmzalı, 45 dakika geçerli oturum belirteci eklendi.
- Oturum çerezi `HttpOnly`, `Secure`, `SameSite=Strict` olarak tanımlandı.
- CSRF doğrulaması eklendi.
- Aynı köken denetimi canlı alan adı ile Netlify `URL`, `DEPLOY_URL` ve `DEPLOY_PRIME_URL` değerlerini güvenli biçimde destekleyecek şekilde sıkılaştırıldı.
- `Sec-Fetch-Site` çapraz site istekleri reddediliyor.
- Eski parola özetiyle doğrulama ve yazma yolu `410 Gone` ile kapatıldı.
- Giriş ve yazma uç noktalarına hız sınırlaması eklendi.
- Güvenlik sağlık kontrolü eklendi: `/api/editor/health`.
- Statik güvenlik başlıklarına HSTS ve yönetim sayfası için `noindex/noarchive` kuralları eklendi.
- Oturum imzası, parola doğrulaması, köken, CSRF ve değiştirilmiş çerez senaryolarını sınayan `npm test` duman testi eklendi.
- `admin-secure.html` bilerek salt okunur hâle getirildi; yanlışlıkla bütün veri anlık görüntüsünü değiştirecek yazma düğmesi kaldırıldı.
- Ayrıntılı geçiş, test ve geri dönüş planı yazıldı.

### Henüz tamamlanmayanlar

- Ana `index.html` istemcisinin yeni oturum uç noktalarına geçirilmesi.
- Eski istemci tarafı parola özeti kodunun tamamen kaldırılması.
- Ham HTML kabulünün kaldırılması veya güvenli izin listesiyle sınırlandırılması.
- Deploy Preview üzerinde gerçek ortam değişkenleriyle kimlik doğrulama testi.
- Netlify Blobs önizleme/üretim ayrımının doğrulanması.
- Tam ekleme, düzenleme, silme ve iki dilli sayfa metni regresyon testi.
- Commit geçmişinin bağımsız gizli bilgi tarama aracıyla taranması.

Bu maddeler tamamlanmadan PR birleştirilmemeli ve depo public yapılmamalıdır.
