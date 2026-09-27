// Vercel serverless function behind /sitemap.xml (see the rewrite in vercel.json).
// Product pages come from the database, so the list is built per request instead
// of being a static file that goes stale every time a model is added or removed.

const SITE = 'https://www.goodmotoway.com/';
const SUPABASE_URL = 'https://lceebrhbvnyzoxkauugo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZWVicmhidm55em94a2F1dWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODkyNzAsImV4cCI6MjEwMTM2NTI3MH0.IeGvLg09wjni7OJdiLeAiO3pvrXxIUgzISNKnVKpXYI';

const STATIC_PAGES = [
  { path: '', priority: '1.0', changefreq: 'daily' },
  { path: 'compare.html', priority: '0.7', changefreq: 'weekly' },
  { path: 'faq.html', priority: '0.6', changefreq: 'monthly' },
  { path: 'support.html', priority: '0.6', changefreq: 'monthly' }
];

// Same rule as gmProductPath in auth.js: /product/<id>-<latin name>.
function productPath(product) {
  const slug = String(product.name || '').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return 'product/' + product.id + (slug ? '-' + slug : '');
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]));
}

async function loadProducts() {
  const response = await fetch(SUPABASE_URL + '/rest/v1/products?select=id,name,created_at&order=id', {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
  });
  if (!response.ok) throw new Error('products request failed: ' + response.status);
  return response.json();
}

function urlEntry(loc, extra) {
  return '  <url>\n    <loc>' + escapeXml(loc) + '</loc>\n' + extra + '  </url>\n';
}

module.exports = async (req, res) => {
  let products = [];
  try {
    products = await loadProducts();
  } catch (error) {
    // the static pages are still worth listing if the database is unreachable
    console.error('sitemap: could not load products', error);
  }

  let body = '<?xml version="1.0" encoding="UTF-8"?>\n';
  body += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const page of STATIC_PAGES) {
    body += urlEntry(SITE + page.path,
      '    <changefreq>' + page.changefreq + '</changefreq>\n    <priority>' + page.priority + '</priority>\n');
  }
  for (const product of products) {
    const lastmod = product.created_at ? '    <lastmod>' + String(product.created_at).slice(0, 10) + '</lastmod>\n' : '';
    body += urlEntry(SITE + productPath(product),
      lastmod + '    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n');
  }
  body += '</urlset>\n';

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // cached at the edge for an hour, so crawlers don't hit the database on every fetch
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(body);
};
