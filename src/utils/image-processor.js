// src/utils/image-processor.js (Cloud-safe + robust URL resolve)
const sharp = require('sharp');
const path = require('path');

function joinUrl(base, rel) {
  if (!rel) return base;
  if (/^https?:\/\//i.test(rel)) return rel;
  const b = (base || '').replace(/\/+$/, '');
  const r = String(rel).replace(/^\/+/, '');
  return `${b}/${r}`;
}

async function getDownloadUrlForFile(file) {
  // 1) Jeśli provider potrafi robić signed URL – użyj go (lepsze na private bucket)
  const provider = strapi?.plugin('upload')?.provider;
  if (provider && typeof provider.getSignedUrl === 'function') {
    try {
      const signed = await provider.getSignedUrl(file);
      if (signed && typeof signed === 'string') return signed;
      if (signed && signed.url) return signed.url;
    } catch (e) {
      // brak signed URL albo błąd – spróbujemy ścieżką publiczną
    }
  }

  // 2) W innym wypadku budujemy publiczny absolutny URL
  const base =
    process.env.STRAPI_URL ||
    strapi?.config?.get?.('server.url') ||
    process.env.PUBLIC_URL ||
    '';

  // UWAGA: jeśli base jest puste, a file.url jest względne – fetch zwróci błąd
  return joinUrl(base, file.url);
}

async function processImageWithMetadata(imageRef, processConfigs = [], extra = {}) {
  const imageId = imageRef?.documentId || imageRef?.id || imageRef;
  if (!imageId) return null;

  const file = await strapi.documents('plugin::upload.file').findOne({ documentId: imageId });
  if (!file || !file.mime?.startsWith('image/')) return null;

  // --- Download oryginału z providera/HTTP ---
  const downloadUrl = await getDownloadUrlForFile(file);
  if (!downloadUrl || !/^https?:\/\//i.test(downloadUrl)) {
    throw new Error(`Cannot resolve absolute URL for file ${file.id || file.documentId}: url="${file.url}", base="${process.env.STRAPI_URL || strapi?.config?.get?.('server.url') || ''}"`);
  }

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText}) for ${downloadUrl}`);
  }
  const inputBuffer = Buffer.from(await res.arrayBuffer());

  const uploadService = strapi.plugin('upload').service('upload');
  const variants = [];
  const base = file.hash || path.parse(file.url || '').name || `file_${Date.now()}`;

  for (const cfg of processConfigs) {
    const ext =
      (cfg.format === 'jpeg' ? 'jpg' : cfg.format) ||
      (file.ext ? file.ext.replace('.', '') : 'jpg');
    const filename = `${base}_${cfg.suffix}_${cfg.width}x${cfg.height}.${ext}`;
    const mime =
      cfg.format === 'webp'
        ? 'image/webp'
        : cfg.format === 'png'
          ? 'image/png'
          : 'image/jpeg';

    let s = sharp(inputBuffer).resize(cfg.width, cfg.height, {
      fit: cfg.fit || 'cover',
      position: cfg.position || 'center',
      withoutEnlargement: cfg.withoutEnlargement !== false,
    });

    if (cfg.format === 'webp') s = s.webp({ quality: cfg.quality ?? 85 });
    else if (cfg.format === 'png') s = s.png({ quality: cfg.quality ?? 85, compressionLevel: 9 });
    else s = s.jpeg({ quality: cfg.quality ?? 85, progressive: true, mozjpeg: true });

    const outBuffer = await s.toBuffer();

    if (!outBuffer || !outBuffer.length) {
      throw new Error(`Empty buffer for ${filename}`);
    }
    console.log('[UPLOAD]', filename, 'size=', outBuffer.length);

    const uploaded = await uploadService.upload({
      data: {
        fileInfo: {
          name: filename,
          alternativeText: file.alternativeText || '',
          caption: file.caption || '',
        },
        // opcjonalnie: folder: <folderId>,
      },
      files: [
        {
          name: filename,
          type: mime,
          size: outBuffer.length,
          buffer: outBuffer,         // <— KLUCZOWE
          ext: `.${ext}`,            // pomaga providerom (np. do Content-Type)
          hash: `${base}_${cfg.suffix}_${cfg.width}x${cfg.height}`, // stabilna nazwa
        },
      ],
    });

    const uf = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    variants.push({
      suffix: cfg.suffix,
      url: uf?.url,
      width: cfg.width,
      height: cfg.height,
      format: ext,
    });
  }

  // Zapis metadanych wariantów w oryginale (caption)
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

  return { originalImage: file, processedVariants: variants };
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
