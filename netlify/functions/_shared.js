const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const defaults = require('./default-content.json');

const STORE_NAME = 'ats-live-content';
const STORE_KEY = 'live';

// Editör parolasının SHA-256 özeti ARTIK KAYNAK KODDA TUTULMAZ.
// Yalnızca Netlify ortam değişkeninden (EDITOR_PASSWORD_HASH) okunur.
// Kurulum: Netlify > Site settings > Environment variables > EDITOR_PASSWORD_HASH
const EDITOR_HASH = (process.env.EDITOR_PASSWORD_HASH || '').trim().toLowerCase();

// İçerik güvenlik politikası: fonksiyonların ürettiği HTML sayfalarında hiç
// gömülü <script> bulunmadığından script-src 'none' verilir; böylece canlı
// veriye enjekte edilmiş herhangi bir <script> ziyaretçide ÇALIŞMAZ.
const PAGE_CSP = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'self'";
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

function jsonHeaders(extra = {}) { return { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store, max-age=0', 'X-Content-Type-Options':'nosniff', ...extra }; }
function htmlHeaders(extra = {}) { return { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=60, s-maxage=60', 'Content-Security-Policy': PAGE_CSP, ...SECURITY_HEADERS, ...extra }; }
function textHeaders(extra = {}) { return { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'public, max-age=300, s-maxage=300', 'X-Content-Type-Options':'nosniff', ...extra }; }
function xmlHeaders(extra = {}) { return { 'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=300, s-maxage=300', 'X-Content-Type-Options':'nosniff', ...extra }; }
function hash(value) { return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex'); }

// Sabit zamanlı karşılaştırma (timing attack'e karşı).
function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

function isAuthorized(event) {
  // Sunucuda beklenen özet tanımlı değilse yazma tamamen kapalıdır (fail-closed).
  if (!EDITOR_HASH || EDITOR_HASH.length !== 64) return false;
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const pass = h['x-editor-password'] || h['X-Editor-Password'] || bearer;
  if (!pass) return false;
  return safeEqualHex(hash(pass), EDITOR_HASH);
}

// İstemci IP'si (Netlify başlıkları). Hız sınırlama için kullanılır.
function clientIp(event) {
  const h = event.headers || {};
  return (h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || h['client-ip'] || 'unknown')
    .toString().split(',')[0].trim();
}

// Başarısız parola denemelerini IP başına sınırlar (sabit pencere).
// Blob store'a küçük bir sayaç yazar. Limiter'ın kendi hatası editörü
// kilitlemesin diye fail-open davranır; yalnızca yazma denetimini destekler.
const RL_MAX_FAILS = 8;          // pencere başına izin verilen başarısız deneme
const RL_WINDOW_MS = 10 * 60 * 1000; // 10 dakika

async function rateLimitState(ip) {
  try {
    const s = store();
    const key = 'rl:' + ip;
    const rec = await s.get(key, { type: 'json' });
    const now = Date.now();
    if (rec && (now - rec.start) < RL_WINDOW_MS) return { s, key, rec, now };
    return { s, key, rec: { start: now, fails: 0 }, now };
  } catch (e) { return null; }
}
async function isRateLimited(ip) {
  const st = await rateLimitState(ip);
  if (!st) return false; // limiter erişilemiyorsa engelleme
  return st.rec.fails >= RL_MAX_FAILS;
}
async function noteAuthFailure(ip) {
  const st = await rateLimitState(ip);
  if (!st) return;
  try { st.rec.fails = (st.rec.fails || 0) + 1; await st.s.setJSON(st.key, st.rec); } catch (e) {}
}
async function clearAuthFailures(ip) {
  try { await store().delete('rl:' + ip); } catch (e) {}
}
function store() {
  const config = { name: STORE_NAME, consistency: 'strong' };

  // Netlify Functions ortamında Blobs normalde otomatik yapılandırılır.
  // Bazı deploy/plan ortamlarında otomatik bağlanmazsa aşağıdaki çevre değişkenleriyle açıkça bağlanır.
  const siteID =
    process.env.NETLIFY_BLOBS_SITE_ID ||
    process.env.NETLIFY_SITE_ID ||
    process.env.SITE_ID;

  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN;

  if (siteID) config.siteID = siteID;
  if (token) config.token = token;

  return getStore(config);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLive(live) {
  const base = deepClone(defaults);

  if (live && typeof live === 'object') {
    if (Array.isArray(live.data)) base.data = live.data;
    if (live.pages && typeof live.pages === 'object') base.pages = { ...(base.pages || {}), ...live.pages };
    if (live.pages_en && typeof live.pages_en === 'object') base.pages_en = { ...(base.pages_en || {}), ...live.pages_en };
    if (live.meta && typeof live.meta === 'object') base.meta = { ...(base.meta || {}), ...live.meta };
    if (live.updatedAt) base.updatedAt = live.updatedAt;
    if (live._writeId) base._writeId = live._writeId;
  }

  if (!base.updatedAt) base.updatedAt = (base.meta && base.meta.generated_at) || new Date().toISOString();
  if (!base.meta || typeof base.meta !== 'object') base.meta = {};

  return base;
}

async function readContent() {
  try {
    const live = await store().get(STORE_KEY, { type: 'json', consistency: 'strong' });
    const normalized = normalizeLive(live);
    normalized.meta = { ...(normalized.meta || {}), live_source: live ? 'blob' : 'defaults' };
    return normalized;
  } catch (err) {
    const fallback = normalizeLive(null);
    fallback.meta = {
      ...(fallback.meta || {}),
      live_source: 'defaults',
      live_read_error: err && err.message ? err.message : String(err)
    };
    return fallback;
  }
}

async function writeContent(next) {
  const normalized = normalizeLive(next);
  normalized.updatedAt = new Date().toISOString();
  normalized.meta = {
    ...(normalized.meta || {}),
    live_updated_at: normalized.updatedAt,
    live_source: 'blob'
  };
  normalized._writeId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

  const blobStore = store();

  // Netlify Blobs için JSON veriyi setJSON ile yazıyoruz; setJSON dönüşü metadata/etag verir.
  const result = await blobStore.setJSON(STORE_KEY, normalized, {
    metadata: { updatedAt: normalized.updatedAt, writeId: normalized._writeId }
  });

  // Yazma işlemini hemen güçlü tutarlılıkla tekrar okuyup doğrula.
  const verify = await blobStore.get(STORE_KEY, { type: 'json', consistency: 'strong' });
  if (!verify || verify._writeId !== normalized._writeId) {
    throw new Error('blob_write_verification_failed');
  }

  normalized._blobResult = result || {};
  return normalized;
}
function escapeHtml(value){ return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function escapeAttr(value){ return escapeHtml(value); }
function stripHtml(value){ return String(value==null?'':value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
function slugify(value){ return String(value==null?'':value).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'terim'; }
function headerIndex(sheet,wanted){ const n=String(wanted||'').toLocaleLowerCase('tr').trim(); return (sheet.headers||[]).findIndex(h=>String(h||'').toLocaleLowerCase('tr').trim()===n); }
function field(rec,names){ for(const name of names){ const idx=headerIndex(rec.sheet,name); if(idx>=0) return rec.row[idx]==null?'':String(rec.row[idx]); } return ''; }
function allRecords(content){ const out=[]; (content.data||[]).forEach((sheet,sheetIndex)=>(sheet.rows||[]).forEach((row,rowIndex)=>out.push({sheet,sheetIndex,row,rowIndex}))); return out; }
function termTitle(rec){ return field(rec,['Madde Başı','İngilizce Terim','Terim','Madde','Açılım','İngilizce / Kurum','Birim','Başlık'])||'Terim'; }
function termSlug(rec){ return slugify(termTitle(rec)); }
function canonicalBase(event){ const proto=(event.headers&&(event.headers['x-forwarded-proto']||event.headers['X-Forwarded-Proto']))||'https'; const host=(event.headers&&(event.headers.host||event.headers.Host))||'localhost'; return `${proto}://${host}`; }
function langFromEvent(event){ const q=(event.queryStringParameters&&event.queryStringParameters.lang)||''; return q.toLowerCase()==='en'?'en':'tr'; }
function siteName(lang){ return lang==='en'?'Military Terms Dictionary':'Askerî Terimler Sözlüğü'; }
function langSwitch(lang){ return lang==='en'?'<nav class="lang-switch" aria-label="Language"><a href="/" lang="tr">TR</a><a href="/en/" class="active" lang="en">ENG</a></nav>':'<nav class="lang-switch" aria-label="Dil seçimi"><a href="/" class="active" lang="tr">TR</a><a href="/en/" lang="en">ENG</a></nav>'; }
function navHtml(lang='tr'){ const items=lang==='en' ? [['Dictionary','/en/'],['Terms Index','/en/terms/'],['Publication Note','/en/publication-note/'],['Bibliography','/en/bibliography/'],['Privacy','/en/privacy-policy/'],['Cookies','/en/cookie-policy/'],['Terms of Use','/en/terms-of-use/'],['Contact','/en/contact/']] : [['Sözlük','/'],['Terimler Dizini','/terimler/'],['Yayın Notu','/yayin-notu/'],['Kaynakça','/kaynakca/'],['Gizlilik','/gizlilik-politikasi/'],['Çerezler','/cerez-politikasi/'],['Kullanım Şartları','/kullanim-sartlari/'],['İletişim','/iletisim/']]; return `<nav class="site-nav" aria-label="${lang==='en'?'Site links':'Site bağlantıları'}">`+items.map(i=>`<a href="${i[1]}">${escapeHtml(i[0])}</a>`).join('')+'</nav>'; }
function css(){ return `:root{--bg:#f8f7f4;--paper:#ffffff;--ink:#232d37;--ink-soft:#5b6570;--line:#e4e2da;--accent:#3d5a78;--olive:#3d5a78;--olive-deep:#2b4460;--brass:#3d5a78;--brass-deep:#2b4460}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#f8f7f4 0%,#eeede8 100%);background-attachment:fixed;color:var(--ink);font-family:Cambria,Georgia,serif;font-size:17px;line-height:1.62}.site{width:min(1080px,calc(100% - 32px));margin:0 auto;padding:22px 0 36px}.topbar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:8px 0 18px}.brand{display:flex;align-items:center;gap:14px;color:var(--ink);text-decoration:none}.brand__logo{width:64px;height:64px;display:block;object-fit:contain;border-radius:50%;filter:drop-shadow(0 4px 10px rgba(32,57,90,.14))}.brand__mark{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--olive);border-radius:50%;font-weight:700;background:var(--olive);color:#f8f7f4;letter-spacing:.08em}.brand__name{font-size:19px;font-weight:700}.lang-switch{display:inline-flex;gap:4px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.72);padding:3px}.lang-switch a{padding:5px 9px;border-radius:999px;text-decoration:none;color:var(--ink-soft);font-size:12px;font-weight:700;letter-spacing:.04em}.lang-switch a.active{background:var(--olive);color:#f8f7f4}.site-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin:0 0 24px}.site-nav a{padding:8px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--accent);background:rgba(255,255,255,.70)}main{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:30px 36px;box-shadow:0 18px 50px rgba(20,37,54,.06)}h1{font-family:"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;font-size:34px;line-height:1.15;margin:0 0 16px;text-align:center}h2{font-family:"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;font-size:24px;margin:28px 0 10px}p{text-align:justify}.lead{text-align:center;color:var(--ink-soft);font-size:18px}.meta{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink-soft);font-size:13px}.source-list{padding-left:22px}.source-list li{margin:7px 0}.term-list{columns:3 220px;column-gap:34px;line-height:1.6}.term-list li{break-inside:avoid;margin:0 0 6px}.term-list a{color:var(--brass);text-decoration:none}.term-list a:hover{text-decoration:underline}.detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:20px}.detail-row{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}.detail-row small{display:block;color:var(--ink-soft);font-size:12px;margin-bottom:4px}.site-footer{margin:26px 0 0;text-align:center;color:var(--ink-soft);font-size:13px}.site-footer p{text-align:center}a{color:var(--accent)}`; }
function pageTitleFor(key,lang='tr'){ const tr={'yayin-notu':'Yayın Notu','kaynakca':'Kaynakça','gizlilik-politikasi':'Gizlilik Politikası','cerez-politikasi':'Çerez Politikası','kullanim-sartlari':'Kullanım Şartları','iletisim':'İletişim'}; const en={'yayin-notu':'Publication Note','kaynakca':'Bibliography','gizlilik-politikasi':'Privacy Policy','cerez-politikasi':'Cookie Policy','kullanim-sartlari':'Terms of Use','iletisim':'Contact'}; return (lang==='en'?en:tr)[key]||siteName(lang); }
function descriptionFor(key,content,lang='tr'){ const pages=lang==='en'?(content.pages_en||{}):(content.pages||{}); const body=pages&&pages[key]?stripHtml(pages[key]).slice(0,155):''; const f=lang==='en'?{'yayin-notu':'Publication principles, scope and beta notes for the Military Terms Dictionary.','kaynakca':'Archival sources and bibliographical foundations of the Military Terms Dictionary.','gizlilik-politikasi':'Privacy principles and data processing statement for the Military Terms Dictionary.','cerez-politikasi':'Cookie and local storage statement for the Military Terms Dictionary.','kullanim-sartlari':'Terms of use and academic use principles for the Military Terms Dictionary.','iletisim':'Contact page for corrections, additions and source suggestions.'}:{'yayin-notu':'Askerî Terimler Sözlüğü’nün yayın ilkeleri, kapsamı ve beta sürüm notu.','kaynakca':'Askerî Terimler Sözlüğü’nün arşiv kaynakları ve bibliyografik dayanakları.','gizlilik-politikasi':'Askerî Terimler Sözlüğü gizlilik ilkeleri ve veri işleme açıklaması.','cerez-politikasi':'Askerî Terimler Sözlüğü çerez ve yerel depolama açıklaması.','kullanim-sartlari':'Askerî Terimler Sözlüğü kullanım şartları ve akademik kullanım ilkeleri.','iletisim':'Askerî Terimler Sözlüğü için düzeltme, ekleme ve kaynak önerisi iletişim sayfası.'}; return body||f[key]||siteName(lang); }
function altForPath(canonical,lang){ try{ const u=new URL(canonical); let p=u.pathname; const pairs=[['/','/en/'],['/terimler/','/en/terms/'],['/yayin-notu/','/en/publication-note/'],['/kaynakca/','/en/bibliography/'],['/gizlilik-politikasi/','/en/privacy-policy/'],['/cerez-politikasi/','/en/cookie-policy/'],['/kullanim-sartlari/','/en/terms-of-use/'],['/iletisim/','/en/contact/']]; for(const [tr,en] of pairs){ if(p===tr) return {tr:u.origin+tr,en:u.origin+en}; if(p===en) return {tr:u.origin+tr,en:u.origin+en}; } return {tr:u.origin+'/',en:u.origin+'/en/'}; }catch(e){ return {tr:'/',en:'/en/'}; } }
function pageShell({ title, description, canonical, body, lang='tr' }){ const s=siteName(lang); const home=lang==='en'?'/en/':'/'; const alt=altForPath(canonical,lang); return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · ${escapeHtml(s)}</title><meta name="description" content="${escapeAttr(description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="${escapeAttr(canonical)}"><link rel="alternate" hreflang="tr" href="${escapeAttr(alt.tr)}"><link rel="alternate" hreflang="en" href="${escapeAttr(alt.en)}"><link rel="alternate" hreflang="x-default" href="${escapeAttr(alt.tr)}"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/favicon-96.png" sizes="96x96"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><style>${css()}</style></head><body><div class="site"><header class="topbar"><a class="brand" href="${home}" aria-label="${escapeAttr(s)}"><img class="brand__logo" src="/ats-logo.png" alt="ATS"><span class="brand__name">${escapeHtml(s)}</span></a>${langSwitch(lang)}</header>${navHtml(lang)}<main><h1>${escapeHtml(title)}</h1>${body}</main><footer class="site-footer"><p>© 2026 Ferdi Ertekin · ${escapeHtml(s)}</p></footer></div></body></html>`; }
function xmlEscape(value){ return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
module.exports={ defaults,jsonHeaders,htmlHeaders,textHeaders,xmlHeaders,isAuthorized,readContent,writeContent,escapeHtml,escapeAttr,stripHtml,slugify,allRecords,field,termTitle,termSlug,canonicalBase,langFromEvent,siteName,pageTitleFor,descriptionFor,pageShell,xmlEscape,clientIp,isRateLimited,noteAuthFailure,clearAuthFailures };
