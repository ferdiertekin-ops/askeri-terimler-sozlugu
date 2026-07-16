# Deploy Preview Güvenlik Testi

## Test adresleri

Deploy Preview ana adresinin sonuna aşağıdaki yollar eklenir:

- `/api/editor/health`
- `/admin-secure.html`

## Beklenen sonuçlar

### Sağlık kontrolü

`/api/editor/health` yanıtı:

```json
{
  "ok": true,
  "checks": {
    "editorPasswordHash": true,
    "sessionSecret": true,
    "allowedOrigin": true
  }
}
```

`ok: false` veya HTTP 503, Netlify ortam değişkenlerinden en az birinin eksik olduğunu gösterir.

### Güvenli test sayfası

1. Sayfa açıldığında yapılandırma durumu yeşil görünmelidir.
2. Yanlış parola 401 ile reddedilmelidir.
3. Doğru parola girişinde HttpOnly oturum oluşturulmalıdır.
4. Oturum kontrolü bitiş zamanını göstermelidir.
5. Sayfa yenilendiğinde oturum sürmelidir.
6. Canlı içerik yalnız salt okunur alana yüklenmelidir.
7. Çıkıştan sonra oturum kontrolü 401 dönmelidir.

## Yapılmaması gerekenler

- Parola veya SESSION_SECRET ekran görüntüsünde paylaşılmaz.
- Ortam değişkeni değerleri GitHub dosyasına yazılmaz.
- Deploy Preview'ın Blobs ayrımı doğrulanmadan içerik yazma testi yapılmaz.
- PR birleştirilmez.
- Depo public yapılmaz.
