import { handleEditorApi, hasEditorSession } from './_lib/editor.js';
import { handleCommunityApi, sendCommunityNotification } from './_lib/community.js';
import { json, methodNotAllowed } from './_lib/http.js';
import { renderEditablePage, renderEditablePageJson, renderRobots, renderSitemap, renderTermPage, renderTermsIndex } from './_lib/site.js';

const CANONICAL_HOST = 'askeriterimlersozlugu.com';
const SEARCH_NOINDEX = { 'X-Robots-Tag': 'noindex, follow' };

const FULL_RELEASE_HOME_NOTICE_TR = `TERİMLER; 1876–1918 YILLARI ARASINDA RESMÎ İNGİLİZ BELGELERİNDE GEÇEN KURUM, RÜTBE VE YER ADLARININ KENARINA DÜŞÜLEN TÜRKÇE KARŞILIKLAR İLE MUHTELİF RAPORLARDA DAĞINIK HÂLDE BULUNAN İNGİLİZCE-TÜRKÇE KELİMELER ESAS ALINARAK, DÖNEMİN OSMANLI KURUM VE RÜTBE KARŞILIKLARIYLA EŞLEŞTİRİLEREK DERLENMEKTEDİR.

SÖZLÜKTE TEKİL KARŞILIKLARDAN ZİYADE, SÖZ KONUSU DÖNEMİN İNGİLİZ BELGELERİNDE KAYDA GEÇMİŞ BİRLEŞİK TERİM VE TABİRLERE YER VERİLMEKTEDİR. İÇERİK YALNIZCA ASKERÎ TERİMLERLE SINIRLI OLMAYIP İDARÎ, COĞRAFÎ, LİSANÎ VE DİNÎ BİRLEŞİK TERİM VE İFADELERİ DE KAPSAMAKTADIR.

SÖZLÜK SÜREKLİ GÜNCELLENMEKTEDİR. OSMANLICA VE TÜRKÇE KARŞILIKLAR, İLGİLİ BELGENİN BAĞLAMI VE DİĞER KAYNAKLARLA BİRLİKTE DEĞERLENDİRİLMELİDİR.`;
const FULL_RELEASE_HOME_NOTICE_EN = `Entries are compiled from official British documents dated 1876–1918 and matched, where possible, with Ottoman institutional, rank, and period terminology. The dictionary includes compound terms and expressions found in contemporary documents as well as selected administrative, geographical, linguistic, and religious terminology.

The dictionary is continuously updated. Ottoman and modern Turkish equivalents should be assessed together with the context of the relevant document and other available sources.`;
const FULL_RELEASE_PUBLICATION_TR = `Bu sözlük sürekli geliştirilen ve yeni kaynaklar doğrultusunda güncellenen çevrimiçi bir akademik başvuru kaynağıdır. Askerî Terimler Sözlüğü; 1876–1918 dönemine ait askerî tarih, teşkilât, rütbe, idarî yapı ve belge terminolojisine odaklanmaktadır. Bu döneme ait İngiliz belgelerinde geçen pek çok terimin Türkçede yerleşik bir karşılığı bulunmadığından, maddeler tarihsel bağlam ve kaynak kullanımı gözetilerek hazırlanmaktadır.

Çalışmanın amacı, 1876–1918 dönemini kapsayan çevrimiçi bir askerî terimler sözlüğünü alana kazandırmak ve askerî terminolojide tutarlı, denetlenebilir bir başvuru zemini oluşturmaktır.

Maddeler, başta İngiliz askerî istihbarat raporları olmak üzere arşiv belgeleri ve dönem kaynakları üzerinde yürütülen araştırmalar sırasında derlenmektedir. Her madde; İngilizce terimi, Osmanlıca ya da dönem karşılığını, günümüz Türkçesindeki kullanımını ve gerektiğinde kısa bir editör notunu bir arada sunar.

Sözlük sürekli güncellenmektedir; madde karşılıkları ilgili belgenin bağlamı ve mevcut kaynaklarla birlikte değerlendirilmelidir.`;
const FULL_RELEASE_PUBLICATION_EN = `The Military Terms Dictionary is a continuously developed online academic reference resource focused on military history, organization, ranks, administrative structures, and document terminology in the period 1876–1918.

The dictionary consists of terms compiled during archival research, particularly in British military intelligence reports and other period sources. Each entry presents the English term together with its Ottoman or period equivalent, its modern Turkish equivalent, and, where necessary, an editor’s note.

The dictionary is continuously updated as new sources are identified. Term equivalents should be assessed together with the context and date of the relevant document.`;

let fullPublicationMigrationPromise = null;

