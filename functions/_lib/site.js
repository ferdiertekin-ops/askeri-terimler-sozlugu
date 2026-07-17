const SITE_ORIGIN = 'https://askeriterimlersozlugu.com';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function xml(value) {
  return escapeHtml(value);
}

function responseHtml(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { ...HTML_HEADERS, ...extraHeaders }
  });
}

function canonicalPath(pathname) {
  return new URL(pathname, SITE_ORIGIN).toString();
}

function siteNav(lang) {
  const tr = lang !== 'en';
  const links = tr
    ? [
        ['/', 'Sözlük'],
        ['/terimler/', 'Terimler Dizini'],
        ['/yayin-notu/', 'Yayın Notu'],
        ['/kaynakca/', 'Kaynakça'],
        ['/gizlilik-politikasi/', 'Gizlilik'],
        ['/cerez-politikasi/', 'Çerezler'],
        ['/kullanim-sartlari/', 'Kullanım Şartları'],
        ['/iletisim/', 'İletişim']
      ]
    : [
        ['/en/', 'Dictionary'],
        ['/en/terms/', 'Terms Index'],
        ['/en/publication-note/', 'Publication Note'],
        ['/en/bibliography/', 'Bibliography'],
        ['/en/privacy-policy/', 'Privacy'],
        ['/en/cookie-policy/', 'Cookies'],
        ['/en/terms-of-use/', 'Terms of Use'],
        ['/en/contact/', 'Contact']
      ];
  return links.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('');
}

function shell({ lang, title, description, canonical, content, jsonLd = null }) {
  const tr = lang !== 'en';
  const dictionaryName = tr ? 'Askerî Terimler Sözlüğü' : 'Military Terms Dictionary';
  const alternate = tr ? canonical.replace(SITE_ORIGIN, `${SITE_ORIGIN}/en`) : canonical.replace(`${SITE_ORIGIN}/en`, SITE_ORIGIN);
  const structured = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';
  return `<!doctype html>
<html lang="${tr ? 'tr' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${escapeHtml(canonical)}">
<link rel="alternate" hreflang="${tr ? 'en' : 'tr'}" href="${escapeHtml(alternate)}">
<link rel="alternate" hreflang="${tr ? 'tr' : 'en'}" href="${escapeHtml(canonical)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-96.png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&display=swap" rel="stylesheet">
${structured}
<style>
:root{--cream:#f7f4ec;--cream2:#ece7db;--paper:#fbfaf7;--ink:#1e2732;--muted:#68645e;--navy:#2f4e71;--red:#8f2f23;--brass:#8a6a32;--line:#d8d1c4}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -12%,rgba(47,78,113,.10),transparent 42%),linear-gradient(180deg,var(--cream),var(--cream2));background-attachment:fixed;color:var(--ink);font-family:Cambria,Georgia,serif}
.site{width:min(1120px,calc(100% - 32px));margin:auto;padding:22px 0 56px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 0 18px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--ink);font-weight:600}.brand img{width:52px;height:52px;object-fit:contain}.langs{display:flex;gap:6px}.langs a{padding:6px 10px;border:1px solid var(--line);border-radius:7px;color:var(--navy);text-decoration:none;font-size:12px;font-weight:700}.langs a[aria-current]{background:var(--navy);color:#fff}
.nav{display:flex;justify-content:center;gap:24px;flex-wrap:wrap;padding:16px 8px;border-bottom:1px solid var(--line)}.nav a{color:var(--navy);text-decoration:none;font-size:12px;letter-spacing:.06em;text-transform:uppercase}.nav a:hover{text-decoration:underline}
main{margin-top:34px}.page-title{text-align:center;margin:0 0 8px;font:600 clamp(34px,5vw,58px)/1.08 "Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif}.lead{max-width:780px;margin:0 auto 30px;text-align:center;color:var(--muted);font-size:16px;line-height:1.65}
.paper{background:rgba(251,250,247,.95);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 44px -34px rgba(35,28,22,.5);padding:26px}.term-list{columns:3 250px;column-gap:32px;margin:0;padding-left:22px}.term-list li{break-inside:avoid;margin:0 0 7px}.term-list a{color:var(--navy);text-decoration:none}.term-list a:hover{color:var(--red);text-decoration:underline}
.term-head{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:start}.term-head h1{margin:0;font:600 clamp(34px,5vw,56px)/1.08 "Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif}.badge{border:1px solid #d8c7b8;border-radius:999px;background:#f4ebe6;color:#67453b;padding:6px 11px;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.term-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}.field{background:#fff;border:1px solid var(--line);border-radius:9px;padding:15px}.field.full{grid-column:1/-1}.label{display:block;margin-bottom:6px;color:var(--brass);font:600 10px/1.2 Calibri,"Segoe UI",sans-serif;text-transform:uppercase;letter-spacing:.12em}.value{font:15.5px/1.55 Cambria,Georgia,serif;white-space:pre-line;overflow-wrap:anywhere}.field.ottoman .value{font:italic 17px/1.55 "EB Garamond",Garamond,serif}.field.explanation .value{font:14.5px/1.65 "Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;color:#514c45}.sources{margin:0;padding-left:20px}.sources li{margin:6px 0}.back{display:inline-flex;margin-top:22px;color:var(--navy)}
.empty{text-align:center;padding:38px;color:var(--muted)}footer{margin-top:28px;text-align:center;color:var(--muted);font-size:13px}
@media(max-width:700px){.site{width:min(100% - 22px,1120px)}.topbar{align-items:flex-start}.brand span{display:none}.nav{gap:13px}.paper{padding:18px}.term-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.term-list{columns:1}.term-head{grid-template-columns:1fr}.page-title,.term-head h1{font-size:34px}}
</style>
</head>
<body><div class="site">
<header class="topbar">
  <a class="brand" href="${tr ? '/' : '/en/'}"><img src="/ats-logo-2026.svg" alt="ATS"><span>${escapeHtml(dictionaryName)}</span></a>
  <nav class="langs" aria-label="${tr ? 'Dil seçimi' : 'Language'}"><a href="/" ${tr ? 'aria-current="page"' : ''}>TR</a><a href="/en/" ${tr ? '' : 'aria-current="page"'}>ENG</a></nav>
</header>
<nav class="nav" aria-label="${tr ? 'Site bağlantıları' : 'Site navigation'}">${siteNav(lang)}</nav>
<main>${content}</main>
<footer>© 2026 ${escapeHtml(dictionaryName)} · 1876–1918</footer>
</div></body></html>`;
}

