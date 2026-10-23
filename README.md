# Çevrimiçi Askerî Terimler Sözlüğü (1876–1918)

**English–Turkish terminology for Ottoman military history, with Turkish and English interfaces.**

[Canlı sözlük / Live dictionary](https://askeriterimlersozlugu.com/) · [English interface](https://askeriterimlersozlugu.com/en/) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Türkçe

Askerî Terimler Sözlüğü, 1876–1918 Osmanlı askerî tarihi üzerine çalışan araştırmacıların, öğrencilerin ve tarihî belge okurlarının İngilizce askerî terimleri, dönemsel Osmanlı karşılıklarını ve Türkçe açıklamaları birlikte inceleyebilmesi için geliştirilen çevrimiçi bir başvuru aracıdır. Projenin bakımını Ferdi Ertekin yürütmektedir.

Depo, sözlüğün web uygulamasını, arama ve madde API'lerini, veri tabanı şemasını ve bakım denetimlerini içerir. Sözlük içeriğine ücretsiz erişim ile yazılımın açık kaynak lisansı ayrı konulardır; aşağıdaki lisans bölümüne bakınız.

### İşlevler

- Türkçe ve İngilizce arayüz; alfabetik liste ve kalıcı madde adresleri.
- Türkçe karakter, tarihî imla ve noktalama varyantlarını dikkate alan arama.
- Madde karşılıkları, açıklamalar, kaynaklar ve varyantlar için veri modeli.
- Editör işlemleri, revizyon geçmişi ve denetim kayıtları için altyapı.
- Terim bulma oyunu ve PWA dosyaları.
- İsteğe bağlı üyelik ve seslendirme bileşenleri; kullanılabilirlik dağıtım yapılandırmasına bağlıdır.

Bu depo, bütün terim karşılıklarının her bağlamda birbirinin yerine kullanılabileceği anlamına gelmez. Akademik kullanımda ilgili madde, belge bağlamı ve kaynaklarıyla birlikte değerlendirilmelidir.

## English

The Military Terms Dictionary is a web reference tool for researchers, students and readers of historical documents working on Ottoman military history, primarily 1876–1918. It brings together English military terms, Ottoman-period equivalents and Turkish explanations, with Turkish and English interfaces.

The repository contains a reusable web application, search and entry APIs, database migrations and maintenance checks. Its relevance is to digital humanities and historical terminology tools. No download, visitor or adoption figures are claimed here.

### Architecture

| Path | Purpose |
| --- | --- |
| `functions/` | Cloudflare Pages Functions, routing, APIs and shared application modules |
| `migrations/` | D1/SQLite schema migrations |
| `assets/` | Browser code, styles and visual assets; content rights vary |
| `scripts/` | Repository checks and maintenance utilities |
| `dictionary-d1-preview.html`, `dictionary-d1-preview-en.html` | Dictionary interface templates |
| `default-content.json` | Content snapshot, separately governed from software |
| `netlify/`, `netlify.toml` | Legacy and preview support retained in the repository |
| `.github/workflows/` | Existing GitHub Actions workflows |

The primary application path uses Cloudflare Pages, Pages Functions and a D1 binding named `DB`. Older technical notes describe earlier migration stages; do not treat them as a live infrastructure inventory. See [architecture](CLOUDFLARE_ARCHITECTURE.md) and [optional membership setup](COMMUNITY_MEMBERSHIP_SETUP.md).

### Local development and checks

Clone the repository and enter its root:

```sh
git clone https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu.git
cd askeri-terimler-sozlugu
npm run check
```

Use a recent Node.js runtime with `node:sqlite` support. The repository checks run locally; they do not verify the production D1 database or third-party service configuration. No production credentials are required for `npm run check`.

For a Cloudflare preview:

```sh
npm run dev
```

This invokes Wrangler through `npx`. Configure a local D1 binding named `DB` and apply the repository migrations in order to that local database. Without D1 and local seed data, a static preview does not reproduce the full dictionary. Use synthetic fixtures for software work; do not import a production database into a public development environment.

Cloudflare configuration is currently managed outside a checked-in Wrangler configuration. Obtain the appropriate local configuration from the maintainer. Production deployment also requires the relevant bindings and secrets; a successful `npm run build` is a readiness message, not a deployment or database migration.

Keep secrets out of commits, issues and pull requests. Optional account and speech services need their own configuration; consult the setup notes before enabling them.

### Maintenance and contribution

Please report reproducible software defects through [GitHub Issues](https://github.com/ferdiertekin-ops/askeri-terimler-sozlugu/issues) and submit focused pull requests. Run the relevant existing checks before proposing a change. Historical content corrections require precise references and editorial review; model-generated text alone is not a source. See [CONTRIBUTING.md](CONTRIBUTING.md).

### License: software and scholarly content

**Original software code and its technical documentation are licensed under MIT.** See [LICENSE](LICENSE). This permits reuse, modification and commercial use of the covered software with the required copyright and permission notices.

**The dictionary dataset and scholarly content are not licensed under MIT.** Entries, definitions, explanations, translations, source compilations and embedded copies of these materials retain their separate content terms. Logos, illustrations, book covers and third-party materials are also outside the software license. See [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

Türkçe: MIT lisansı yazılım kodunu ve teknik belgelerini kapsar. Sözlük maddeleri, akademik açıklamalar, veri derlemeleri ve görseller bu lisansın kapsamına girmez. Akademik atıf ve sınırlı alıntı için sözlüğün [kullanım şartlarına](https://askeriterimlersozlugu.com/kullanim-sartlari/) bakınız.

### Citation

Software citation metadata is provided in [CITATION.cff](CITATION.cff). For a dictionary entry, cite the specific entry URL and your access date, alongside the historical source when your argument depends on it. Do not invent a DOI, release date or version number.

### Support plan

The [Codex for Open Source application draft](docs/codex-for-oss-application.md) describes proposed maintenance uses of support. It does not imply that funding, program acceptance or a production OpenAI integration already exists.
