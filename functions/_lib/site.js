import { loadEditablePage } from './editable-pages.js';
import { termLetter } from './term-letter.js';

const SITE_ORIGIN = 'https://askeriterimlersozlugu.com';
const AUTHOR_NAME = 'Ferdi Ertekin';
const SITE_NAME_TR = 'Askerî Terimler Sözlüğü';
const SITE_NAME_EN = 'Military Terms Dictionary';
const NOINDEX_PAGE_KEYS = new Set(['privacy', 'cookies', 'terms-of-use', 'contact']);

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

function localPath(value) {
  const url = new URL(value, SITE_ORIGIN);
  return `${url.pathname}${url.search}`;
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength = 160) {
  const text = compactText(value);
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength - 1);
  const wordBoundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, wordBoundary > maxLength * 0.65 ? wordBoundary : clipped.length).trim()}…`;
}

function structuredGraph(...nodes) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean)
  };
}

function breadcrumbNode(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
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

function shell({ lang, title, description, canonical, alternate, xDefault, content, jsonLd = null, robots = 'index,follow,max-image-preview:large' }) {
  const tr = lang !== 'en';
  const dictionaryName = tr ? SITE_NAME_TR : SITE_NAME_EN;
  const alternateUrl = alternate || (tr ? canonicalPath('/en/') : canonicalPath('/'));
  const trUrl = tr ? canonical : alternateUrl;
  const enUrl = tr ? alternateUrl : canonical;
  const xDefaultUrl = xDefault || trUrl;
  const socialImage = canonicalPath('/ats-logo.png');
  const ogLocale = tr ? 'tr_TR' : 'en_GB';
  const alternateLocale = tr ? 'en_GB' : 'tr_TR';
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
<meta name="robots" content="${escapeHtml(robots)}">
<meta name="author" content="${AUTHOR_NAME}">
<meta name="theme-color" content="#2f4e71">
<link rel="canonical" href="${escapeHtml(canonical)}">
<link rel="alternate" hreflang="tr" href="${escapeHtml(trUrl)}">
<link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}">
<link rel="alternate" hreflang="x-default" href="${escapeHtml(xDefaultUrl)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-96.png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:locale" content="${ogLocale}">
<meta property="og:locale:alternate" content="${alternateLocale}">
<meta property="og:site_name" content="${escapeHtml(dictionaryName)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:image" content="${socialImage}">
<meta property="og:image:alt" content="ATS · ${escapeHtml(dictionaryName)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${socialImage}">
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
.paper{background:rgba(251,250,247,.95);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 44px -34px rgba(35,28,22,.5);padding:26px}.editorial-page{font-family:"EB Garamond",Garamond,"Palatino Linotype",serif;font-size:18px;line-height:1.72;text-align:justify;text-justify:inter-word;hyphens:auto;color:#302d29}.editorial-page p{margin:0 0 1.05em}.editorial-page p:last-child{margin-bottom:0}.editorial-page a{color:var(--navy);text-underline-offset:2px}.page-updated{margin:14px 2px 0;text-align:right;color:var(--muted);font-size:12px}.letter-group + .letter-group{margin-top:26px;padding-top:22px;border-top:1px solid var(--line)}.letter-group h2{margin:0 0 12px;color:var(--red);font:600 24px/1.1 "Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif}.term-list{columns:3 250px;column-gap:32px;margin:0;padding-left:22px}.term-list li{break-inside:avoid;margin:0 0 7px}.term-list a{color:var(--navy);text-decoration:none}.term-list a:hover{color:var(--red);text-decoration:underline}
.term-head{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:start}.term-head h1{margin:0;font:600 clamp(34px,5vw,56px)/1.08 "Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif}.badge{border:1px solid #d8c7b8;border-radius:999px;background:#f4ebe6;color:#67453b;padding:6px 11px;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.term-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}.field{background:#fff;border:1px solid var(--line);border-radius:9px;padding:15px}.field.full{grid-column:1/-1}.label{display:block;margin-bottom:6px;color:var(--brass);font:600 10px/1.2 Calibri,"Segoe UI",sans-serif;text-transform:uppercase;letter-spacing:.12em}.value{font:15.5px/1.55 Cambria,Georgia,serif;white-space:pre-line;overflow-wrap:anywhere}.field.ottoman .value{font:italic 17px/1.55 "EB Garamond",Garamond,serif}.field.explanation .value{font:14.5px/1.65 "Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;color:#514c45}.sources{margin:0;padding-left:20px}.sources li{margin:6px 0}.back{display:inline-flex;margin-top:22px;color:var(--navy)}
.sources,.sources li,.sources a,.sources a:hover,.sources a:focus-visible{color:var(--ink)}
.empty{text-align:center;padding:38px;color:var(--muted)}footer{margin-top:28px;text-align:center;color:var(--muted);font-size:13px}
@media(max-width:700px){.site{width:min(100% - 22px,1120px)}.topbar{align-items:flex-start}.brand span{display:none}.nav{gap:13px}.paper{padding:18px}.term-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.term-list{columns:1}.term-head{grid-template-columns:1fr}.page-title,.term-head h1{font-size:34px}}
</style>
</head>
<body><div class="site">
<header class="topbar">
  <a class="brand" href="${tr ? '/' : '/en/'}"><img src="/ats-logo-2026.svg" alt="${escapeHtml(dictionaryName)}"><span>${escapeHtml(dictionaryName)}</span></a>
  <nav class="langs" aria-label="${tr ? 'Dil seçimi' : 'Language'}"><a href="${escapeHtml(localPath(trUrl))}" lang="tr" ${tr ? 'aria-current="page"' : ''}>TR</a><a href="${escapeHtml(localPath(enUrl))}" lang="en" ${tr ? '' : 'aria-current="page"'}>ENG</a></nav>
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

function inlinePlainText(value) {
  const text = String(value || '');
  const pattern = /(https:\/\/[^\s<]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  let cursor = 0;
  let output = '';
  for (const match of text.matchAll(pattern)) {
    output += escapeHtml(text.slice(cursor, match.index));
    const token = match[0];
    if (token.includes('@') && !token.toLowerCase().startsWith('https://')) {
      output += `<a href="mailto:${escapeHtml(token)}">${escapeHtml(token)}</a>`;
    } else {
      output += `<a href="${escapeHtml(token)}" target="_blank" rel="noopener noreferrer">${escapeHtml(token)}</a>`;
    }
    cursor = Number(match.index) + token.length;
  }
  return output + escapeHtml(text.slice(cursor));
}

function plainTextMarkup(value) {
  const normalized = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '<p>—</p>';
  return normalized
    .split(/\n{2,}/)
    .map(paragraph => `<p>${paragraph.split('\n').map(inlinePlainText).join('<br>')}</p>`)
    .join('');
}

export async function renderEditablePage(db, pageKey, lang = 'tr') {
  const page = await loadEditablePage(db, pageKey);
  if (!page || page.key === 'home-notice') return null;
  const tr = lang !== 'en';
  const title = tr ? page.titleTr : page.titleEn;
  const body = tr ? page.bodyTr : page.bodyEn;
  const canonical = canonicalPath(tr ? page.pathTr : page.pathEn);
  const alternate = canonicalPath(tr ? page.pathEn : page.pathTr);
  const trCanonical = canonicalPath(page.pathTr);
  const description = truncateText(body || title, 155);
  const content = `<h1 class="page-title">${escapeHtml(title)}</h1><article class="paper editorial-page">${plainTextMarkup(body)}</article>${page.updatedAt ? `<p class="page-updated">${tr ? 'Son düzenleme' : 'Last edited'}: ${escapeHtml(String(page.updatedAt).slice(0, 10))}</p>` : ''}`;
  const jsonLd = structuredGraph(
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      inLanguage: tr ? 'tr' : 'en',
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      dateModified: page.updatedAt || undefined
    },
    breadcrumbNode([
      { name: tr ? SITE_NAME_TR : SITE_NAME_EN, url: canonicalPath(tr ? '/' : '/en/') },
      { name: title, url: canonical }
    ])
  );
  const noindex = NOINDEX_PAGE_KEYS.has(page.key);
  return responseHtml(shell({
    lang,
    title: `${title} · ${tr ? 'Askerî Terimler Sözlüğü' : 'Military Terms Dictionary'}`,
    description,
    canonical,
    alternate,
    xDefault: trCanonical,
    content,
    jsonLd,
    robots: noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'
  }), 200, {
    'Cache-Control': 'no-store',
    ...(noindex ? { 'X-Robots-Tag': 'noindex, follow' } : {})
  });
}

export async function renderEditablePageJson(db, pageKey) {
  const page = await loadEditablePage(db, pageKey);
  if (!page) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    });
  }
  return new Response(JSON.stringify({ ok: true, page }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function renderTermsIndex(db, lang = 'tr') {
  const tr = lang !== 'en';
  const rows = await publishedTerms(db);
  const pathPrefix = tr ? '/terim/' : '/en/term/';
  const groups = new Map();
  for (const row of rows) {
    const letter = termLetter(row.headword_en);
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(row);
  }
  const list = [...groups.entries()].map(([letter, terms]) => {
    const items = terms.map(row => `<li><a href="${pathPrefix}${encodeURIComponent(row.slug)}/">${escapeHtml(row.headword_en)}</a></li>`).join('');
    const id = letter === '#' ? 'letter-number' : `letter-${encodeURIComponent(letter.toLocaleLowerCase('en-US'))}`;
    return `<section class="letter-group" aria-labelledby="${id}"><h2 id="${id}">${escapeHtml(letter)}</h2><ol class="term-list">${items}</ol></section>`;
  }).join('');
  const title = tr ? 'Terimler Dizini' : 'Terms Index';
  const description = tr
    ? `1876–1918 dönemi Askerî Terimler Sözlüğü'ndeki ${rows.length} yayımlanmış maddenin alfabetik dizini.`
    : `Alphabetical index of ${rows.length} published entries in the 1876–1918 Military Terms Dictionary.`;
  const canonical = canonicalPath(tr ? '/terimler/' : '/en/terms/');
  const alternate = canonicalPath(tr ? '/en/terms/' : '/terimler/');
  const content = `<h1 class="page-title">${title}</h1><p class="lead">${description}</p><div class="paper">${list}</div>`;
  const termSetId = `${canonicalPath('/')}#defined-term-set`;
  const jsonLd = structuredGraph(
    {
      '@type': 'CollectionPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      inLanguage: tr ? 'tr' : 'en',
      mainEntity: { '@id': termSetId },
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` }
    },
    {
      '@type': 'DefinedTermSet',
      '@id': termSetId,
      name: SITE_NAME_TR,
      alternateName: SITE_NAME_EN,
      url: canonicalPath('/'),
      inLanguage: ['tr', 'en']
    },
    breadcrumbNode([
      { name: tr ? SITE_NAME_TR : SITE_NAME_EN, url: canonicalPath(tr ? '/' : '/en/') },
      { name: title, url: canonical }
    ])
  );
  return responseHtml(shell({
    lang,
    title: `${title} · ${tr ? 'Askerî Terimler Sözlüğü' : 'Military Terms Dictionary'}`,
    description,
    canonical,
    alternate,
    xDefault: canonicalPath('/terimler/'),
    content,
    jsonLd
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
      alternate: canonicalPath(tr ? `/en/term/${encodeURIComponent(slug)}/` : `/terim/${encodeURIComponent(slug)}/`),
      xDefault: canonicalPath(`/terim/${encodeURIComponent(slug)}/`),
      content: `<section class="paper empty"><h1>${title}</h1><p>${tr ? 'İstenen sözlük maddesi yayımlanmamış veya kaldırılmış olabilir.' : 'The requested entry may be unpublished or removed.'}</p><a class="back" href="${tr ? '/terimler/' : '/en/terms/'}">← ${tr ? 'Terimler dizinine dön' : 'Back to terms index'}</a></section>`,
      robots: 'noindex,follow'
    }), 404, { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, follow' });
  }

  const canonical = canonicalPath(tr ? `/terim/${encodeURIComponent(term.slug)}/` : `/en/term/${encodeURIComponent(term.slug)}/`);
  const explanation = tr ? term.explanation_tr : (term.explanation_en || term.explanation_tr);
  const variants = term.variants.map(item => item.variant).filter(Boolean).join(', ') || '—';
  const letter = termLetter(term.headword_en);
  const labels = tr
    ? { letter: 'Harf', ottoman: 'Osmanlıca / Dönem', modern: 'Günümüz Karşılığı', variants: 'Varyant / Kısaltma', category: 'Kategori', explanation: 'Açıklama', sources: 'Künye / Kaynak', back: 'Terimler dizinine dön' }
    : { letter: 'Letter', ottoman: 'Ottoman / Period', modern: 'Modern Turkish', variants: 'Variant / Abbreviation', category: 'Category', explanation: 'Explanation', sources: 'Citation / Source', back: 'Back to terms index' };
  const content = `<article class="paper">
    <div class="term-head"><h1>${escapeHtml(term.headword_en)}</h1><span class="badge">${escapeHtml(term.category || (tr ? 'Sözlük maddesi' : 'Dictionary entry'))}</span></div>
    <div class="term-grid">
      <section class="field"><span class="label">${labels.letter}</span><div class="value">${escapeHtml(letter)}</div></section>
      <section class="field"><span class="label">${tr ? 'Madde Başı' : 'Headword'}</span><div class="value">${escapeHtml(term.headword_en)}</div></section>
      <section class="field ottoman"><span class="label">${labels.ottoman}</span><div class="value">${escapeHtml(term.ottoman_period_term || '—')}</div></section>
      <section class="field"><span class="label">${labels.modern}</span><div class="value">${escapeHtml(term.modern_equivalent_tr || '—')}</div></section>
      <section class="field"><span class="label">${labels.variants}</span><div class="value">${escapeHtml(variants)}</div></section>
      <section class="field"><span class="label">${labels.category}</span><div class="value">${escapeHtml(term.category || '—')}</div></section>
      <section class="field full explanation"><span class="label">${labels.explanation}</span><div class="value">${escapeHtml(explanation || '—')}</div></section>
      <section class="field full"><span class="label">${labels.sources}</span><div class="value">${sourceList(term.sources)}</div></section>
    </div>
    <a class="back" href="${tr ? '/terimler/' : '/en/terms/'}">← ${labels.back}</a>
  </article>`;
  const description = tr
    ? truncateText(`${term.headword_en}${term.modern_equivalent_tr ? `: ${term.modern_equivalent_tr}.` : '.'} ${term.ottoman_period_term ? `Osmanlıca/dönem karşılığı: ${term.ottoman_period_term}.` : ''} ${term.explanation_tr || ''}`, 160)
    : truncateText(`${term.headword_en} in the 1876–1918 Military Terms Dictionary. ${term.modern_equivalent_tr ? `Modern Turkish: ${term.modern_equivalent_tr}.` : ''} ${term.ottoman_period_term ? `Ottoman/period equivalent: ${term.ottoman_period_term}.` : ''} ${term.explanation_en || ''}`, 160);
  const alternate = canonicalPath(tr ? `/en/term/${encodeURIComponent(term.slug)}/` : `/terim/${encodeURIComponent(term.slug)}/`);
  const trCanonical = canonicalPath(`/terim/${encodeURIComponent(term.slug)}/`);
  const termSetId = `${canonicalPath('/')}#defined-term-set`;
  const jsonLd = structuredGraph(
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: term.headword_en,
      description,
      inLanguage: tr ? 'tr' : 'en',
      mainEntity: { '@id': `${canonical}#term` },
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      dateModified: term.updated_at || undefined
    },
    {
      '@type': 'DefinedTerm',
      '@id': `${canonical}#term`,
      name: term.headword_en,
      alternateName: term.variants.map(item => item.variant).filter(Boolean),
      description,
      inLanguage: tr ? 'tr' : 'en',
      inDefinedTermSet: { '@id': termSetId },
      url: canonical,
      identifier: term.slug
    },
    breadcrumbNode([
      { name: tr ? SITE_NAME_TR : SITE_NAME_EN, url: canonicalPath(tr ? '/' : '/en/') },
      { name: tr ? 'Terimler Dizini' : 'Terms Index', url: canonicalPath(tr ? '/terimler/' : '/en/terms/') },
      { name: term.headword_en, url: canonical }
    ])
  );
  return responseHtml(shell({
    lang,
    title: `${term.headword_en} · ${tr ? 'Askerî Terimler Sözlüğü' : 'Military Terms Dictionary'}`,
    description,
    canonical,
    alternate,
    xDefault: trCanonical,
    content,
    jsonLd
  }));
}

