from pathlib import Path

editor_path = Path('functions/_lib/editor.js')
middleware_path = Path('functions/_middleware.js')
panel_path = Path('editor-panel-private.html')
export_page_path = Path('editor/export/index.html')

editor = editor_path.read_text(encoding='utf-8')
export_code = r'''
function csvCell(value) {
  const text = value === null || value === undefined
    ? ''
    : (typeof value === 'string' ? value : JSON.stringify(value));
  return `"${String(text).replace(/"/g, '""')}"`;
}

function exportHeaders(contentType, filename) {
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer'
  };
}

async function exportDataset(context) {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  const auth = await authorize(context);
  if (auth.response) return auth.response;

  const id = requestId(context.request);
  const url = new URL(context.request.url);
  const format = String(url.searchParams.get('format') || 'json').trim().toLowerCase();
  if (!['json', 'csv'].includes(format)) {
    return json({ ok: false, error: 'unsupported_export_format', requestId: id }, { status: 400 });
  }

  try {
    const [termRows, variantRows, sourceRows, revisionRows, pageRows, auditRows] = await Promise.all([
      context.env.DB.prepare(`
        SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr,
               category, explanation_tr, explanation_en, status, created_at,
               updated_at, published_at, version
        FROM terms
        ORDER BY headword_en COLLATE NOCASE, id
      `).all(),
      context.env.DB.prepare(`
        SELECT id, term_id, variant, variant_type, language
        FROM term_variants
        ORDER BY term_id, id
      `).all(),
      context.env.DB.prepare(`
        SELECT id, term_id, citation, url, source_type, page_reference, sort_order
        FROM term_sources
        ORDER BY term_id, sort_order, id
      `).all(),
      context.env.DB.prepare(`
        SELECT id, term_id, revision_no, snapshot_json, change_note, created_at
        FROM term_revisions
        ORDER BY term_id, revision_no
      `).all(),
      context.env.DB.prepare(`
        SELECT page_key, title_tr, title_en, body_tr, body_en, updated_at
        FROM site_pages
        ORDER BY page_key
      `).all(),
      context.env.DB.prepare(`
        SELECT id, action, entity_type, entity_id, request_id, metadata_json, created_at
        FROM audit_log
        ORDER BY id
      `).all()
    ]);

    const variants = variantRows.results || [];
    const sources = sourceRows.results || [];
    const revisions = revisionRows.results || [];
    const variantsByTerm = new Map();
    const sourcesByTerm = new Map();
    const revisionsByTerm = new Map();

    for (const item of variants) {
      const list = variantsByTerm.get(item.term_id) || [];
      list.push(item);
      variantsByTerm.set(item.term_id, list);
    }
    for (const item of sources) {
      const list = sourcesByTerm.get(item.term_id) || [];
      list.push(item);
      sourcesByTerm.set(item.term_id, list);
    }
    for (const item of revisions) {
      const list = revisionsByTerm.get(item.term_id) || [];
      list.push(item);
      revisionsByTerm.set(item.term_id, list);
    }

    const terms = (termRows.results || []).map(term => ({
      ...term,
      variants: variantsByTerm.get(term.id) || [],
      sources: sourcesByTerm.get(term.id) || [],
      revisions: revisionsByTerm.get(term.id) || []
    }));
    const today = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const columns = [
        'id', 'slug', 'headword_en', 'ottoman_period_term', 'modern_equivalent_tr',
        'category', 'explanation_tr', 'explanation_en', 'status', 'created_at',
        'updated_at', 'published_at', 'version', 'variants_json', 'sources_json',
        'revisions_json'
      ];
      const rows = [columns.map(csvCell).join(',')];
      for (const term of terms) {
        const row = {
          ...term,
          variants_json: term.variants,
          sources_json: term.sources,
          revisions_json: term.revisions
        };
        rows.push(columns.map(column => csvCell(row[column])).join(','));
      }
      return new Response(`\uFEFF${rows.join('\r\n')}\r\n`, {
        headers: exportHeaders(
          'text/csv; charset=utf-8',
          `askeri-terimler-sozlugu-arastirma-verisi-${today}.csv`
        )
      });
    }

    const payload = {
      schema: 'ats-d1-export-v1',
      exported_at: new Date().toISOString(),
      request_id: id,
      counts: {
        terms: terms.length,
        variants: variants.length,
        sources: sources.length,
        revisions: revisions.length,
        pages: (pageRows.results || []).length,
        audit_log: (auditRows.results || []).length
      },
      terms,
      site_pages: pageRows.results || [],
      audit_log: auditRows.results || []
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: exportHeaders(
        'application/json; charset=utf-8',
        `askeri-terimler-sozlugu-tam-yedek-${today}.json`
      )
    });
  } catch (error) {
    return json({
      ok: false,
      error: 'export_failed',
      message: String(error?.message || error),
      requestId: id
    }, { status: 500 });
  }
}

'''

if 'async function exportDataset(context)' not in editor:
    marker = 'async function sourceSuggestions(context) {'
    if marker not in editor:
        raise SystemExit('editor.js: dışa aktarma ekleme noktası bulunamadı')
    editor = editor.replace(marker, export_code + marker, 1)

route_marker = "  if (pathname === '/api/editor/source-suggestions') return sourceSuggestions(context);"
route_line = "  if (pathname === '/api/editor/export') return exportDataset(context);"
if route_line not in editor:
    if route_marker not in editor:
        raise SystemExit('editor.js: dışa aktarma rota noktası bulunamadı')
    editor = editor.replace(route_marker, route_marker + '\n' + route_line, 1)
editor_path.write_text(editor, encoding='utf-8')

