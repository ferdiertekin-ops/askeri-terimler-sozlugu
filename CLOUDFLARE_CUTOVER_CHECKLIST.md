# Cloudflare Üretime Geçiş Kontrol Listesi

Kod tarafındaki geçiş yolu `agent/cloudflare-migration` dalında hazırlanmıştır. Aşağıdaki adımlar Cloudflare ve DNS hesabında yetki gerektirdiği için üretim geçişi sırasında uygulanır.

## Geçişten önce

- [ ] Cloudflare D1 üretim veritabanının yedeğini indir.
- [ ] Pages projesinde Production ve Preview için `DB` bağlamasını doğrula.
- [ ] Production ve Preview için `EDITOR_PASSWORD_HASH` ve `SESSION_SECRET` secret değerlerini doğrula.
- [ ] `/api/health` yanıtının 200 ve tüm kontrollerin `true` olduğunu doğrula.
- [ ] `/`, `/en/`, `/terimler/`, bir `/terim/:slug/` sayfası, `/sitemap.xml` ve `/editor/` yollarını test et.
- [ ] Cloudflare Pages üretim dalını geçici olarak `agent/cloudflare-migration` seç veya PR #3'ü ana dala birleştir.
- [ ] Netlify proje adresini ve mevcut DNS kayıtlarını geri dönüş amacıyla kaydet.

## DNS geçişi

- [ ] `askeriterimlersozlugu.com` ve `www` alanlarını Cloudflare Pages özel alan adlarına ekle.
- [ ] Cloudflare'ın istediği DNS kayıtlarını uygula.
- [ ] SSL sertifikasının Active olduğunu doğrula.
- [ ] Tek bir canonical alan adı seç; diğerini 301 ile yönlendir.

## Geçişten sonra

- [ ] Ana sayfanın D1 arayüzünü gösterdiğini doğrula.
- [ ] Türkçe ve İngilizce aramayı, sayfalamayı, madde ayrıntısını ve seslendirmeyi doğrula.
- [ ] Editör girişini, yeni maddeyi, düzenlemeyi ve kontrollü bir test kaydının silinmesini doğrula.
- [ ] `robots.txt` içinde üretim sitemap adresini doğrula.
- [ ] Sitemap'i Google Search Console ve Bing Webmaster Tools'a yeniden gönder.
- [ ] 404, 5xx ve Functions hata oranlarını ilk 24 saat izle.
- [ ] Netlify geri dönüş noktasını en az 7 gün koru.

## Geri dönüş

Kritik hata durumunda DNS kaydını kayıt altına alınmış Netlify hedefine geri çevir. D1'e geçiş sonrasında yapılan editör değişikliklerini geri dönüşten önce ayrıca dışa aktar; aksi hâlde Netlify verisi bu değişiklikleri içermez.