const DICTIONARY_VISUAL_POLISH = `
<style id="ats-visual-polish">
:root{--claude-canvas:#F7F3EA;--claude-surface:#FFFDF8;--ats-navy:#14213A;--ats-navy-deep:#22405E}
html,body{background:#F7F3EA!important}
body{background-image:none!important;background-color:#F7F3EA!important}
.wrap{padding-top:16px!important}
.preview-topbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:center!important;column-gap:22px!important;padding:2px 0 1px!important}
.preview-brand{grid-column:1!important;justify-self:start!important;gap:0!important}
.preview-brand__name{display:none!important}
.preview-site-nav{grid-column:2!important;grid-row:1!important;display:flex!important;align-items:center!important;justify-content:center!important;justify-self:center!important;flex-wrap:nowrap!important;gap:0 13px!important;margin:0!important;padding:0!important;border:0!important;white-space:nowrap!important;line-height:1.2!important}
.preview-site-nav a{margin:0!important;padding:4px 0!important;color:#474f58!important;font-size:10.5px!important;letter-spacing:.025em!important;text-transform:none!important}
.preview-site-nav a:hover,.preview-site-nav a:focus-visible{color:#7A2231!important;border-bottom-color:#C9A227!important}
.preview-topbar__actions{grid-column:3!important;grid-row:1!important;justify-self:end!important;justify-content:flex-end!important;flex-wrap:nowrap!important}
.preview-hero{padding:5px 0 6px!important}
.preview-eyebrow{margin-bottom:7px!important;gap:14px!important;font-size:10px!important;letter-spacing:.21em!important}
.preview-eyebrow::before,.preview-eyebrow::after{width:54px!important}
.preview-title{gap:4px!important}
.preview-title__top{font-size:14px!important;letter-spacing:.33em!important;text-indent:.33em!important}
.preview-title__main{font-size:clamp(42px,5vw,64px)!important;line-height:1.02!important;letter-spacing:-.02em!important}
.preview-title__date{gap:18px!important;font-size:13px!important;letter-spacing:.24em!important;text-indent:.24em!important}
.preview-title__date::before,.preview-title__date::after{width:52px!important}
.preview-beta{margin-top:2px!important;font-size:10.5px!important;letter-spacing:.14em!important}
.preview-search-tools{margin-top:5px!important}
.preview-search-tools.is-stuck{background:rgba(248,248,246,.96)!important}
.preview-search-row{background:#FFFDF8!important;border-color:#DED5C2!important;box-shadow:0 1px 2px rgba(30,39,50,.05),0 14px 32px -26px rgba(32,57,90,.34),inset 0 1px 0 rgba(255,255,255,.96)!important}
.preview-search-row:hover{border-color:#b8c2cd!important}
.preview-search-row:focus-within{border-color:#C9A227!important;box-shadow:0 0 0 2px rgba(201,162,39,.18),0 16px 34px -28px rgba(32,57,90,.30)!important}
.list-head{background:linear-gradient(180deg,#14213A 0%,#294766 100%)!important;border-top-color:#22405E!important;border-bottom-color:#22405E!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 5px 14px -12px rgba(32,57,90,.58)}
.list-head span{color:#C9A227!important;text-shadow:0 1px 0 rgba(0,0,0,.14)}
.community-auth-nav{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.community-auth-nav a{min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0 11px;border-radius:8px;text-decoration:none;font:600 12px Cambria,Georgia,serif}
.community-auth-nav .community-login{border:1px solid #cfc7b8;background:#fffefa;color:#14213A}
.community-auth-nav .community-signup{border:1px solid #14213A;background:#14213A;color:#fffefa}
.community-editor-access{margin:8px 0 0;text-align:center;font:10px/1.2 Calibri,"Segoe UI",sans-serif}.community-editor-access a{color:#9b9994;text-decoration:none}
@media(max-width:1040px){
  .preview-topbar{column-gap:14px!important}
  .preview-site-nav{gap:0 9px!important}
  .preview-site-nav a{font-size:9.8px!important;letter-spacing:.01em!important}
}
@media(max-width:860px){
  .preview-topbar{grid-template-columns:minmax(0,1fr) auto!important;row-gap:3px!important}
  .preview-brand{grid-column:1!important;grid-row:1!important}
  .preview-topbar__actions{grid-column:2!important;grid-row:1!important}
  .preview-site-nav{grid-column:1/-1!important;grid-row:2!important;width:100%!important;gap:1px 12px!important;flex-wrap:wrap!important;padding:2px 0 1px!important}
  .preview-site-nav a{font-size:10px!important}
  .preview-hero{padding-top:7px!important}
}
@media(max-width:760px){
  .wrap{padding-top:14px!important}
  .preview-hero{padding:8px 0 7px!important}
  .preview-eyebrow{font-size:9.5px!important;letter-spacing:.18em!important;gap:10px!important}
  .preview-eyebrow::before,.preview-eyebrow::after{width:32px!important}
  .preview-title__top{font-size:13px!important}
  .preview-title__main{font-size:clamp(36px,9vw,50px)!important;line-height:1.04!important}
  .preview-title__date{font-size:12px!important;gap:14px!important}
  .preview-title__date::before,.preview-title__date::after{width:36px!important}
}
@media(max-width:560px){
  .preview-topbar{align-items:start!important;row-gap:4px!important}
  .preview-site-nav{gap:1px 9px!important;padding-top:3px!important}
  .preview-site-nav a{font-size:9.5px!important}
  .community-auth-nav{gap:5px}.community-auth-nav a{min-height:32px;padding:0 8px;font-size:10.5px}
}

/* ATS TERM TONE REFINEMENT */
.cell h2{color:#1E232A!important}
.row:hover .cell h2,.row:focus-visible .cell h2{color:#7A2231!important}
.cell-ottoman .value{font-style:normal!important;color:#4A4438!important}

/* ATS WARM GREY ROW TONES */
.list{background:transparent!important}
.row{background:#F1EFE8!important;border-bottom-color:#D7D0C2!important}
.row:nth-child(even){background:#E8E4DA!important}
.row:hover,.row:focus-visible{background:#DDD6C8!important;border-bottom-color:#C7BDAA!important}
.cell{border-right-color:#D5CEC0!important}

/* ATS ANTHRACITE HEADER */
.list-head{background:#2B2B29!important;border-top-color:#3D3B36!important;border-bottom-color:#3D3B36!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.045)!important}
.list-head span{color:#C9A227!important;text-shadow:none!important}

/* ATS HERO AND DETAIL PALETTE 2026-08-08 */
.preview-site-nav{display:none!important}
.preview-topbar{grid-template-columns:auto 1fr auto!important;align-items:start!important;column-gap:14px!important;padding:4px 0 0!important;min-height:68px!important}
.preview-brand{grid-column:1!important;grid-row:1!important;justify-self:start!important;align-self:start!important}
.preview-brand img,.preview-brand__logo{width:58px!important;height:58px!important;max-width:none!important;object-fit:contain!important}
.preview-topbar__actions{grid-column:3!important;grid-row:1!important;justify-self:end!important;align-self:start!important}
.preview-hero{margin-top:-24px!important;padding:0 0 7px!important}
.preview-eyebrow{color:#B3262E!important;font-weight:700!important;letter-spacing:.20em!important;margin-bottom:5px!important}
.preview-eyebrow::before,.preview-eyebrow::after{background:#C9A227!important;border-color:#C9A227!important;opacity:.72!important}
.preview-title__top{color:#9B7A17!important;letter-spacing:.28em!important}
.preview-title__main{color:#1E232A!important;text-shadow:0 1px 0 rgba(201,162,39,.20)!important}
.preview-title__date{color:#9B7A17!important;letter-spacing:.24em!important}
.preview-title__date::before,.preview-title__date::after{border-color:#C9A227!important;background:transparent!important;opacity:.76!important}

.drawer{background:rgba(31,30,26,.46)!important}
.dialog{background:#E9E6DE!important;border:1px solid #CFC6B5!important;box-shadow:0 30px 80px -28px rgba(0,0,0,.46)!important}
.dialog-head{background:#F4F1E9!important;border-bottom:1px solid #C9A227!important}
.dialog-kicker{color:#9B7A17!important}
.dialog h2{color:#1E232A!important}
.close{background:#F1EFE8!important;border-color:#D2CABD!important;color:#2B2B29!important}
.close:hover,.close:focus-visible{border-color:#C9A227!important;color:#9B7A17!important;background:#F7F3EA!important}
.detail-grid{background:transparent!important}
.detail-card{background:#F4F1E9!important;border-color:#D5CEC0!important;box-shadow:none!important}
.detail-card:nth-child(even){background:#ECE8DE!important}
.detail-card::before{background:#C9A227!important;opacity:.78!important}
.detail-card .label{color:#8B6C12!important}
.detail-value{color:#1E232A!important}
.detail-card.ottoman .detail-value{font-style:normal!important;color:#4A4438!important}
.detail-card.modern .detail-value{color:#2B2B29!important}
.detail-card.description .detail-value{color:#4A4438!important}
.source-link{color:#B3262E!important}
.source-link:hover{color:#8F1E25!important}
.detail-editor-actions{background:transparent!important}
.detail-edit-link{background:#2B2B29!important;border-color:#2B2B29!important;color:#C9A227!important;box-shadow:0 6px 14px -9px rgba(43,43,41,.52)!important}
.detail-edit-link:hover,.detail-edit-link:focus-visible{background:#1F1F1D!important;border-color:#C9A227!important;color:#D7B643!important;box-shadow:0 0 0 2px rgba(201,162,39,.15),0 9px 18px -10px rgba(43,43,41,.56)!important}

@media(max-width:860px){.preview-topbar{min-height:62px!important}.preview-brand img,.preview-brand__logo{width:52px!important;height:52px!important}.preview-hero{margin-top:-12px!important}}
@media(max-width:760px){.preview-topbar{align-items:center!important;min-height:54px!important}.preview-brand img,.preview-brand__logo{width:48px!important;height:48px!important}.preview-hero{margin-top:0!important;padding-top:3px!important}}

/* ATS TOPLINE REFINEMENT 2026-08-08 */
.preview-topbar{
  position:relative!important;
  grid-template-columns:auto 1fr auto!important;
  align-items:center!important;
  min-height:72px!important;
  padding:1px 0 0!important;
}
.preview-brand{
  align-self:center!important;
  justify-self:start!important;
}
.preview-brand img,.preview-brand__logo{
  width:68px!important;
  height:68px!important;
  max-width:none!important;
  object-fit:contain!important;
}
.preview-topbar__actions{
  align-self:center!important;
  justify-self:end!important;
}
.preview-hero{
  position:relative!important;
  margin-top:-8px!important;
  padding-top:0!important;
}
.preview-eyebrow{
  position:absolute!important;
  left:50%!important;
  top:-57px!important;
  transform:translateX(-50%)!important;
  width:max-content!important;
  max-width:54vw!important;
  margin:0!important;
  color:#B3262E!important;
  font-weight:700!important;
  letter-spacing:.20em!important;
  white-space:nowrap!important;
  z-index:2!important;
}
.preview-eyebrow::before,.preview-eyebrow::after{
  background:#C9A227!important;
  border-color:#C9A227!important;
  opacity:.78!important;
}
.preview-title__top{
  color:#9B7A17!important;
  font-family:Cambria,Georgia,serif!important;
  font-size:17px!important;
  line-height:1.05!important;
  font-weight:700!important;
  letter-spacing:.23em!important;
  text-indent:.23em!important;
}
.preview-clear{
  color:#1E232A!important;
}
.preview-clear:hover,.preview-clear:focus-visible{
  color:#000!important;
}
.preview-search-row #query::-webkit-search-cancel-button{
  filter:grayscale(1) brightness(0)!important;
}
@media(max-width:900px){
  .preview-brand img,.preview-brand__logo{width:60px!important;height:60px!important}
  .preview-eyebrow{top:-51px!important;max-width:52vw!important;font-size:9.5px!important;letter-spacing:.14em!important}
}
@media(max-width:760px){
  .preview-topbar{min-height:54px!important}
  .preview-brand img,.preview-brand__logo{width:50px!important;height:50px!important}
  .preview-hero{margin-top:0!important;padding-top:3px!important}
  .preview-eyebrow{
    position:static!important;
    transform:none!important;
    width:auto!important;
    max-width:none!important;
    margin:0 0 5px!important;
    white-space:normal!important;
  }
  .preview-title__top{font-size:15px!important}
}

/* ATS HERO TYPOGRAPHY TIGHTEN 2026-08-08 */
.preview-hero{
  margin-top:-18px!important;
  padding-top:0!important;
  padding-bottom:0!important;
}
.preview-title{
  gap:0!important;
}
.preview-eyebrow{
  top:-43px!important;
  font-family:Cambria,Georgia,serif!important;
  font-weight:700!important;
  line-height:1.05!important;
  letter-spacing:.18em!important;
}
.preview-title__top{
  margin:0!important;
  color:#9B7A17!important;
  font-family:Cambria,Georgia,serif!important;
  font-size:18px!important;
  line-height:1!important;
  font-weight:700!important;
  letter-spacing:.22em!important;
  text-indent:.22em!important;
}
.preview-title__main{
  margin-top:2px!important;
}
.preview-title__date{
  margin-top:3px!important;
  color:#9B7A17!important;
  font-family:Cambria,Georgia,serif!important;
  font-weight:700!important;
}
@media(max-width:900px){
  .preview-hero{margin-top:-12px!important}
  .preview-eyebrow{top:-38px!important}
  .preview-title__top{font-size:17px!important}
}
@media(max-width:760px){
  .preview-hero{margin-top:0!important;padding-top:2px!important}
  .preview-eyebrow{position:static!important;transform:none!important;margin-bottom:2px!important}
  .preview-title__top{font-size:16px!important}
}

/* ATS ROW HOVER MUSTARD FRAME 2026-08-08 */
.row:hover,
.row:focus-visible,
.row:active{
  border-bottom-color:#C9A227!important;
  box-shadow:
    inset 3px 0 0 #C9A227,
    inset 0 0 0 1px rgba(201,162,39,.82)!important;
}
.row:hover::before,
.row:focus-visible::before,
.row:active::before{
  background:#C9A227!important;
  border-color:#C9A227!important;
}
.row:focus-visible{
  outline:none!important;
}

/* ATS ROW HOVER TEXT EMPHASIS 2026-08-08 */
.row:hover .cell-ottoman .value,
.row:hover .cell-modern .value,
.row:hover .cell-explanation .value,
.row:focus-visible .cell-ottoman .value,
.row:focus-visible .cell-modern .value,
.row:focus-visible .cell-explanation .value,
.row:active .cell-ottoman .value,
.row:active .cell-modern .value,
.row:active .cell-explanation .value{
  font-weight:600!important;
}

</style>`;

