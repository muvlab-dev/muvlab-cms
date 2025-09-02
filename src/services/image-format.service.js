const { FormData, File } = require('formdata-node');
const { FormDataEncoder } = require('form-data-encoder');
const { Readable } = require('node:stream');
const fs = require('node:fs/promises');
const fss = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function fixLocalhost(u) {
  try { const url = new URL(u); if (url.hostname === 'localhost') url.hostname = '127.0.0.1'; return url.toString(); } catch { return u; }
}
function absUrl(u) {
  try { return fixLocalhost(new URL(u).toString()); } catch {}
  const port = process.env.PORT || 1337;
  const baseRaw = strapi.config.get('server.url') || process.env.PUBLIC_URL || `http://localhost:${port}`;
  const base = fixLocalhost(baseRaw);
  return new URL(u, base).toString();
}

async function restUploadBuffer({ buffer, filename, altText, caption }) {
  const tmpDir = process.env.TMPDIR || '/tmp';
  const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}-${filename}`);
  await fs.writeFile(tmpPath, buffer);

  const form = new FormData();
  const file = new File([fss.createReadStream(tmpPath)], filename, { type: 'image/webp' });
  form.set('files', file);
  form.set('fileInfo', JSON.stringify({ name: filename, alternativeText: altText || filename, caption: caption || '' }));

  const encoder = new FormDataEncoder(form);
  const url = absUrl('/api/upload');
  const headers = { ...encoder.headers };
  if (process.env.UPLOAD_TOKEN) headers.Authorization = `Bearer ${process.env.UPLOAD_TOKEN}`;

  const res = await fetch(url, { method: 'POST', headers, body: Readable.from(encoder) });
  await fs.unlink(tmpPath).catch(() => {});
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`REST upload failed ${res.status} ${text}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json[0] : json;
}
