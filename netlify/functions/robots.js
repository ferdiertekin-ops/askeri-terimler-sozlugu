const { textHeaders } = require('./_shared');
exports.handler = async function() {
  return { statusCode: 200, headers: textHeaders(), body: `User-agent: *\nAllow: /\n\nSitemap: https://askeriterimlersozlugu.com/sitemap.xml\n` };
};
