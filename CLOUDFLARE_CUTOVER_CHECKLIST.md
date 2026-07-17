# Cloudflare Üretime Geçiş Kontrol Listesi

Kod tarafındaki geçiş yolu `agent/cloudflare-migration` dalında hazırlanmıştır. Aşağıdaki adımlar Cloudflare ve DNS hesabında yetki gerektirdiği için üretim geçişi sırasında uygulanır.

## Geçişten önce

- [ ] Cloudflare D1 üretim veritabanının yedeğini indir.
- [ ] Pages projesinde Production ve Preview için `DB` bağlamasını doğrula.
- [ ] Production ve Preview için `EDITOR_PASSWORD_HASH` ve `SESSION_SECRET` secret değerlerini doğrula.
- [ ] `/api/health` yanıtının 200 ve tüm kontrollerin `true` olduğunu doğrula.
- [ ] Mevcut D1 veritabanını tek yetkili veri kaynağı kabul et; kaynak dosyasından yeniden içe aktarma, eksik madde ekleme veya kaynakça üzerine yazma işlemi çalıştırma.
- [ ] Geçiş öncesi D1 toplam/yayındaki madde ve kaynak sayılarını kaydet; geçiş sonrasında aynı sayılarla birebir karşılaştır.
- [ ] `/`, `/en/`, `/terimler/`, bir `/terim/:slug/` sayfası, `/sitemap.xml` ve `/editor/` yollarını test et.
- [ ] Aramada `sani` ve `sâni` sorgularının aynı sonuçları verdiğini ve tam “Sânî” maddesini ilk sıraya taşıdığını doğrula.
- [ ] Editörde Yayın Notu, Kaynakça, Gizlilik, Çerezler, Kullanım Şartları, İletişim ve ana sayfa alt açıklamasını test metniyle kaydet; tek Enter’ın satır sonu, boş satırın yeni paragraf olduğunu doğrula ve test metnini geri al.
- [ ] Daha önce D1'e kaydedilmiş “Kubbealtı Lugatı” kaynağının yeni bir kaynak satırında `K` yazıldığında önerildiğini ve kayıtlı bağlantısının otomatik geldiğini doğrula; bu test sırasında kaynak dosyasından veri alma.
- [ ] Cloudflare Pages üretim dalını geçici olarak `agent/cloudflare-migration` seç veya PR #3'ü ana dala birleştir.
- [ ] Netlify proje adresini ve mevcut DNS kayıtlarını geri dönüş amacıyla kaydet.

## DNS geçişi

- [ ] `askeriterimlersozlugu.com` ve `www` alanlarını Cloudflare Pages özel alan adlarına ekle.
- [ ] Cloudflare'ın istediği DNS kayıtlarını uygula.
- [ ] SSL sertifikasının Active olduğunu doğrula.
- [ ] Tek bir canonical alan adı seç; diğerini 301 ile yönlendir.

## Geçişten sonra

- [ ] Ana sayfanın son kaydedilmiş D1 verisini gösterdiğini; toplam/yayındaki madde ve kaynak sayılarının geçiş öncesi değerlerle değişmeden kaldığını doğrula.
- [ ] Türkçe ve İngilizce aramayı, üst/alt sayfalamayı, kategori renklerini, sıkılaştırılmış liste görünümünü, madde ayrıntısını ve seslendirmeyi doğrula.
- [ ] Altı bilgilendirme sayfasının ve ana sayfa alt açıklamasının editördeki son metinleri gösterdiğini; EB Garamond ile iki yana yaslı yayımlandığını doğrula.
- [ ] En az bir çevrimiçi sözlük kaynağının yeni sekmede ve güvenli `https://` bağlantısıyla açıldığını doğrula.
- [ ] Editörde kaydedilmemiş bir madde ve sayfa taslağıyla başka kayıt/moda geç; geri dönüldüğünde taslağın aynı sekmede korunduğunu doğrula.
- [ ] Aynı maddeyi iki sekmede açıp ilk sekmede kaydet; ikinci sekmenin eski sürümü üzerine yazmak yerine sürüm çakışması uyarısı verdiğini doğrula.
- [ ] Yeni madde ekleme, mevcut maddeyi kaydetme ve kontrollü silme sonrasında toplam/yayındaki madde sayaçlarının D1 ile anında eşleştiğini doğrula.
- [ ] Kontrollü bir test maddesini sil; madde, kaynak, varyant ve revizyon satırlarının tümünün sıfırlandığını doğrula.
- [ ] Son GitHub Actions paketini aç; `PACKAGE_VERSION.txt` içindeki commit değerinin paketlenen dalın HEAD commit’iyle aynı olduğunu doğrula.
- [ ] `robots.txt` içinde üretim sitemap adresini doğrula.
- [ ] Sitemap'i Google Search Console ve Bing Webmaster Tools'a yeniden gönder.
- [ ] 404, 5xx ve Functions hata oranlarını ilk 24 saat izle.
- [ ] Netlify geri dönüş noktasını en az 7 gün koru.

## Geri dönüş

Kritik hata durumunda DNS kaydını kayıt altına alınmış Netlify hedefine geri çevir. D1'e geçiş sonrasında yapılan editör değişikliklerini geri dönüşten önce ayrıca dışa aktar; aksi hâlde Netlify verisi bu değişiklikleri içermez.
