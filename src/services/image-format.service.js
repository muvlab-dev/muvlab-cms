const sharp = require('sharp');

function absUrl(url) {
  const base = strapi.config.get('server.url') || process.env.PUBLIC_URL || '';
  return url.startsWith('http') ? url : `${base}${url}`;
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
      fields: ['name','url','alternativeText','caption'],
      populate: { folder: true }
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

  const [uploaded] = await uploadService.upload({
    data: {
      fileInfo: { name: outName, alternativeText: file.alternativeText || outName, caption: file.caption || '' },
      folder: file.folder || undefined
    },
    files: { name: outName, type: 'image/webp', size: output.length, buffer: output }
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