async function publishedTerms(db) {
  const result = await db.prepare(`
    SELECT slug, headword_en, updated_at
    FROM terms
    WHERE status = 'published'
    ORDER BY headword_en COLLATE NOCASE, id
  `).all();
  return result.results || [];
}

export async function renderTermsIndex(db, lang = 'tr') {
  const tr = lang !== 'en';
  const rows = await publishedTerms(db);
  const pathPrefix = tr ? '/terim/' : '/en/term/';
  const list = rows.map(row => `<li><a href="${pathPrefix}${encodeURIComponent(row.slug)}/">${escapeHtml(row.headword_en)}</a></li>`).join('');
  const title = tr ? 'Terimler Dizini' : 'Terms Index';
  const description = tr
    ? 'Yayımlanmış askerî sözlük maddelerinin güncel D1 dizini.'
    : 'Current D1 index of published military dictionary entries.';
  const content = `<h1 class="page-title">${title}</h1><p class="lead">${description} ${tr ? `${rows.length} madde listeleniyor.` : `${rows.length} entries are listed.`}</p><section class="paper"><ol class="term-list">${list}</ol></section>`;
  return responseHtml(shell({
    lang,
    title: `${title} · ${tr ? 'Askerî Terimler Sözlüğü' : 'Military Terms Dictionary'}`,
    description,
    canonical: canonicalPath(tr ? '/terimler/' : '/en/terms/'),
    content
  }));
}

async function termRecord(db, slug) {
  const term = await db.prepare(`
    SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
           explanation_tr, explanation_en, updated_at, published_at, version
    FROM terms
    WHERE slug = ?1 AND status = 'published'
    LIMIT 1
  `).bind(slug).first();
  if (!term) return null;
  const [variants, sources] = await Promise.all([
    db.prepare('SELECT variant, variant_type, language FROM term_variants WHERE term_id = ?1 ORDER BY id').bind(term.id).all(),
    db.prepare('SELECT citation, url, source_type, page_reference FROM term_sources WHERE term_id = ?1 ORDER BY sort_order, id').bind(term.id).all()
  ]);
  return { ...term, variants: variants.results || [], sources: sources.results || [] };
}

function sourceList(sources) {
  if (!sources.length) return '—';
  return `<ol class="sources">${sources.map(source => {
    const citation = escapeHtml(source.citation || '—');
    if (!source.url) return `<li>${citation}</li>`;
    const safeUrl = /^https:\/\//i.test(source.url) ? source.url : '';
    return safeUrl ? `<li><a href="${escapeHtml(safeUrl)}" rel="noopener noreferrer">${citation}</a></li>` : `<li>${citation}</li>`;
  }).join('')}</ol>`;
}