const COMMUNITY_ROUTES = new Set([
  '/uye-ol/','/oturum-ac/','/hesabim/','/parola-yenile/','/uyelik-aydinlatma/',
  '/en/sign-up/','/en/sign-in/','/en/account/','/en/reset-password/','/en/membership-notice/',
  '/editor/community/'
]);

const EDITABLE_ROUTES = new Map([
  ['/yayin-notu/', ['publication-note', 'tr']], ['/en/publication-note/', ['publication-note', 'en']],
  ['/kaynakca/', ['bibliography', 'tr']], ['/en/bibliography/', ['bibliography', 'en']],
  ['/gizlilik-politikasi/', ['privacy', 'tr']], ['/en/privacy-policy/', ['privacy', 'en']],
  ['/cerez-politikasi/', ['cookies', 'tr']], ['/en/cookie-policy/', ['cookies', 'en']],
  ['/kullanim-sartlari/', ['terms-of-use', 'tr']], ['/en/terms-of-use/', ['terms-of-use', 'en']],
  ['/iletisim/', ['contact', 'tr']], ['/en/contact/', ['contact', 'en']]
]);

const LEGACY_REDIRECTS = new Map([
  ['/gizlilik', '/gizlilik-politikasi/'], ['/gizlilik/', '/gizlilik-politikasi/'],
  ['/cerezler', '/cerez-politikasi/'], ['/cerezler/', '/cerez-politikasi/'],
  ['/en/privacy', '/en/privacy-policy/'], ['/en/privacy/', '/en/privacy-policy/'],
  ['/en/cookies', '/en/cookie-policy/'], ['/en/cookies/', '/en/cookie-policy/']
]);

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function communityEnabled(env) {
  return enabled(env.COMMUNITY_FEATURE_ENABLED) &&
    Boolean(env.DB) &&
    String(env.COMMUNITY_SECURITY_SECRET || '').trim().length >= 32 &&
    Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY) &&
    Boolean(env.CF_ACCOUNT_ID && env.CF_EMAIL_API_TOKEN && env.COMMUNITY_EMAIL_FROM);
}

