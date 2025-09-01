// src/utils/image-processor.js (CLOUD SAFE, MINIMAL)
const sharp = require('sharp');
const path = require('path');

async function processImageWithMetadata(imageRef, processConfigs = [], extra = {}) {
  const imageId = imageRef?.documentId || imageRef?.id || imageRef;
  if (!imageId) return null;

  // 1) Pobierz rekord oryginału (asset)
  const image = await strapi
    .documents('plugin::upload.file')
    .findOne({ documentId: imageId });
  if (!image || !image.mime?.startsWith('image/')) return null;

  // 2) Pobierz binarkę oryginału z publicznego URL (cloud storage)
  //    (zakładam, że pliki są publiczne; jeśli prywatne, trzeba dodać auth header)
  const absUrl = image.url.startsWith('http')
    ? image.url
    : `${strapi.config.server.url}${image.url}`;
  const res = await fetch(absUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const inputBuffer = Buffer.from(await res.arrayBuffer());

  const variants = [];
  const base = image.hash || path.parse(image.url).name;

  // 3) Przetwórz i wrzuć każdy wariant przez Upload service (BEZ zapisu na dysk)
  const uploadService = strapi.plugin('upload').service('upload');
  for (const cfg of processConfigs) {
    const ext =
      (cfg.format === 'jpeg' ? 'jpg' : cfg.format) ||
      (image.ext ? image.ext.replace('.', '') : 'jpg');
    const filename = `${base}_${cfg.suffix}_${cfg.width}x${cfg.height}.${ext}`;
    const mime =
      cfg.format === 'webp'
        ? 'image/webp'
        : cfg.format === 'png'
          ? 'image/png'
          : 'image/jpeg';

    // sharp -> buffer
    let s = sharp(inputBuffer).resize(cfg.width, cfg.height, {
      fit: cfg.fit || 'cover',
      position: cfg.position || 'center',
      withoutEnlargement: cfg.withoutEnlargement !== false,
    });
    if (cfg.format === 'webp') s = s.webp({ quality: cfg.quality ?? 85 });
    else if (cfg.format === 'png') s = s.png({ quality: cfg.quality ?? 85, compressionLevel: 9 });
    else s = s.jpeg({ quality: cfg.quality ?? 85, progressive: true, mozjpeg: true });
    const outBuffer = await s.toBuffer();

    // upload z bufora jako nowy asset
    const uploaded = await uploadService.upload({
      data: {
        // opcjonalnie: przypnij do folderu:
        // folder: someFolderId,
        fileInfo: {
          name: filename,
          alternativeText: image.alternativeText || '',
          caption: image.caption || '',
        },
      },
      files: {
        name: filename,
        type: mime,
        size: outBuffer.length,
        buffer: outBuffer, // <-- kluczowe na Cloud
      },
    });

    // uploadService.upload zwraca tablicę lub pojedynczy obiekt (zależnie od providera)
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    variants.push({
      suffix: cfg.suffix,
      url: file?.url, // publiczny adres wariantu z providera (S3, R2, itp.)
      width: cfg.width,
      height: cfg.height,
      format: ext,
    });
  }

  // 4) Zapisz metadane wariantów w oryginale (tak jak dotąd)
  await strapi.documents('plugin::upload.file').update({
    documentId: imageId,
    data: {
      caption: JSON.stringify({
        processed: true,
        processedAt: new Date().toISOString(),
        variants,
        ...extra,
      }),
    },
  });

  return { originalImage: image, processedVariants: variants };
}

function parseImageMetadata(image) {
  if (!image?.caption) return null;
  try {
    const meta = JSON.parse(image.caption);
    return meta?.processed ? meta : null;
  } catch {
    return null;
  }
}

module.exports = { processImageWithMetadata, parseImageMetadata };
