const { renderPage } = require('./page-render');
exports.handler = async function(event) { return renderPage(event, 'cerez-politikasi', 'tr'); };
