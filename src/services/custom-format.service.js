const sharp = require('sharp');
const { FormData, File } = require('formdata-node');
const { FormDataEncoder } = require('form-data-encoder');
const { Readable } = require('node:stream');
const fs = require('node:fs/promises');
const fss = require('node:fs');
const path = require('node:path');

function fixLocalhost(u) {
  try { const url = new URL(u); if (url.hostname === 'localhost') url.hostname = '127.0.0.1'; return url.toString(); } catch { return u; }
}
function absUrl(u) {
  try { return fixLocalhost(new URL(u).toString()); } catch {}
  const port = process.env.PORT || 1337;
  const base = fixLocalhost(strapi.config.get('server.url') || process.env.PUBLIC_URL || `http://localhost:${port}`);
  return new URL(u, base).toString();
}
async function readLocalIfRelative(u) {
  if (!u || !u.startsWith('/')) return null;
  const p1 = path.join(process.cwd(), 'public', u.replace(/^\//,''));
  const p2 = path.join(process.cwd(), u.replace(/^\//,''));
  if (fss.existsSync(p1)) return fs.readFile(p1);
  if (fss.existsSync(p2)) return fs.readFile(p2);
  return null;
}
async function getBuffer(fileUrl) {
  const local = await readLocalIfRelative(fileUrl);
  if (local) return local;
  const url = absUrl(fileUrl);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function restUploadBuffer({ buffer, filename, altText, caption }) {
  const form = new FormData();
  const tmpFile = new File([buffer], filename, { type: 'image/webp' });
  form.set('files', tmpFile);
  form.set('fileInfo', JSON.stringify({
    name: filename,
    alternativeText: altText || filename,
    caption: caption || ''
  }));

  const encoder = new FormDataEncoder(form);

  const res = await fetch(absUrl('/api/upload'), {
    method: 'POST',
    headers: Object.assign(
      {},
      encoder.headers,
      process.env.UPLOAD_TOKEN ? { Authorization: `Bearer ${process.env.UPLOAD_TOKEN}` } : {}
    ),
    body: Readable.from(encoder),
    duplex: 'half' // <-- kluczowy fix dla undici
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`REST upload failed ${res.status} ${txt}`);
  }
  const out = await res.json();
  return Array.isArray(out) ? out[0] : out;
}


async function makeVariantFromDocumentId(documentId, { w, h, fit, position }) {
  const file = await strapi
    .documents('plugin::upload.file')
    .findFirst({ where: { documentId }, fields: ['name','url','alternativeText','caption'] });
  if (!file || !file.url) throw new Error(`Upload file not found: ${documentId}`);
  const input = await getBuffer(file.url);
  const webp = await sharp(input).rotate().resize(w, h, { fit, position, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const base = (file.name || 'image').replace(/\.[^.]+$/,'');
  const outName = `${base}-${w}x${h}.webp`;
  const uploaded = await restUploadBuffer({ buffer: webp, filename: outName, altText: file.alternativeText || outName, caption: file.caption || '' });
  return { documentId: uploaded.documentId || uploaded.id, url: uploaded.url, width: w, height: h, mime: 'image/webp', size: uploaded.size, name: uploaded.name };
}
module.exports = { makeVariantFromDocumentId };