middleware = middleware_path.read_text(encoding='utf-8')
new_shortcut = r'''function applyEditorShortcut(html, authenticated, lang) {
  if (!authenticated) return html;
  const tr = lang !== 'en';
  const href = tr ? '/editor/panel/?new=1&return=%2F' : '/editor/panel/?new=1&return=%2Fen%2F';
  const label = tr ? '＋ Yeni madde' : '＋ New entry';
  const title = tr ? 'Yeni sözlük maddesi ekle' : 'Add a new dictionary entry';
  const exportLabel = tr ? '⬇ Dışa aktar' : '⬇ Export';
  const exportTitle = tr ? 'Sözlük verilerini JSON veya CSV olarak dışa aktar' : 'Export dictionary data as JSON or CSV';
  const controls = `<a class="preview-editor-link" href="${href}" title="${title}">${label}</a><a class="preview-editor-link" href="/editor/export/" title="${exportTitle}" style="margin-left:8px">${exportLabel}</a>`;
  return html.replace(/<a class="preview-editor-link" href="\/editor\/"[^>]*>[^<]*<\/a>/i, controls);
}'''
if "const exportLabel = tr ? '⬇ Dışa aktar'" not in middleware:
    start_marker = 'function applyEditorShortcut(html, authenticated, lang) {'
    end_marker = '\n\nfunction communityNav(lang) {'
    start = middleware.find(start_marker)
    end = middleware.find(end_marker, start)
    if start < 0 or end < 0:
        raise SystemExit('middleware: editör kısayolu değiştirme noktası bulunamadı')
    middleware = middleware[:start] + new_shortcut + middleware[end:]
middleware_path.write_text(middleware, encoding='utf-8')

panel = panel_path.read_text(encoding='utf-8')
panel_marker = '      <button id="sourceAuditBtn" type="button">Kaynakçayı denetle</button>'
panel_link = '      <a class="button-link" href="/editor/export/">⬇ Veriyi dışa aktar</a>'
if panel_link not in panel:
    if panel_marker not in panel:
        raise SystemExit('editor-panel-private.html: araç çubuğu bulunamadı')
    panel = panel.replace(panel_marker, panel_marker + '\n' + panel_link, 1)
panel_path.write_text(panel, encoding='utf-8')

export_page_path.parent.mkdir(parents=True, exist_ok=True)
export_page_path.write_text(r'''<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Veriyi dışa aktar · Askerî Terimler Sözlüğü</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<style>
:root{--bg:#f8f8f6;--paper:#fff;--ink:#1e2732;--muted:#6b6f73;--navy:#2f4e71;--navy-deep:#20395a;--line:#deded8;--brass:#8a6a32}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Cambria,Georgia,serif}.shell{width:min(820px,calc(100% - 28px));margin:auto;padding:20px 0 48px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:700}.brand img{width:42px;height:42px}.back{color:var(--navy);text-underline-offset:3px}.card{margin-top:22px;padding:24px;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 42px -36px rgba(30,39,50,.55)}h1{margin:0 0 8px;color:var(--navy-deep);font-size:30px}.lead{margin:0;color:var(--muted);line-height:1.6}.options{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}.option{display:flex;flex-direction:column;min-height:210px;padding:20px;border:1px solid var(--line);border-radius:12px;background:#fbfbf9}.option h2{margin:0 0 8px;color:var(--navy);font-size:21px}.option p{margin:0;color:var(--muted);line-height:1.55}.download{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 14px;border:1px solid var(--navy);border-radius:9px;background:var(--navy);color:#fff;text-decoration:none;font-weight:700}.download:hover{background:var(--navy-deep)}.note{margin-top:18px;padding-top:15px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;line-height:1.55}.status{min-height:22px;margin-top:14px;color:var(--brass);font-weight:700}@media(max-width:680px){.options{grid-template-columns:1fr}.card{padding:18px}}
</style>
</head>
<body><div class="shell">
<header><a class="brand" href="/"><img src="/ats-logo-2026.svg" alt="ATS"><span>Askerî Terimler Sözlüğü · Editör</span></a><a class="back" href="/editor/panel/">Editör paneline dön</a></header>
<main class="card">
  <h1>Veriyi dışa aktar</h1>
  <p class="lead">Dışa aktarma yalnız açık editör oturumunda çalışır. Veritabanında herhangi bir değişiklik yapmaz.</p>
  <div class="options">
    <section class="option">
      <h2>Tam JSON yedeği</h2>
      <p>Maddeler, durumlar, kaynaklar, varyantlar, revizyonlar, sayfa metinleri ve denetim kayıtları yapılandırılmış biçimde korunur.</p>
      <a class="download" href="/api/editor/export?format=json">JSON dosyasını indir</a>
    </section>
    <section class="option">
      <h2>Araştırma CSV’si</h2>
      <p>Her madde tek satırda verilir. Kaynak, varyant ve revizyon alanları kayıp oluşmaması için JSON dizileri hâlinde saklanır. Excel ile açılabilir.</p>
      <a class="download" href="/api/editor/export?format=csv">CSV dosyasını indir</a>
    </section>
  </div>
  <p class="note">Bu çıktı topluluk üyelerinin hesap veya parola verilerini içermez; yalnız sözlük ve editoryal kayıt tablolarını kapsar.</p>
  <p id="status" class="status" role="status"></p>
</main>
</div>
<script>
(async()=>{const status=document.getElementById('status');try{const response=await fetch('/api/editor/session',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});const data=await response.json();if(!response.ok||!data.ok||!data.authenticated){location.replace('/editor/');return}status.textContent='Editör oturumu doğrulandı.'}catch{status.textContent='Oturum doğrulanamadı.';setTimeout(()=>location.replace('/editor/'),900)}})();
</script>
</body></html>
''', encoding='utf-8')
