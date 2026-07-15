const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');
const defaults = require('./default-content.json');

const STORE_NAME = 'ats-live-content';
const STORE_KEY = 'live';
const HAGOPIAN_MIGRATION_VERSION = 'hagopian-1907-v1';
const HAGOPIAN_MIGRATION_HEADWORDS = new Set(["Bureau of Correspondence (Foreign Office)","Directorate of Weights and Measures","Department of Minting","Department of Assays","Department of Refining","Customs Administration","Administration of the Six Indirect Taxes","Directorate of the Customs on Cereals and Liquors","Directorate of the Customs on Wood","Directorate of the Customs on Fruits and Vegetables","Directorate of the Fishery","Regie Co-Interesse of Tobaccos of the Ottoman Empire","Administration of Public Debts","Imperial Commissary of the Ottoman Public Debts","Council of Inspection and Censure (Supervision)","Bureau of the Domestic Press","Director of the Domestic Press Bureau","Directorate of the Higher Schools","Imperial Civil College","Imperial Lyceum of Galata Seray","Imperial Lyceum of Law","Imperial Lyceum of Languages","School of Arts and Industry","Primary School","Grammar School","Academy or Preparatory School","Superior (High-) School or College","Normal School for Teachers","Normal School for Lady Teachers","Civil Medical School","School for Nomadic Tribes","Imperial Meteorological Observatory","Imperial Museum","Imperial Printing-House","Ministry of Justice and Public Worship","Director of Public Worship (Religions)","Board of the Justice","Court of Cassation","Procurator General of the Court of Cassation","Court of Appeals","Section of Requests","Criminal Section","Correctional Section","Civil Section","Court of Criminal Jurisdiction","Court of Accusation","Court of First Instance","Tribunal of Commerce","First Commercial Court","Maritime Commercial Court","Judge","President (Presiding Judge)","Member of Council","Procurator General (Public Prosecutor)","Assistant Procurator General","Clerk (Judiciary)","Assistant","Trial Justice","Notary Public","Plaintiff","Defendant","Witness","Lawyer, Attorney","Power of Attorney","Prefecture of Police","Council of Police","Council of Gendarmerie","Commissary of Police","Bureau of Passports","Prefects of Police","Directorate of Waters","First Municipality Circle","Municipality (Istanbul)","Municipal Council","Hospital for Strangers","General Directorate of Roads and Bridges","Alienation, Quitclaim","Transmission by Inheritance","International Ottoman Posts","Chaplain of a Regiment","Chaplain of a Battalion","4th Army Corps","Short sword-bayonet","Hilt / Scabbard","Yatagan","Staff-Office","Naval Cadet","Naval Instructor","Assistant Engineer","Clerk (Navy)","Dock Hand","Rigging Loft","Armour-plated Barbette Ship","Armour-plated Turret Ship","Barque","Full-rigged Ship","Iron Ship","Passenger Ship","Torpedo Catcher","Newly-appointed Vali","Acting Governor-General","Comptrollers of Revenue and Expenditure","Chief Secretaries","Registrar of Real-Estate or Title-Deeds","Census-Taker","Quit-claim Commission","Commission of Taxes","Commission of Immigrants","Treasurer","Bureau of Cadasters","Branch of the Agricultural Bank","First Commissioner of Police","Police, Policeman","Inspector","Court of Canon-Law","Judge of Canon-Law","Judicial Court (plural Mehakim)","Deputy Judge","Judge, Magistrate","Chief Secretary (Provincial Administration)","Clerks","Municipality (Provincial Administration)","Municipality Doctor","Vaccinator","Post-Master","Ambassador","Counsellor of Legation","Chargé d'Affaires","Personnel of the Embassy","Embassy, Legation","Chief Secretary (Diplomatic Service)","Consular Corps","Consul-General","General-Consulate","Chancellery","Exchange of Correspondence","Official Correspondence","Unofficial Correspondence","Officially","Unofficially","Exchange of Opinions","Divergency of Opinions","Consular Dispatch","Collective Note","Verbal Note","Ultimatum","Conference, Congress","Plenipotentiary","Treaty","Treaty of Peace","Treaty of Commerce","Indemnity","War Indemnity","Cession of Territory","Occupation","Evacuation","On Furlough","Constitutional Government","Absolute Government","Republic","Commons (Parliament)","Deputy, Delegate, Member of Parliament","Senator","Candidate","Elector","Vote, Votes","Majority of Votes","Minority of Votes","Motion, to Move","Quorum","Political Parties","Conservative Party","Progressive Party","Liberal Party","Supporters of the Government","Opposition","Democratic Party","Republican Party","Leader of the Opposition","Ministerial Crisis","Change of Ministry","Resignation, to Resign","Removal, to Remove","Nomination","Promotion","Decoration","Class, Order","Deficit","Budget","Income","Expenditure","Surplus","War","Naval Battle","Land Battle","Civil War","Declaration of War","State of Siege","Triple Alliance","Offensive and Defensive Alliance","Belligerent Powers","Allied Power","Neutral Power","Attack","Capitulation","Conquest","International","God, the Most High","Jesus Christ","Holy Spirit","Church, Christian Church","Anniversary","Ceremony of Selamliq","Festival (Id; Plural Ayad)","Moslem or Jewish Festival","Birthday","Name-Day","New Year's Day","Birthday of Sultan","Accession of His Imperial Majesty","Investiture with the Sword of the Prophet","Ceremony of Investiture","Circumcision Feast of the Imperial Princes","Circumcision Feast","Wedding","Holy night(s)","Birthday of the Prophet","Night of the Ascent of the Prophet","Night of Ragayib","Night of Absolution (15th Shaban)","Any Night of General Illumination","Night of Power (27th Ramazan)","Night Preceding a Bayram Day","Day Preceding the Two Bayrams","Festival at the End of Ramazan","Moslem Festival of Sacrifice","Mantle of Muhammed","Sultan's Yearly Gifts for Mecca and Medina","Sacred Caravan for the Holy Lands","Christmas","Christmas Eve","Carnival","Lent","Easter","Ascension","Feast of Pentecost","Eucharist","Lord's Supper","Passover (Nissan)","Feast of Atonement (10 Tishri)","Feast of Tabernacles (15 Tishri)","Jewish Fast (Destruction of Jerusalem, 9 Ab)","Jewish Pentecost (6 Sivan)","Festival of Purim (14 Adar)","Khanedani Al Osman (Star in Brilliants)","Ertogroul Nishani (Gold)","Nishani Iftikhar (Star in Brilliants)","Nishani Imtiyaz (Star in Brilliants)","Nishani Osmanee (4 Classes)","Nishani Mejidee (5 Classes)","Nishani Shefaqat (for Ladies, 3 Classes)","Gold Medal of Liyaqat","Gold and Silver Medals of Imtiyaz","Medal of Industry","Silver Medal for Saving Life","Medal of Iftikhar","Rank of Vezir (Highest Civil Grade)","Rank of Bala","1st Grade, 1st Class (Rumeli Beylerbeyi Payesi)","1st Grade, 2nd Class (Rank of Mirimiran)","2nd Class Mutemayiz (Miyrul Umera Payesi)","2nd Grade, 2nd Class","3rd Class","4th Class","5th Class","Marshal = Admiral","General of Division 1st Rank","General of Division 2nd Rank = Vice Admiral","General of Brigade = Rear Admiral","Colonel = Captain","Lieutenant Colonel = Captain of Frigate","Major = Commander","Adjutant Major = Lieutenant Major","Captain = Lieutenant","Chancellor of Roumeli (≈ Archbishop): Vice-Chancellor of Turkey","Chancellor of Anadolou (≈ Bishop)","Rank of the Qadi of Istanbul","Rank of the Two Holy Cities","Rank of the Five Cities (Bilad-I Hamse)","Makhrej Mevleviyeti Payesi","Kibar-I Muderriseen Payesi","Muderriseen Below Suleymaniye","Hoja Payesi"]);
const SCOPE_MIGRATION_VERSION = 'scope-1876-1918-v1';

