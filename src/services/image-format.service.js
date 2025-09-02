const sharp = require('sharp');
const fs = require('node:fs/promises');
const fss = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dbg = (...a) => { if (process.env.IMAGE_DEBUG) console.log('[image]', ...a); };

function absUrl(u) {
  if (!u) return u;
  try { return new URL(u).toString(); } catch {}
  const port = process.env.PORT || 1337;
  const base = strapi.config.get('server.url') || process.env.PUBLIC_URL || `http://localhost:${port}`;
  return new URL(u, base).toString();
}

async function readLocalIfRelative(u) {
  if (!u || !u.startsWith('/')) return null;
  const tryPaths = [
    path.join(process.cwd(), 'public', u.replace(/^\//, '')),
    path.join(process.cwd(), u.replace(/^\//, '')),
  ];
  for (const p of tryPaths) {
    try {
      if (fss.existsSync(p)) {
        dbg('readLocalIfRelative hit', p);
        return await fs.readFile(p);
      }
    } catch {}
  }
  return null;
}

async function downloadBuffer(fileUrl) {
  const local = await readLocalIfRelative(fileUrl);
  if (local) return local;
  const url = absUrl(fileUrl);
  dbg('fetching', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// === NOWE: upload przez REST /api/upload ===
async function restUploadBuffer({ buffer, filename, altText, caption }) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'image/webp' });
  form.append('files', blob, filename);
  form.append('fileInfo', JSON.stringify({ name: filename, alternativeText: altText || filename, caption: caption || '' }));

  const url = absUrl('/api/upload');
  const res = await fetch(url, {
    method: 'POST',
    headers: process.env.UPLOAD_TOKEN ? { Authorization: `Bearer ${process.env.UPLOAD_TOKEN}` } : {},
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`REST upload failed ${res.status} ${text}`);
  }
  const out = await res.json();
  const uploaded = Array.isArray(out) ? out[0] : out;
  dbg('uploaded via REST', { id: uploaded.id, documentId: uploaded.documentId, url: uploaded.url });
  return uploaded;
}

async function makeWebpVariantFromUploadDocumentId(documentId, opts) {
  const file = await strapi
    .documents('plugin::upload.file')
    .findFirst({
      where: { documentId },
      fields: ['name','url','alternativeText','caption']
    });

  if (!file || !file.url) throw new Error(`Upload file not found: ${documentId}`);
  dbg('source file', { documentId, url: file.url, name: file.name });

  const input = await downloadBuffer(file.url);
  const output = await sharp(input)
    .rotate()
    .resize(opts.width, opts.height, { fit: opts.fit, position: opts.position || 'center', withoutEnlargement: true })
    .webp({ quality: opts.quality })
    .toBuffer();

  const basename = (file.name || 'image').replace(/\.[^.]+$/,'');
  const outName = `${basename}-${opts.width}x${opts.height}.webp`;

  const uploaded = await restUploadBuffer({
    buffer: output,
    filename: outName,
    altText: file.alternativeText || outName,
    caption: file.caption || ''
  });

  return {
    documentId: uploaded.documentId || uploaded.id,
    url: uploaded.url,
    width: opts.width,
    height: opts.height,
    mime: 'image/webp',
    size: uploaded.size,
    name: uploaded.name
  };
}

module.exports = { makeWebpVariantFromUploadDocumentId };
