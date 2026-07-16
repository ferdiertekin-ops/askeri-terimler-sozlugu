# Güvenli Editör Oturumu: Geçiş, Test ve Geri Dönüş Planı

Bu belge, eski yeniden kullanılabilir parola özeti modelinden kısa ömürlü, imzalı ve HttpOnly çerez kullanan yeni editör oturumuna kontrollü geçişi tanımlar.

## Değişmez güvenlik ilkeleri

1. Canlı site, Deploy Preview testleri tamamlanmadan değiştirilmez.
2. Ana dal doğrudan düzenlenmez; değişiklikler yalnız taslak PR üzerinden ilerler.
3. Eski parola özetiyle yazma yolu kapalı tutulur.
4. Parola, parola özeti, SESSION_SECRET ve Netlify erişim belirteçleri hiçbir dosyaya veya PR yorumuna yazılmaz.
5. İçerik değiştiren testten önce Netlify Blobs verisinin güncel yedeği alınır.
6. Her aşamada geri dönüş yolu korunur.

## Yeni uç noktalar

- `POST /api/editor/login`: Parolayı yalnız giriş anında doğrular, kısa ömürlü HttpOnly oturum çerezi verir.
- `GET /api/editor/session`: Oturum durumunu ve CSRF değerini döndürür.
- `POST /api/editor/logout`: Oturum çerezini siler.
- `POST /api/editor/content`: Geçerli oturum, aynı köken ve CSRF doğrulamasıyla içerik yazar.
- `GET /api/editor/health`: Gizli değerleri açıklamadan gerekli ortam yapılandırmasının hazır olup olmadığını bildirir.

## Netlify ortam değişkenleri

Aşağıdaki değerler Netlify arayüzünde tanımlanmalıdır:

- `EDITOR_PASSWORD_HASH`: Editör parolasının 64 karakterlik SHA-256 özeti.
- `SESSION_SECRET`: En az 32 karakterlik, tercihen 48 veya 64 rastgele bayttan üretilmiş güçlü sır.
- `PUBLIC_SITE_ORIGIN`: Canlı ortam için `https://askeriterimlersozlugu.com`.

Deploy Preview ortamında Netlify tarafından sağlanan `DEPLOY_PRIME_URL` otomatik olarak izinli köken listesine alınır. Böylece her önizleme için elle alan adı değiştirmek gerekmez. `PUBLIC_SITE_ORIGIN` yine canlı site alan adı olarak kalabilir.

## Aşama 1 — Salt kimlik doğrulama testi

1. Yeni Deploy Preview'ın başarılı derlendiğini doğrula.
2. `/api/editor/health` adresini aç.
3. Yanıtın HTTP 200 ve `ok: true` olduğunu doğrula.
4. `/admin-secure.html` sayfasını aç.
5. Yanlış parola ile girişin 401 döndürdüğünü doğrula.
6. Hız sınırının 429 döndürdüğü yalnız önizleme ortamında ve test parolasıyla doğrulanır.
7. Doğru parola ile giriş yap.
8. Oturum kontrolünün etkin olduğunu doğrula.
9. Sayfayı yenile; HttpOnly çerez sayesinde oturum sürmeli.
10. Çıkış yap; oturum kontrolü yeniden 401 dönmeli.

Bu aşamada içerik kaydetme düğmesi kullanılmaz.

## Aşama 2 — Yedek ve kontrollü yazma testi

1. Canlı Netlify Blobs anlık görüntüsünü indir ve tarihli bir yedek olarak sakla.
2. Deploy Preview'ın ayrı Blobs bağlamı kullanıp kullanmadığını Netlify yapılandırmasından doğrula.
3. Ayrı bağlam kesin değilse yazma testi yapılmaz.
4. Ayrı bağlam doğrulanırsa yalnızca test amacıyla oluşturulmuş geçici bir kayıt üzerinde ekleme, düzenleme ve silme denemesi yapılır.
5. Her işlemden sonra GET içeriğiyle yazmanın doğruluğu denetlenir.
6. Test kaydı silinir ve anlık görüntünün başlangıç hâline döndüğü karşılaştırılır.

## Aşama 3 — Ana istemci geçişi

1. `index.html` içindeki `sha256Hex`, `sozlukEditorHash`, `sozlukEditorPass` ve `X-Editor-Password-Hash` kullanımları kaldırılır.
2. Giriş `/api/editor/login` üzerinden yapılır.
3. Oturum durumu `/api/editor/session` üzerinden okunur.
4. Yazma istekleri `/api/editor/content` ve `X-CSRF-Token` ile gönderilir.
5. Çıkış `/api/editor/logout` üzerinden yapılır.
6. Ham HTML kabul eden editör alanları düz metin veya izinli sınırlı biçimlendirmeye dönüştürülür.
7. Eski `/api/content` yalnız GET olarak kalır.

## Aşama 4 — Son doğrulama

- `npm test` başarılı olmalı.
- Netlify build başarılı olmalı.
- Sağlık kontrolü 200 dönmeli.
- Yanlış parola reddedilmeli.
- Yabancı Origin reddedilmeli.
- Cross-site istek reddedilmeli.
- Değiştirilmiş oturum çerezi reddedilmeli.
- Yanlış CSRF reddedilmeli.
- Oturum süresi sonunda yeniden giriş istenmeli.
- Eski parola özetiyle yazma 410 dönmeli.
- Statik site, Türkçe/İngilizce geçiş, arama ve terim sayfaları bozulmamalı.

## Ana dala alma sırası

1. PR #2 testleri tamamlanır.
2. Ana istemci yeni oturuma geçirilir.
3. Deploy Preview üzerinde tam regresyon testi yapılır.
4. Netlify ortam değişkenlerinin production kapsamı doğrulanır.
5. Editör parolası değiştirilir ve yeni özeti kaydedilir.
6. `SESSION_SECRET` üretim için yeniden oluşturulur.
7. PR ana dala alınır.
8. Canlı deploy sonrası önce yalnız okuma testi yapılır.
9. Ardından kontrollü tek kayıt düzenleme testi yapılır.
10. Sorun yoksa açık kaynak belgelerini içeren PR #1 güncel ana dala göre yeniden düzenlenir.

## Geri dönüş planı

Canlı geçişten sonra sorun çıkarsa:

1. Netlify'da son sağlıklı production deploy yeniden yayımlanır.
2. Veri yazılmışsa tarihli Netlify Blobs yedeğiyle karşılaştırılır.
3. Gerekirse yalnız etkilenen kayıt geri yüklenir; bütün veri körlemesine üzerine yazılmaz.
4. `SESSION_SECRET` ve editör parolası döndürülür.
5. Sorun giderilmeden depo public yapılmaz ve açık kaynak başvurusu gönderilmez.

## Public yapma ön koşulları

- PR #2 tamamen tamamlanmış ve canlıda doğrulanmış olmalı.
- Eski kimlik doğrulama kodu bulunmamalı.
- Commit geçmişi gizli bilgi taramasından geçirilmiş olmalı.
- Eski GitHub/Netlify erişim belirteçleri döndürülmüş olmalı.
- PR #1'deki lisans, kapsam ve atıf bilgileri editoryal olarak onaylanmış olmalı.
