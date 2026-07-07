const { textHeaders, canonicalBase } = require('./_shared');

exports.handler = async function(event) {
  const base = canonicalBase(event);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
  return { statusCode: 200, headers: textHeaders(), body };
};
