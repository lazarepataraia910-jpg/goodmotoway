// One-time migration: reads the DEFAULT_PRODUCTS baked into admin.html,
// uploads their base64 images to Supabase Storage, and inserts rows into
// the `products` table. Run once after applying schema.sql.
//
// Usage:
//   $env:SUPABASE_URL = "https://xxxx.supabase.co"
//   $env:SUPABASE_ANON_KEY = "eyJ..."
//   node supabase/seed.js

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables first.');
  process.exit(1);
}

function extractDefaultProducts(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const marker = 'const DEFAULT_PRODUCTS = ';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`DEFAULT_PRODUCTS not found in ${htmlPath}`);
  const arrStart = html.indexOf('[', start);
  const arrEnd = html.indexOf('];', arrStart);
  const json = html.slice(arrStart, arrEnd + 1);
  return JSON.parse(json);
}

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, contentType, base64] = match;
  const ext = contentType.split('/')[1] || 'jpg';
  return { contentType, ext, buffer: Buffer.from(base64, 'base64') };
}

async function uploadImage(buffer, contentType, objectPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`Upload failed for ${objectPath}: ${res.status} ${await res.text()}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${objectPath}`;
}

async function insertProduct(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`Insert failed for ${row.name}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const htmlPath = path.join(__dirname, '..', 'admin.html');
  const products = extractDefaultProducts(htmlPath);
  console.log(`Found ${products.length} default products in admin.html`);

  for (const p of products) {
    const images = [];

    if (p.img) {
      const decoded = decodeDataUrl(p.img);
      if (decoded) {
        const objectPath = `${p.key || p.id}-cover-${Date.now()}.${decoded.ext}`;
        const url = await uploadImage(decoded.buffer, decoded.contentType, objectPath);
        images.push(url);
        console.log(`Uploaded cover image for "${p.name}" -> ${url}`);
      } else if (/^https?:\/\//.test(p.img)) {
        images.push(p.img);
      }
    }

    for (const [i, extra] of (p.images || []).entries()) {
      if (extra === p.img) continue;
      const decoded = decodeDataUrl(extra);
      if (decoded) {
        const objectPath = `${p.key || p.id}-gallery-${i}-${Date.now()}.${decoded.ext}`;
        const url = await uploadImage(decoded.buffer, decoded.contentType, objectPath);
        images.push(url);
      } else if (/^https?:\/\//.test(extra)) {
        images.push(extra);
      }
    }

    const row = {
      key: p.key || null,
      name: p.name,
      tag: p.tag || null,
      price: p.price ?? 0,
      description: p.desc || null,
      battery: p.battery || null,
      motor: p.motor ?? null,
      speed: p.speed ?? null,
      range_min: p.rangeMin ?? null,
      range_max: p.rangeMax ?? null,
      weight: p.weight ?? null,
      brakes: p.brakes || null,
      tyres: p.tyres || null,
      dims: p.dims || null,
      charge: p.charge || null,
      img: images[0] || null,
      images,
    };

    const inserted = await insertProduct(row);
    console.log(`Inserted "${row.name}" as id=${inserted[0]?.id}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