function ttsEnabled(env) {
  return enabled(env.TTS_FEATURE_ENABLED) && Boolean(env.GOOGLE_TTS_CLIENT_EMAIL && env.GOOGLE_TTS_PRIVATE_KEY);
}

function releaseBody(pageKey, lang = 'tr') {
  const tr = lang !== 'en';
  if (pageKey === 'home-notice') return tr ? FULL_RELEASE_HOME_NOTICE_TR : FULL_RELEASE_HOME_NOTICE_EN;
  if (pageKey === 'publication-note') return tr ? FULL_RELEASE_PUBLICATION_TR : FULL_RELEASE_PUBLICATION_EN;
  return '';
}

function legacyReleaseText(value) {
  return /\bbeta\b|\btrial\b|\btest\)?\s+version\b|1880[–-]1918|yapım aşamas|geliştirilme aşamas|under (?:active )?development/i.test(String(value || ''));
}

async function ensureFullPublicationPages(db) {
  if (!db) return;
  if (!fullPublicationMigrationPromise) {
    fullPublicationMigrationPromise = (async () => {
      const rows = await db.prepare(`
        SELECT page_key, title_tr, title_en, body_tr, body_en
        FROM site_pages
        WHERE page_key IN ('home-notice','publication-note')
      `).all();
      const byKey = new Map((rows.results || []).map(row => [row.page_key, row]));
      const definitions = [
        { key:'home-notice', titleTr:'Ana sayfa alt açıklaması', titleEn:'Home-page notice', bodyTr:FULL_RELEASE_HOME_NOTICE_TR, bodyEn:FULL_RELEASE_HOME_NOTICE_EN },
        { key:'publication-note', titleTr:'Yayın Notu', titleEn:'Publication Note', bodyTr:FULL_RELEASE_PUBLICATION_TR, bodyEn:FULL_RELEASE_PUBLICATION_EN }
      ];
      const statements = [];
      for (const definition of definitions) {
        const current = byKey.get(definition.key);
        const currentText = `${current?.body_tr || ''}\n${current?.body_en || ''}`;
        if (current && !legacyReleaseText(currentText)) continue;
        statements.push(db.prepare(`
          INSERT INTO site_pages (page_key, title_tr, title_en, body_tr, body_en, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          ON CONFLICT(page_key) DO UPDATE SET
            title_tr=excluded.title_tr, title_en=excluded.title_en,
            body_tr=excluded.body_tr, body_en=excluded.body_en, updated_at=excluded.updated_at
        `).bind(
          definition.key,
          current?.title_tr || definition.titleTr,
          current?.title_en || definition.titleEn,
          definition.bodyTr,
          definition.bodyEn
        ));
      }
      if (statements.length) {
        statements.push(db.prepare(`
          INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
          VALUES ('full_publication_cleanup', 'site', 'publication-status', 'release-2026-07', ?1)
        `).bind(JSON.stringify({ pages: statements.length, scope: 'beta-to-full-publication', period: '1876–1918' })));
        await db.batch(statements);
      }
    })().catch(error => {
      console.error('full_publication_cleanup_failed', error);
      fullPublicationMigrationPromise = null;
    });
  }
  return fullPublicationMigrationPromise;
}

