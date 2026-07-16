# Askerî Terimler Sözlüğü

**Askerî Terimler Sözlüğü**, 1876–1918 dönemine ait İngilizce askerî, idarî ve kurumsal terimleri; Osmanlı Türkçesindeki dönem karşılıkları, günümüz Türkçesi karşılıkları, açıklamalar ve kaynak künyeleriyle birlikte sunan iki dilli bir dijital beşerî bilimler projesidir.

**Military Terms Dictionary** is a bilingual digital humanities project that documents English military, administrative, and institutional terminology used between 1876 and 1918 together with period Ottoman Turkish equivalents, modern Turkish equivalents, explanatory notes, and bibliographic references.

## Canlı site / Live website

- https://askeriterimlersozlugu.com

## Projenin amacı

Proje, özellikle İngiliz arşiv belgelerinde geçen askerî ve idarî terimlerin tarihsel bağlam içinde anlaşılmasını kolaylaştırmayı amaçlar. İngiliz kurumları Osmanlı kurumlarıymış gibi gösterilmez; dönemsel karşılık, günümüz karşılığı ve açıklama alanları birbirinden ayrılır. Kesinliği doğrulanmamış karşılıklar yayımlanmış madde olarak sunulmaz.

## Project scope

The project is intended primarily for historians, archivists, translators, students, and researchers working on late Ottoman military and administrative history. It distinguishes between:

- the original English term;
- the period Ottoman Turkish equivalent;
- the modern Turkish equivalent;
- a contextual and terminological explanation;
- bibliographic or archival sources.

## Temel özellikler / Main features

- Türkçe ve İngilizce kullanıcı arayüzü;
- alfabetik terim dizini;
- tekil ve bağlantılanabilir terim sayfaları;
- kart ve liste görünümü;
- kaynak ve künye alanları;
- Netlify Functions tabanlı içerik sunumu;
- arama motorları için sitemap ve robots çıktıları.

## Akademik ve editoryal ilkeler

1. Tarihsel karşılıklar mümkün olduğunca birincil kaynaklar, dönem sözlükleri, resmî yayınlar ve akademik literatürle çapraz kontrol edilir.
2. İngiliz kurum adları, Osmanlı kurumlarıyla özdeşleştirilmeden çevrilir.
3. Anakronik ve bağlam dışı karşılıklardan kaçınılır.
4. Şüpheli okumalar veya doğrulanmamış eşleştirmeler kesin hüküm olarak sunulmaz.
5. Kaynak bilgileri, erişilebildiği ölçüde her maddeyle birlikte verilir.

## Teknik yapı

Proje statik ön yüz, Netlify Functions ve `@netlify/blobs` kullanır.

### Gereksinimler

- Node.js 18 veya üzeri
- npm
- Netlify CLI (yerel işlevleri çalıştırmak için önerilir)

### Yerel kurulum

```bash
git clone https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu.git
cd askeri-terimler-sozlugu
npm install
npm run build
```

Netlify işlevlerini yerel olarak çalıştırmak için:

```bash
npx netlify dev
```

Gizli bilgiler kaynak koduna yazılmamalıdır. Gerekli erişim bilgileri yalnızca yerel `.env` dosyalarında veya Netlify ortam değişkenlerinde tutulmalıdır.

## Katkı

Terim önerileri, kaynak düzeltmeleri, yazılım hataları ve erişilebilirlik geliştirmeleri kabul edilir. Katkı süreci için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakınız.

## Atıf

Akademik kullanımlarda [CITATION.cff](CITATION.cff) dosyasındaki künyenin kullanılması önerilir.

## Lisans

- Yazılım kodu: [MIT License](LICENSE)
- Özgün sözlük verisi ve editoryal metinler: [CC BY 4.0](DATA_LICENSE.md)
- Üçüncü taraf kaynaklardan yapılan alıntılar, görseller ve bibliyografik materyal kendi hak sahiplerinin şartlarına tabidir.

## Durum

Proje beta/deneme aşamasındadır. İçerik ve teknik yapı düzenli olarak geliştirilmektedir.

## Maintainer

Ferdi Ertekin
