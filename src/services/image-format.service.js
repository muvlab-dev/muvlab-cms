const sharp = require('sharp');
const { Readable } = require('node:stream');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function absUrl(u) {
  if (!u) return u;
  try { return new URL(u).toString(); } catch {}
  const port = process.env.PORT || 1337;
  const base = strapi.config.get('server.url') || process.env.PUBLIC_URL || `http://localhost:${port}`;
  return new URL(u, base).toString();
}

async function downloadBuffer(fileUrl) {
  const res = await fetch(absUrl(fileUrl));
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${fileUrl}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function makeWebpVariantFromUploadDocumentId(documentId, opts) {
  const file = await strapi
    .documents('plugin::upload.file')
    .findFirst({
      where: { documentId },
      fields: ['name','url','alternativeText','caption']
    });
  if (!file || !file.url) throw new Error(`Upload file not found: ${documentId}`);

  const input = await downloadBuffer(file.url);
  const output = await sharp(input)
    .rotate()
    .resize(opts.width, opts.height, { fit: opts.fit, position: opts.position || 'center', withoutEnlargement: true })
    .webp({ quality: opts.quality })
    .toBuffer();

  const uploadService = strapi.service('plugin::upload.upload');
  const basename = file.name.replace(/\.[^.]+$/,'');
  const outName = `${basename}-${opts.width}x${opts.height}.webp`;
  const tmpPath = path.join('/tmp', `${crypto.randomUUID()}-${outName}`);
  await fs.writeFile(tmpPath, output);

  const [uploaded] = await uploadService.upload({
    data: {
      fileInfo: { name: outName, alternativeText: file.alternativeText || outName, caption: file.caption || '' }
    },
    files: [{ path: tmpPath, name: outName, type: 'image/webp', size: output.length }]
  });

  await fs.unlink(tmpPath).catch(() => {});

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