export async function renderSitemap(db) {
  const [rows, homeNotice, publicationNote, bibliography] = await Promise.all([
    publishedTerms(db),
    loadEditablePage(db, 'home-notice'),
    loadEditablePage(db, 'publication-note'),
    loadEditablePage(db, 'bibliography')
  ]);
  const validDate = value => {
    const date = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  };
  const latestTermDate = rows.map(row => validDate(row.updated_at)).filter(Boolean).sort().at(-1) || '';
  const homeLastmod = [latestTermDate, validDate(homeNotice?.updatedAt)].filter(Boolean).sort().at(-1) || '';
  const urls = [
    { loc: canonicalPath('/'), lastmod: homeLastmod },
    { loc: canonicalPath('/en/'), lastmod: homeLastmod },
    { loc: canonicalPath('/terimler/'), lastmod: latestTermDate },
    { loc: canonicalPath('/en/terms/'), lastmod: latestTermDate },
    { loc: canonicalPath('/yayin-notu/'), lastmod: validDate(publicationNote?.updatedAt) },
    { loc: canonicalPath('/en/publication-note/'), lastmod: validDate(publicationNote?.updatedAt) },
    { loc: canonicalPath('/kaynakca/'), lastmod: validDate(bibliography?.updatedAt) },
    { loc: canonicalPath('/en/bibliography/'), lastmod: validDate(bibliography?.updatedAt) }
  ];
  for (const row of rows) {
    const lastmod = validDate(row.updated_at);
    urls.push({ loc: canonicalPath(`/terim/${encodeURIComponent(row.slug)}/`), lastmod });
    urls.push({ loc: canonicalPath(`/en/term/${encodeURIComponent(row.slug)}/`), lastmod });
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url><loc>${xml(item.loc)}</loc>${item.lastmod ? `<lastmod>${xml(item.lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
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
