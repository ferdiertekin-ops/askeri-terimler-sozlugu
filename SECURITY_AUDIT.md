# Güvenlik Denetimi

**Tarih:** 16 Temmuz 2026  
**Kapsam:** Askerî Terimler Sözlüğü GitHub deposunun kamuya açılmadan önce incelenmesi

## Genel sonuç

Depo mevcut hâliyle **public yapılmamalıdır**. Kaynak kodda doğrudan gömülü bir parola, API anahtarı veya Netlify erişim belirteci tespit edilmemiştir. Bununla birlikte editör kimlik doğrulama tasarımında düzeltilmesi gereken önemli güvenlik zayıflıkları vardır.

Bu belge, yalnızca erişilebilen güncel dal ve seçili commitler üzerinde yapılan statik incelemeyi kaydeder. Netlify ortam değişkenleri, GitHub Secret Scanning sonuçları ve bütün commit geçmişi ayrıca denetlenmelidir.

## Kritik bulgu: parola özetinin oturum kimliği olarak kullanılması

Tarayıcı, editör parolasını SHA-256 ile özetlemekte ve bu özeti `X-Editor-Password-Hash` başlığında sunucuya göndermektedir. Başarılı girişten sonra aynı özet `sessionStorage` içinde saklanmaktadır. Sunucu ise 64 karakterlik geçerli bir SHA-256 değerini doğrudan beklenen parola özetiyle karşılaştırarak yetki vermektedir.

Bu tasarımda parola özeti, fiilen parolanın yerine geçen yeniden kullanılabilir bir kimlik bilgisine dönüşür. Özeti ele geçiren biri gerçek parolayı bilmeden editör yetkisi kullanabilir. Bu durum yaygın olarak “pass-the-hash” sınıfında değerlendirilir.

### Zorunlu düzeltme

- Parola özeti istemci tarafından kalıcı veya oturumluk depolamada tutulmamalıdır.
- Başarılı parola doğrulamasından sonra sunucu, kısa ömürlü ve imzalı bir oturum üretmelidir.
- Oturum tercihen `HttpOnly`, `Secure` ve `SameSite=Strict` nitelikli çerezle taşınmalıdır.
- Yazma istekleri parola veya parola özeti yerine bu kısa ömürlü oturumla yetkilendirilmelidir.
- Oturum süresi sınırlı olmalı ve kilitleme işleminde geçersizleştirilebilmelidir.

## Yüksek bulgu: geniş CORS politikası

JSON yanıtlarında `Access-Control-Allow-Origin: *` kullanılmakta; ayrıca parola ve parola özeti başlıklarına izin verilmektedir. Her ne kadar özel başlıklar tarayıcıda ön kontrol gerektirse de, yönetim/yazma uç noktalarında yıldız CORS politikası gereksiz saldırı yüzeyi oluşturur.

### Zorunlu düzeltme

- Yazma ve kimlik doğrulama uç noktaları yalnızca sitenin kesin kökenine izin vermelidir.
- Geliştirme ortamları gerekiyorsa açık bir izin listesiyle tanımlanmalıdır.
- `Origin` ve mümkünse `Host` doğrulaması sunucu tarafında yapılmalıdır.

## Yüksek bulgu: doğrulanmış hız sınırlaması bulunmaması

İstemci kodu `429 Too Many Requests` yanıtını ele almaktadır; fakat incelenen sunucu işlevlerinde başarısız giriş denemelerini sayan veya IP/oturum temelli hız sınırlaması uygulayan bir mekanizma görülmemiştir.

### Zorunlu düzeltme

- Kimlik doğrulama uç noktasına IP ve zaman penceresi temelli hız sınırı eklenmelidir.
- Ardışık başarısız denemelerde artan gecikme veya geçici kilitleme uygulanmalıdır.
- Netlify/WAF katmanında ek oran sınırlaması etkinleştirilmelidir.

## Orta bulgu: düz parola ortam değişkeniyle geriye dönük uyumluluk

Sunucu `EDITOR_PASSWORD_HASH` yanında `EDITOR_PASSWORD` ve `ATS_EDITOR_PASSWORD` değişkenlerini de kabul etmektedir. Düz parolanın ortam değişkeninde bulunması kaynak kodda görünmese de gereksiz bir risk ve yapılandırma karmaşasıdır.

### Önerilen düzeltme

- Yalnız güçlü ve rastgele bir sunucu sırrı ile güvenli parola türetme çıktısı kullanılmalıdır.
- Düz parola değişkenleri kaldırılmalıdır.
- SHA-256 yerine parola saklama/doğrulama için Argon2id, scrypt veya bcrypt gibi yavaş bir parola türetme yöntemi tercih edilmelidir.

## Orta bulgu: içerik editöründe ham HTML kabulü

Sayfa editörü, metin içinde HTML etiketi tespit ettiğinde içeriği doğrudan HTML olarak yayımlayabilmektedir. Bu özellik editör hesabı ele geçirilirse kalıcı XSS oluşturulmasına imkân verir; ayrıca parola özetinin `sessionStorage` içinde tutulması etkinin büyümesine yol açar.

### Önerilen düzeltme

- Ham HTML varsayılan olarak devre dışı bırakılmalıdır.
- Gerekliyse izin verilen etiket ve niteliklerden oluşan sıkı bir temizleme listesi uygulanmalıdır.
- `script`, olay nitelikleri, `javascript:` URL’leri, iframe ve gömülü nesneler tamamen engellenmelidir.
- Güçlü bir Content Security Policy eklenmelidir.

## Orta bulgu: güvenlik başlıklarının eksikliği

İncelenen yapılandırmada aşağıdaki güvenlik başlıkları açık biçimde tanımlanmamıştır:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Frame-Options` veya CSP `frame-ancestors`

Bunlar Netlify başlık yapılandırması veya işlev yanıtları üzerinden eklenmelidir.

## Commit geçmişi ve gizli bilgi denetimi

Depo içi kod aramasında açık biçimde gömülü token, API anahtarı veya parola bulunmamıştır. Ancak bu sonuç aşağıdakilerin yerine geçmez:

1. GitHub Secret Scanning ve push protection kontrolü;
2. bütün commit geçmişinin `gitleaks` veya `trufflehog` ile taranması;
3. Netlify ortam değişkenlerinin gözden geçirilmesi;
4. daha önce kullanılmış GitHub ve Netlify tokenlarının döndürülmesi;
5. yerel ZIP/yedek dosyalarında gizli bilgi taraması.

## Public yapma öncesi zorunlu kontrol listesi

- [ ] Parola özeti tabanlı yetkilendirme kaldırıldı.
- [ ] Kısa ömürlü, imzalı ve HttpOnly editör oturumu getirildi.
- [ ] CORS yalnız kesin üretim kökeniyle sınırlandı.
- [ ] Kimlik doğrulama oran sınırı uygulandı ve test edildi.
- [ ] Ham HTML temizleme mekanizması eklendi.
- [ ] Güvenlik başlıkları tanımlandı.
- [ ] Netlify ortam değişkenleri denetlendi.
- [ ] Tüm commit geçmişi secret scanner ile tarandı.
- [ ] Eski erişim belirteçleri döndürüldü veya iptal edildi.
- [ ] Editör parolası kamuya açılma öncesinde değiştirildi.
- [ ] Ana dal koruması ve pull request zorunluluğu etkinleştirildi.

Bu maddeler tamamlanmadan depo görünürlüğü değiştirilmemelidir.
