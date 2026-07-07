const { jsonHeaders, isAuthorized, readContent, writeContent } = require('./_shared');
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:jsonHeaders(), body:'' };
  if (event.httpMethod === 'GET') { const content = await readContent(); return { statusCode:200, headers:jsonHeaders(), body:JSON.stringify(content) }; }
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:jsonHeaders(), body:JSON.stringify({ error:'method_not_allowed' }) };
  if (!isAuthorized(event)) return { statusCode:401, headers:jsonHeaders(), body:JSON.stringify({ error:'unauthorized' }) };
  let payload; try { payload=JSON.parse(event.body||'{}'); } catch(err){ return { statusCode:400, headers:jsonHeaders(), body:JSON.stringify({ error:'invalid_json' }) }; }
  const current = await readContent(); const next = { ...current }; const kind = payload.kind || 'all';
  if ((kind==='all'||kind==='data') && Array.isArray(payload.data)) next.data = payload.data;
  if ((kind==='all'||kind==='pages') && payload.pages && typeof payload.pages==='object') next.pages = { ...(current.pages||{}), ...payload.pages };
  if ((kind==='all'||kind==='pages') && payload.pages_en && typeof payload.pages_en==='object') next.pages_en = { ...(current.pages_en||{}), ...payload.pages_en };
  if (payload.meta && typeof payload.meta==='object') next.meta = { ...(current.meta||{}), ...payload.meta };
  const saved = await writeContent(next);
  return { statusCode:200, headers:jsonHeaders(), body:JSON.stringify({ ok:true, updatedAt:saved.updatedAt }) };
};