function applyFullPublicationCleanup(html, lang = 'tr') {
  const tr = lang !== 'en';
  const homeNotice = releaseBody('home-notice', lang);
  let cleaned = String(html || '')
    .replace(/1880[–-]1918/g, '1876–1918')
    .replace(/<([a-z][a-z0-9]*)\b[^>]*class="[^"]*(?:preview-beta|hero-beta|beta-label)[^"]*"[^>]*>[\s\S]*?<\/\1>\s*/gi, '')
    .replace(/<p id="editableHomeNotice">[\s\S]*?<\/p>/i, `<p id="editableHomeNotice">${homeNotice}</p>`)
    .replace(/© 2026\s*·\s*Beta(?:\s*\(Deneme\))?\s*sürümü\s*·\s*/gi, '© 2026 · ')
    .replace(/© 2026\s*·\s*Beta(?:\s*\(test\))?\s*version\s*·\s*/gi, '© 2026 · ')
    .replace(/\[Beta\/Deneme Sürümü\]/gi, '')
    .replace(/\[Beta\/Trial Version\]/gi, '')
    .replace(/Bu sözlük, kişisel ve mütevazı bir çabanın ürünü olup hâlen geliştirilmektedir\./gi, 'Bu sözlük sürekli geliştirilen ve yeni kaynaklar doğrultusunda güncellenen çevrimiçi bir akademik başvuru kaynağıdır.')
    .replace(/Bu sözlük hâlen geliştirilme aşamasındadır\./gi, 'Bu sözlük sürekli geliştirilen ve yeni kaynaklar doğrultusunda güncellenen çevrimiçi bir akademik başvuru kaynağıdır.')
    .replace(/Site, beta \(deneme\) sürümündedir\./gi, 'Sözlük sürekli güncellenmektedir; madde karşılıkları ilgili belgenin bağlamı ve mevcut kaynaklarla birlikte değerlendirilmelidir.')
    .replace(/This dictionary is still under development\./gi, 'The Military Terms Dictionary is a continuously developed online academic reference resource.')
    .replace(/The site is in beta \(trial\) version\./gi, 'The dictionary is continuously updated as new sources are identified. Term equivalents should be assessed together with the context and date of the relevant document.')
    .replace(/The website is currently in beta \(test\) version\./gi, 'The dictionary is continuously updated as new sources are identified. Term equivalents should be assessed together with the context and date of the relevant document.')
    .replace(/This dictionary is in beta\/trial stage\./gi, 'This dictionary is continuously updated.');
  if (tr) cleaned = cleaned.replace(/Beta\s*\(Deneme\)\s*Sürümü/gi, '');
  else cleaned = cleaned.replace(/Beta\s*(?:\([^)]*\)\s*)?(?:Version|version)/gi, '');
  return cleaned;
}