export async function renderTermPage(db, slug, lang = 'tr') {
  const tr = lang !== 'en';
  const term = await termRecord(db, slug);
  if (!term) {
    const title = tr ? 'Madde bulunamadı' : 'Entry not found';
    return responseHtml(shell({
      lang,
      title,
      description: title,
      canonical: canonicalPath(tr ? `/terim/${encodeURIComponent(slug)}/` : `/en/term/${encodeURIComponent(slug)}/`),
      content: `<section class="paper empty"><h1>${title}</h1><p>${tr ? 'İstenen sözlük maddesi yayımlanmamış veya kaldırılmış olabilir.' : 'The requested entry may be unpublished or removed.'}</p></section>`
    }), 404, { 'Cache-Control': 'no-store' });
  }

  const canonical = canonicalPath(tr ? `/terim/${encodeURIComponent(term.slug)}/` : `/en/term/${encodeURIComponent(term.slug)}/`);
  const explanation = tr ? term.explanation_tr : (term.explanation_en || term.explanation_tr);
  const variants = term.variants.map(item => item.variant).filter(Boolean).join(', ') || '—';
  const labels = tr
    ? { ottoman: 'Osmanlıca / Dönem', modern: 'Günümüz Karşılığı', variants: 'Varyant / Kısaltma', category: 'Kategori', explanation: 'Açıklama', sources: 'Künye / Kaynak', back: 'Terimler dizinine dön' }
    : { ottoman: 'Ottoman / Period', modern: 'Modern Turkish', variants: 'Variant / Abbreviation', category: 'Category', explanation: 'Explanation', sources: 'Citation / Source', back: 'Back to terms index' };
  const content = `<article class="paper">
    <div class="term-head"><h1>${escapeHtml(term.headword_en)}</h1><span class="badge">${escapeHtml(term.category || (tr ? 'Sözlük maddesi' : 'Dictionary entry'))}</span></div>
    <div class="term-grid">
      <section class="field ottoman"><span class="label">${labels.ottoman}</span><div class="value">${escapeHtml(term.ottoman_period_term || '—')}</div></section>
      <section class="field"><span class="label">${labels.modern}</span><div class="value">${escapeHtml(term.modern_equivalent_tr || '—')}</div></section>
      <section class="field"><span class="label">${labels.variants}</span><div class="value">${escapeHtml(variants)}</div></section>
      <section class="field"><span class="label">${labels.category}</span><div class="value">${escapeHtml(term.category || '—')}</div></section>
      <section class="field full explanation"><span class="label">${labels.explanation}</span><div class="value">${escapeHtml(explanation || '—')}</div></section>
      <section class="field full"><span class="label">${labels.sources}</span><div class="value">${sourceList(term.sources)}</div></section>
    </div>
    <a class="back" href="${tr ? '/terimler/' : '/en/terms/'}">← ${labels.back}</a>
  </article>`;
  const description = String(explanation || term.modern_equivalent_tr || term.ottoman_period_term || term.headword_en).slice(0, 155);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term.headword_en,
    description,
    inDefinedTermSet: canonicalPath(tr ? '/' : '/en/'),
    url: canonical,
    identifier: term.slug,
    dateModified: term.updated_at || undefined
  };
  return responseHtml(shell({
    lang,
    title: `${term.headword_en} · ${tr ? 'Askerî Terimler Sözlüğü' : 'Military Terms Dictionary'}`,
    description,
    canonical,
    content,
    jsonLd
  }));
}

export async function renderSitemap(db) {
  const rows = await publishedTerms(db);
  const staticPaths = [
    '/', '/en/', '/terimler/', '/en/terms/', '/yayin-notu/', '/en/publication-note/',
    '/kaynakca/', '/en/bibliography/', '/gizlilik-politikasi/', '/en/privacy-policy/',
    '/cerez-politikasi/', '/en/cookie-policy/', '/kullanim-sartlari/', '/en/terms-of-use/',
    '/iletisim/', '/en/contact/'
  ];
  const now = new Date().toISOString().slice(0, 10);
  const urls = staticPaths.map(path => ({ loc: canonicalPath(path), lastmod: now }));
  for (const row of rows) {
    const lastmod = String(row.updated_at || now).slice(0, 10);
    urls.push({ loc: canonicalPath(`/terim/${encodeURIComponent(row.slug)}/`), lastmod });
    urls.push({ loc: canonicalPath(`/en/term/${encodeURIComponent(row.slug)}/`), lastmod });
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url><loc>${xml(item.loc)}</loc><lastmod>${xml(item.lastmod)}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export function renderRobots() {
  const body = `User-agent: *\nAllow: /\nDisallow: /editor/\nDisallow: /api/editor/\nDisallow: /api/migration/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