function editorHash() {
  const configured = String(process.env.EDITOR_PASSWORD_HASH || '').trim();
  if (configured) {
    const lower = configured.toLowerCase();
    // Doğru SHA-256 özeti verilmişse aynen kullan; yanlışlıkla düz parola
    // EDITOR_PASSWORD_HASH alanına girilmişse geriye dönük olarak özetle.
    return /^[0-9a-f]{64}$/.test(lower) ? lower : hash(configured);
  }
  const legacyPlain = String(process.env.EDITOR_PASSWORD || process.env.ATS_EDITOR_PASSWORD || '').trim();
  return legacyPlain ? hash(legacyPlain) : '';
}

function jsonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Editor-Password, X-Editor-Password-Hash',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...extra
  };
}
function htmlHeaders(extra = {}) { return { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store, max-age=0', ...extra }; }
function textHeaders(extra = {}) { return { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'public, max-age=300, s-maxage=300', ...extra }; }
function xmlHeaders(extra = {}) { return { 'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=300, s-maxage=300', ...extra }; }

function hash(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function timingSafeEqualHex(a, b) {
  const aa = String(a || '').trim().toLowerCase();
  const bb = String(b || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(aa) || !/^[0-9a-f]{64}$/.test(bb)) return false;
  return crypto.timingSafeEqual(Buffer.from(aa, 'hex'), Buffer.from(bb, 'hex'));
}

function isAuthorized(event) {
  const expected = editorHash();
  if (!expected) return false;
  const h = event.headers || {};
  const suppliedHash = String(h['x-editor-password-hash'] || h['X-Editor-Password-Hash'] || '').trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(suppliedHash)) return timingSafeEqualHex(suppliedHash, expected);
  const auth = h.authorization || h.Authorization || '';
  const bearer = String(auth).replace(/^Bearer\s+/i, '').trim();
  const pass = h['x-editor-password'] || h['X-Editor-Password'] || bearer;
  return !!pass && timingSafeEqualHex(hash(pass), expected);
}

function store() {
  const config = { name: STORE_NAME, consistency: 'strong' };
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID) config.siteID = siteID;
  if (token) config.token = token;
  return getStore(config);
}

function deepClone(value) { return JSON.parse(JSON.stringify(value)); }

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


function migrationHeadwordKey(value) {
  return String(value == null ? '' : value)
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sheetTitleIndex(sheet) {
  return (sheet.headers || []).findIndex(header => String(header || '').trim() === 'Madde Başı');
}

function applyHagopianMigration(content) {
  if (!content.meta || typeof content.meta !== 'object') content.meta = {};
  const applied = Array.isArray(content.meta.migrations) ? content.meta.migrations : [];
  if (applied.includes(HAGOPIAN_MIGRATION_VERSION)) return { changed: false, added: 0 };

  const existing = new Set();
  for (const sheet of content.data || []) {
    const titleIndex = sheetTitleIndex(sheet);
    if (titleIndex < 0) continue;
    for (const row of sheet.rows || []) {
      const key = migrationHeadwordKey(row[titleIndex]);
      if (key) existing.add(key);
    }
  }

  const targets = new Map((content.data || []).map(sheet => [sheet.name, sheet]));
  let added = 0;
  for (const sourceSheet of defaults.data || []) {
    const titleIndex = sheetTitleIndex(sourceSheet);
    if (titleIndex < 0) continue;
    const targetSheet = targets.get(sourceSheet.name);
    if (!targetSheet) continue;
    for (const row of sourceSheet.rows || []) {
      const headword = row[titleIndex];
      if (!HAGOPIAN_MIGRATION_HEADWORDS.has(headword)) continue;
      const key = migrationHeadwordKey(headword);
      if (!key || existing.has(key)) continue;
      targetSheet.rows.push(deepClone(row));
      existing.add(key);
      added += 1;
    }
  }

  content.meta.migrations = [...applied, HAGOPIAN_MIGRATION_VERSION];
  content.meta.hagopian_migration = {
    version: HAGOPIAN_MIGRATION_VERSION,
    added,
    applied_at: new Date().toISOString()
  };
  content.updatedAt = new Date().toISOString();
  content._writeId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  return { changed: true, added };
}


function replaceScopeRange(value) {
  return String(value == null ? '' : value)
    .replace(/1880–1918/g, '1876–1918')
    .replace(/1880-1918/g, '1876-1918');
}

function replaceScopeValue(value) {
  if (typeof value === 'string') return replaceScopeRange(value);
  if (Array.isArray(value)) return value.map(replaceScopeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = replaceScopeValue(child);
    return out;
  }
  return value;
}

function applyScopeMigration(content) {
  if (!content.meta || typeof content.meta !== 'object') content.meta = {};
  const applied = Array.isArray(content.meta.migrations) ? content.meta.migrations : [];
  if (applied.includes(SCOPE_MIGRATION_VERSION)) return { changed: false };

  content.pages = replaceScopeValue(content.pages || {});
  content.pages_en = replaceScopeValue(content.pages_en || {});
  content.meta = replaceScopeValue(content.meta || {});
  const migrations = new Set(Array.isArray(content.meta.migrations) ? content.meta.migrations : applied);
  migrations.add(SCOPE_MIGRATION_VERSION);
  content.meta.migrations = [...migrations];
  content.meta.scope_migration = {
    version: SCOPE_MIGRATION_VERSION,
    range: '1876–1918',
    applied_at: new Date().toISOString()
  };
  content.updatedAt = new Date().toISOString();
  content._writeId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  return { changed: true };
}

async function readContent() {
  try {
    const blobStore = store();
    const live = await blobStore.get(STORE_KEY, { type: 'json', consistency: 'strong' });
    const normalized = normalizeLive(live);
    const migration = applyHagopianMigration(normalized);
    const scopeMigration = applyScopeMigration(normalized);
    if (live && (migration.changed || scopeMigration.changed)) {
      try {
        await blobStore.setJSON(STORE_KEY, normalized, {
          metadata: {
            updatedAt: normalized.updatedAt,
            writeId: normalized._writeId,
            migration: [HAGOPIAN_MIGRATION_VERSION, SCOPE_MIGRATION_VERSION].join(',')
          }
        });
      } catch (migrationError) {
        normalized.meta = {
          ...(normalized.meta || {}),
          migration_write_error: migrationError && migrationError.message
            ? migrationError.message
            : String(migrationError)
        };
      }
    }
    normalized.meta = {
      ...(normalized.meta || {}),
      live_source: live ? 'blob' : 'defaults',
      migration_added: migration.added,
      scope_migration_changed: scopeMigration.changed
    };
    return normalized;
  } catch (err) {
    const fallback = normalizeLive(null);
    applyHagopianMigration(fallback);
    applyScopeMigration(fallback);
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
  // İstemci eski bir meta nesnesi gönderse bile tamamlanmış göçleri yeniden
  // çalıştırma. Bu işaretler, editörden silinen maddelerin geri gelmesini önler.
  applyScopeMigration(normalized);
  if (!normalized.meta || typeof normalized.meta !== 'object') normalized.meta = {};
  const completedMigrations = new Set(Array.isArray(normalized.meta.migrations) ? normalized.meta.migrations : []);
  completedMigrations.add(HAGOPIAN_MIGRATION_VERSION);
  completedMigrations.add(SCOPE_MIGRATION_VERSION);
  normalized.meta.migrations = [...completedMigrations];
  normalized.updatedAt = new Date().toISOString();
  normalized.meta = {
    ...(normalized.meta || {}),
    live_updated_at: normalized.updatedAt,
    live_source: 'blob'
  };
  normalized._writeId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

  const blobStore = store();
  const result = await blobStore.setJSON(STORE_KEY, normalized, {
    metadata: { updatedAt: normalized.updatedAt, writeId: normalized._writeId }
  });
  // Netlify Blobs setJSON tamamlandığında yazma işlemi onaylanmıştır. İkinci bir GET
  // kaydı gereksiz yere yavaşlattığı için istemciye yazma kimliği doğrudan döndürülür.
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
function css(){ return `:root{--bg:#f8f7f4;--paper:#ffffff;--ink:#232d37;--ink-soft:#5b6570;--line:#e4e2da;--accent:#3d5a78;--olive:#3d5a78;--olive-deep:#2b4460;--brass:#3d5a78;--brass-deep:#2b4460}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#f8f7f4 0%,#eeede8 100%);background-attachment:fixed;color:var(--ink);font-family:Cambria,Georgia,serif;font-size:17px;line-height:1.62}.site{width:min(1080px,calc(100% - 32px));margin:0 auto;padding:22px 0 36px}.topbar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:8px 0 18px}.brand{display:flex;align-items:center;gap:14px;color:var(--ink);text-decoration:none}.brand__logo{width:64px;height:64px;display:block;object-fit:contain;border-radius:50%;filter:drop-shadow(0 4px 10px rgba(32,57,90,.14))}.brand__mark{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid var(--olive);border-radius:50%;font-weight:700;background:var(--olive);color:#f8f7f4;letter-spacing:.08em}.brand__name{font-size:19px;font-weight:700}.brand__flag{width:22px;height:auto;display:block;flex:0 0 auto;border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,.14)}.lang-switch{display:inline-flex;gap:4px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.72);padding:3px}.lang-switch a{padding:5px 9px;border-radius:999px;text-decoration:none;color:var(--ink-soft);font-size:12px;font-weight:700;letter-spacing:.04em}.lang-switch a.active{background:var(--olive);color:#f8f7f4}.site-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin:0 0 24px}.site-nav a{padding:8px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--accent);background:rgba(255,255,255,.70)}main{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:30px 36px;box-shadow:0 18px 50px rgba(20,37,54,.06)}h1{font-family:"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;font-size:34px;line-height:1.15;margin:0 0 16px;text-align:center}h2{font-family:"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;font-size:24px;margin:28px 0 10px}p{text-align:justify;font-family:Cambria,Georgia,serif}.editorial-content{font-family:Cambria,Georgia,serif;text-align:justify}.editorial-content p{margin:0 0 1em;text-align:justify;text-indent:1.25cm}.editorial-content p:first-child{margin-top:0}.editorial-content h2,.editorial-content h3,.editorial-content h4{text-align:left;text-indent:0}.editorial-content li{text-align:justify}.lead{text-align:center;color:var(--ink-soft);font-size:18px;text-indent:0!important}.meta{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink-soft);font-size:13px}.source-list{padding-left:22px}.source-list li{margin:7px 0}.term-list{columns:3 220px;column-gap:34px;line-height:1.6}.term-list li{break-inside:avoid;margin:0 0 6px}.term-list a{color:var(--brass);text-decoration:none}.term-list a:hover{text-decoration:underline}.detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:20px}.detail-row{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}.detail-row small{display:block;color:var(--ink-soft);font-size:12px;margin-bottom:4px}.site-footer{margin:26px 0 0;text-align:center;color:var(--ink-soft);font-size:13px}.site-footer p{text-align:center}a{color:var(--accent)}`; }
function pageTitleFor(key,lang='tr'){ const tr={'terimler':'Terimler Dizini','yayin-notu':'Yayın Notu','kaynakca':'Kaynakça','gizlilik-politikasi':'Gizlilik Politikası','cerez-politikasi':'Çerez Politikası','kullanim-sartlari':'Kullanım Şartları','iletisim':'İletişim'}; const en={'terimler':'Terms Index','yayin-notu':'Publication Note','kaynakca':'Bibliography','gizlilik-politikasi':'Privacy Policy','cerez-politikasi':'Cookie Policy','kullanim-sartlari':'Terms of Use','iletisim':'Contact'}; return (lang==='en'?en:tr)[key]||siteName(lang); }
function descriptionFor(key,content,lang='tr'){ const pages=lang==='en'?(content.pages_en||{}):(content.pages||{}); const body=pages&&pages[key]?stripHtml(pages[key]).slice(0,155):''; const f=lang==='en'?{'terimler':'Live terms index of the Military Terms Dictionary.','yayin-notu':'Publication principles, scope and beta notes for the Military Terms Dictionary.','kaynakca':'Archival sources and bibliographical foundations of the Military Terms Dictionary.','gizlilik-politikasi':'Privacy principles and data processing statement for the Military Terms Dictionary.','cerez-politikasi':'Cookie and local storage statement for the Military Terms Dictionary.','kullanim-sartlari':'Terms of use and academic use principles for the Military Terms Dictionary.','iletisim':'Contact page for corrections, additions and source suggestions.'}:{'terimler':'Askerî Terimler Sözlüğü canlı terimler dizini.','yayin-notu':'Askerî Terimler Sözlüğü’nün yayın ilkeleri, kapsamı ve beta sürüm notu.','kaynakca':'Askerî Terimler Sözlüğü’nün arşiv kaynakları ve bibliyografik dayanakları.','gizlilik-politikasi':'Askerî Terimler Sözlüğü gizlilik ilkeleri ve veri işleme açıklaması.','cerez-politikasi':'Askerî Terimler Sözlüğü çerez ve yerel depolama açıklaması.','kullanim-sartlari':'Askerî Terimler Sözlüğü kullanım şartları ve akademik kullanım ilkeleri.','iletisim':'Askerî Terimler Sözlüğü için düzeltme, ekleme ve kaynak önerisi iletişim sayfası.'}; return body||f[key]||siteName(lang); }
function altForPath(canonical,lang){ try{ const u=new URL(canonical); let p=u.pathname; const pairs=[['/','/en/'],['/terimler/','/en/terms/'],['/yayin-notu/','/en/publication-note/'],['/kaynakca/','/en/bibliography/'],['/gizlilik-politikasi/','/en/privacy-policy/'],['/cerez-politikasi/','/en/cookie-policy/'],['/kullanim-sartlari/','/en/terms-of-use/'],['/iletisim/','/en/contact/']]; for(const [tr,en] of pairs){ if(p===tr) return {tr:u.origin+tr,en:u.origin+en}; if(p===en) return {tr:u.origin+tr,en:u.origin+en}; } return {tr:u.origin+'/',en:u.origin+'/en/'}; }catch(e){ return {tr:'/',en:'/en/'}; } }
function pageShell({ title, description, canonical, body, lang='tr' }){ const s=siteName(lang); const home=lang==='en'?'/en/':'/'; const alt=altForPath(canonical,lang); const noindexPaths=new Set(['/gizlilik-politikasi/','/cerez-politikasi/','/kullanim-sartlari/','/iletisim/','/en/privacy-policy/','/en/cookie-policy/','/en/terms-of-use/','/en/contact/']); let canonicalPath=''; try{canonicalPath=new URL(canonical).pathname}catch(e){} const robots=noindexPaths.has(canonicalPath)?'noindex, follow':'index, follow'; return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · ${escapeHtml(s)}</title><meta name="description" content="${escapeAttr(description)}"><meta name="robots" content="${escapeAttr(robots)}"><link rel="canonical" href="${escapeAttr(canonical)}"><link rel="alternate" hreflang="tr" href="${escapeAttr(alt.tr)}"><link rel="alternate" hreflang="en" href="${escapeAttr(alt.en)}"><link rel="alternate" hreflang="x-default" href="${escapeAttr(alt.tr)}"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/favicon-96.png" sizes="96x96"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><style>${css()}</style></head><body><div class="site"><header class="topbar"><a class="brand" href="${home}" aria-label="${escapeAttr(s)}"><img class="brand__logo" src="/ats-logo-2026.svg" alt="ATS"><span class="brand__name">${escapeHtml(s)}</span></a>${langSwitch(lang)}</header>${navHtml(lang)}<main><h1>${escapeHtml(title)}</h1>${body}</main><footer class="site-footer"><p>${lang==='en'?'© 2026 [Beta/Trial Version] English-Turkish Dictionary of British Military Terms':'© 2026 [Beta/Deneme Sürümü] İngilizce-Türkçe-İngiliz Askeri Terimler Sözlüğü'}</p></footer></div></body></html>`; }
function xmlEscape(value){ return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
module.exports={ defaults,jsonHeaders,htmlHeaders,textHeaders,xmlHeaders,isAuthorized,readContent,writeContent,escapeHtml,escapeAttr,stripHtml,slugify,allRecords,field,termTitle,termSlug,canonicalBase,langFromEvent,siteName,pageTitleFor,descriptionFor,pageShell,xmlEscape };