function redirect(url, pathname, status = 308) {
  const target = new URL(url); target.pathname = pathname; return Response.redirect(target.toString(), status);
}

async function assetRequest(context, pathname, extraHeaders = {}) {
  const target = new URL(context.request.url); target.pathname = pathname; target.search = '';
  const response = await context.env.ASSETS.fetch(new Request(target, context.request));
  if (!Object.keys(extraHeaders).length) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function stripInstallLinks(html) {
  return html.replace(/\s*<a class="install-app-link" href="[^"]*">[^<]*<\/a>\s*/gi, ' ').replace(/\s*·\s*·\s*/g, ' · ');
}

function stripBrandName(html) {
  return html.replace(/\s*<span class="preview-brand__name">[^<]*<\/span>\s*/gi, '\n');
}

function moveSiteNavIntoTopbar(html) {
  const navMatch = html.match(/\s*<nav class="preview-site-nav"[^>]*>[\s\S]*?<\/nav>\s*/i);
  if (!navMatch) return html;
  const nav = navMatch[0].trim();
  const withoutNav = html.replace(navMatch[0], '\n');
  return withoutNav.replace(
    /(<a class="preview-brand"[\s\S]*?<\/a>)\s*(<div class="preview-topbar__actions">)/i,
    `$1\n  ${nav}\n  $2`
  );
}

function applyEditorShortcut(html, authenticated, lang) {
  if (!authenticated) return html;
  const tr = lang !== 'en';
  const href = tr ? '/editor/panel/?new=1&return=%2F' : '/editor/panel/?new=1&return=%2Fen%2F';
  const label = tr ? '＋ Yeni madde' : '＋ New entry';
  const title = tr ? 'Yeni sözlük maddesi ekle' : 'Add a new dictionary entry';
  const exportLabel = tr ? '⬇ Dışa aktar' : '⬇ Export';
  const exportTitle = tr ? 'Sözlük verilerini JSON veya CSV olarak dışa aktar' : 'Export dictionary data as JSON or CSV';
  const controls = `<a class="preview-editor-link" href="${href}" title="${title}">${label}</a><a class="preview-editor-link" href="/editor/export/" title="${exportTitle}" style="margin-left:8px">${exportLabel}</a>`;
  return html.replace(/<a class="preview-editor-link" href="\/editor\/"[^>]*>[^<]*<\/a>/i, controls);
}

function communityNav(lang) {
  const tr = lang !== 'en';
  return `<nav class="community-auth-nav" data-community-nav data-lang="${tr ? 'tr' : 'en'}" aria-label="${tr ? 'Üyelik' : 'Membership'}"><a class="community-login" href="${tr ? '/oturum-ac/' : '/en/sign-in/'}">${tr ? 'Oturum Aç' : 'Sign in'}</a><a class="community-signup" href="${tr ? '/uye-ol/' : '/en/sign-up/'}">${tr ? 'Üye Ol' : 'Join'}</a></nav>`;
}

function applyCommunityControls(html, editorAuthenticated, lang) {
  const nav = communityNav(lang);
  const editorSpan = /<span data-nosnippet>\s*<a class="preview-editor-link"[^>]*>[^<]*<\/a>\s*<\/span>/i;
  let result;
  if (editorAuthenticated) {
    const dashboard = `<a class="preview-editor-link" href="/editor/community/" title="${lang === 'en' ? 'Community dashboard' : 'Topluluk paneli'}">${lang === 'en' ? 'Community' : 'Topluluk'}</a>`;
    result = html.replace(editorSpan, match => `${nav}${dashboard}${match}`);
  } else {
    result = html.replace(editorSpan, nav);
    const label = lang === 'en' ? 'Editor' : 'Editör';
    if (!result.includes('community-editor-access')) result = result.replace('</footer>', `<p class="community-editor-access" data-nosnippet><a href="/editor/">${label}</a></p></footer>`);
  }
  if (!result.includes('/assets/community-nav.js')) result = result.replace('</body>', '<script src="/assets/community-nav.js" defer></script>\n<script src="/assets/community-dictionary.js" defer></script>\n</body>');
  return result;
}

function injectTurkishTtsClient(html) {
  if (html.includes('/assets/ats-tr-tts.js')) return html;
  return html.replace('</body>', '<script src="/assets/ats-tr-tts.js" defer></script>\n</body>');
}

function applyDictionaryVisualPolish(html, authenticated = false, lang = 'tr', features = {}) {
  let cleaned = stripInstallLinks(html);
  cleaned = stripBrandName(cleaned);
  cleaned = moveSiteNavIntoTopbar(cleaned);
  cleaned = applyEditorShortcut(cleaned, authenticated, lang);
  if (features.community) cleaned = applyCommunityControls(cleaned, authenticated, lang);
  if (features.tts) cleaned = injectTurkishTtsClient(cleaned);
  if (!cleaned.includes('id="ats-visual-polish"')) {
    cleaned = cleaned.replace('</head>', `${DICTIONARY_VISUAL_POLISH}\n</head>`);
  }
  if (!cleaned.includes('/assets/topbar-layout-20260809.css')) {
    cleaned = cleaned.replace('</head>', '<link rel="stylesheet" href="/assets/topbar-layout-20260809.css?v=3">\n</head>');
  }
  if (!cleaned.includes('/assets/topbar-layout-20260809.js')) {
    cleaned = cleaned.replace('</body>', '<script defer src="/assets/topbar-layout-20260809.js?v=3"></script>\n</body>');
  }
  return cleaned;
}

async function dictionaryAssetRequest(context, pathname, lang, extraHeaders = {}) {
  const response = await assetRequest(context, pathname, extraHeaders);
  if (context.request.method === 'HEAD' || !response.ok) return response;
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;
  const authenticated = await hasEditorSession(context);
  let html = applyDictionaryVisualPolish(await response.text(), authenticated, lang, {
    community: communityEnabled(context.env),
    tts: ttsEnabled(context.env)
  });
  html = applyFullPublicationCleanup(html, lang);
  const headers = new Headers(response.headers);
  headers.delete('Content-Length'); headers.delete('Content-Encoding'); headers.delete('ETag');
  headers.set('Cache-Control', 'no-cache, must-revalidate');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function communityRenderedResponse(response, request, env) {
  if (!response || request.method === 'HEAD' || !response.ok) return response;
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = await response.text();
  const lang = new URL(request.url).pathname.startsWith('/en/') ? 'en' : 'tr';
  html = applyFullPublicationCleanup(html, lang);
  if (communityEnabled(env) && !html.includes('/assets/community-nav.js')) html = html.replace('</body>', '<script src="/assets/community-nav.js" defer></script>\n</body>');
  if (ttsEnabled(env)) html = injectTurkishTtsClient(html);
  const headers = new Headers(response.headers);
  headers.delete('Content-Length'); headers.delete('Content-Encoding'); headers.delete('ETag');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function editorCommunitySummary(context) {
  if (!communityEnabled(context.env)) return json({ ok:false, error:'membership_not_enabled' }, { status:503 });
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!(await hasEditorSession(context))) return json({ ok:false, error:'unauthorized' }, { status:401 });
  if (!context.env.DB) return json({ ok:false, error:'database_not_configured' }, { status:503 });
  try {
    const [counts, recent, interests, contributions] = await Promise.all([
      context.env.DB.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN email_verified_at IS NOT NULL AND is_active=1 THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN email_verified_at IS NOT NULL AND is_active=1 AND created_at>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS last30,
        SUM(CASE WHEN notify_new_terms=1 AND email_verified_at IS NOT NULL AND is_active=1 THEN 1 ELSE 0 END) AS new_term_optins,
        SUM(CASE WHEN notify_updates=1 AND email_verified_at IS NOT NULL AND is_active=1 THEN 1 ELSE 0 END) AS update_optins,
        (SELECT COUNT(*) FROM community_favorites) AS favorites,
        (SELECT COUNT(*) FROM community_contributions WHERE status='new') AS open_contributions
        FROM community_users`).first(),
      context.env.DB.prepare(`SELECT email,display_name,institution,interest_area,locale,created_at,last_login_at
        FROM community_users WHERE email_verified_at IS NOT NULL AND is_active=1 ORDER BY created_at DESC LIMIT 40`).all(),
      context.env.DB.prepare(`SELECT COALESCE(NULLIF(interest_area,''),'unspecified') AS interest_area,COUNT(*) AS count
        FROM community_users WHERE email_verified_at IS NOT NULL AND is_active=1 GROUP BY COALESCE(NULLIF(interest_area,''),'unspecified') ORDER BY count DESC`).all(),
      context.env.DB.prepare(`SELECT c.id,c.term_slug,c.suggestion_type,c.message,c.status,c.created_at,u.email,u.display_name
        FROM community_contributions c JOIN community_users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 50`).all()
    ]);
    return json({ ok:true, counts:{
      total:Number(counts?.total||0), verified:Number(counts?.verified||0), last30:Number(counts?.last30||0),
      newTermOptins:Number(counts?.new_term_optins||0), updateOptins:Number(counts?.update_optins||0),
      favorites:Number(counts?.favorites||0), openContributions:Number(counts?.open_contributions||0)
    }, recentMembers:recent.results||[], interests:interests.results||[], contributions:contributions.results||[] });
  } catch (error) {
    return json({ ok:false, error:'community_schema_not_ready', message:String(error?.message||error) }, { status:503 });
  }
}

async function handleEditorApiWithNotifications(context, path) {
  const response = await handleEditorApi(context, path);
  const isCreate = path === '/api/editor/terms' && context.request.method === 'POST';
  const isUpdate = /^\/api\/editor\/terms\/[^/]+$/.test(path) && context.request.method === 'PUT';
  if (!response.ok || (!isCreate && !isUpdate) || !communityEnabled(context.env)) return response;
  try {
    const data = await response.clone().json();
    const term = data?.term;
    if (data?.ok && term?.status === 'published') {
      context.waitUntil(sendCommunityNotification(context.env, {
        kind: isCreate ? 'new-term' : 'update',
        slug: term.slug,
        headword: term.headword_en,
        modern: term.modern_equivalent_tr || '',
        explanation: term.explanation_tr || ''
      }));
    }
  } catch {}
  return response;
}

function unavailable(type = 'text/html; charset=utf-8') {
  let body = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Geçici olarak kullanılamıyor</title><p>Hizmet kısa süre içinde yeniden denenecektir.</p></html>';
  if (type.startsWith('application/json')) body = JSON.stringify({ ok:false, error:'service_unavailable' });
  if (type.startsWith('application/xml')) body = '<?xml version="1.0" encoding="UTF-8"?><error>service_unavailable</error>';
  return new Response(body, { status:503, headers:{ 'Content-Type':type, 'Cache-Control':'no-store', 'Retry-After':'300', 'X-Robots-Tag':'noindex, follow' } });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const getOrHead = context.request.method === 'GET' || context.request.method === 'HEAD';
  const communityOn = communityEnabled(context.env);

  if (url.hostname === `www.${CANONICAL_HOST}`) { url.protocol='https:'; url.hostname=CANONICAL_HOST; return Response.redirect(url.toString(),301); }
  if (getOrHead && path.endsWith('/index.html')) return redirect(url, path.slice(0,-'index.html'.length)||'/',301);
  if (getOrHead && (path === '/dictionary-d1-preview' || path === '/dictionary-d1-preview.html')) return redirect(url,'/',301);
  if (getOrHead && (path === '/dictionary-d1-preview-en' || path === '/dictionary-d1-preview-en.html')) return redirect(url,'/en/',301);

  const legacyTarget = LEGACY_REDIRECTS.get(path);
  if (getOrHead && legacyTarget) return redirect(url,legacyTarget,301);
  if (getOrHead && !path.endsWith('/')) {
    const slashPath = `${path}/`;
    if (EDITABLE_ROUTES.has(slashPath) || COMMUNITY_ROUTES.has(slashPath) || slashPath==='/en/' || slashPath==='/terimler/' || slashPath==='/en/terms/' || slashPath==='/editor/') return redirect(url,slashPath,301);
  }

  if (getOrHead && context.env.DB && (
      path==='/' || path==='/en/' || path==='/yayin-notu/' || path==='/en/publication-note/' || path.startsWith('/api/site-pages/'))) {
    await ensureFullPublicationPages(context.env.DB);
  }

  if (path === '/api/account/config') {
    if (communityOn) return handleCommunityApi(context,path);
    return json({
      ok:true,
      featureEnabled:false,
      turnstileSiteKey:'',
      turnstileConfigured:false,
      emailConfigured:false,
      registrationReady:false,
      consentVersion:'2026-07-21'
    });
  }
  if (path.startsWith('/api/account/')) {
    if (!communityOn) return json({ ok:false, error:'membership_not_enabled' }, { status:503 });
    return handleCommunityApi(context,path);
  }
  if (path === '/api/editor/community-summary') return editorCommunitySummary(context);
  if (path.startsWith('/api/editor/')) return handleEditorApiWithNotifications(context,path);

  const publicPageApi = path.match(/^\/api\/site-pages\/([^/]+)$/);
  if (getOrHead && publicPageApi) {
    if (!context.env.DB) return unavailable('application/json; charset=utf-8');
    return renderEditablePageJson(context.env.DB,decodeURIComponent(publicPageApi[1]));
  }

  const editorPanelRequest = path==='/editor/panel' || path==='/editor/panel/' || path==='/editor/panel/index.html';
  const privatePanelAsset = path==='/editor-panel-private' || path==='/editor-panel-private.html';
  const communityPanelRequest = path==='/editor/community' || path==='/editor/community/' || path==='/editor/community/index.html';
  const privateCommunityAsset = path==='/editor-community-private' || path==='/editor-community-private.html';
  if (getOrHead && (editorPanelRequest || privatePanelAsset || communityPanelRequest || privateCommunityAsset)) {
    if (!(await hasEditorSession(context))) return redirect(url,'/editor/',303);
    if ((communityPanelRequest || privateCommunityAsset) && !communityOn) return redirect(url,'/',303);
    if (path==='/editor/panel') return redirect(url,'/editor/panel/');
    if (path==='/editor/community') return redirect(url,'/editor/community/');
    if (communityPanelRequest || privateCommunityAsset) return assetRequest(context,'/editor-community-private');
    return assetRequest(context,'/editor-panel-private');
  }

  if (getOrHead && path==='/') return dictionaryAssetRequest(context,'/dictionary-d1-preview','tr',url.searchParams.has('q')?SEARCH_NOINDEX:{});
  if (getOrHead && path==='/en/') return dictionaryAssetRequest(context,'/dictionary-d1-preview-en','en',url.searchParams.has('q')?SEARCH_NOINDEX:{});

  const editableRoute = EDITABLE_ROUTES.get(path);
  if (getOrHead && editableRoute) {
    if (!context.env.DB) return unavailable();
    const rendered = await renderEditablePage(context.env.DB,editableRoute[0],editableRoute[1]);
    if (rendered) return communityRenderedResponse(rendered,context.request,context.env);
  }

  if (getOrHead && path==='/terimler/') {
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermsIndex(context.env.DB,'tr'),context.request,context.env);
  }
  if (getOrHead && path==='/en/terms/') {
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermsIndex(context.env.DB,'en'),context.request,context.env);
  }

  const trTerm = path.match(/^\/terim\/([^/]+)(\/?)$/);
  if (getOrHead && trTerm) {
    if (!trTerm[2]) return redirect(url,`/terim/${trTerm[1]}/`,301);
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermPage(context.env.DB,decodeURIComponent(trTerm[1]),'tr'),context.request,context.env);
  }
  const enTerm = path.match(/^\/en\/term\/([^/]+)(\/?)$/);
  if (getOrHead && enTerm) {
    if (!enTerm[2]) return redirect(url,`/en/term/${enTerm[1]}/`,301);
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermPage(context.env.DB,decodeURIComponent(enTerm[1]),'en'),context.request,context.env);
  }

  if (getOrHead && path==='/sitemap.xml') {
    if (!context.env.DB) return unavailable('application/xml; charset=utf-8');
    return renderSitemap(context.env.DB);
  }
  if (getOrHead && path==='/robots.txt') return renderRobots();
  return context.next();
}
