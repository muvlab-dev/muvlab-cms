const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

async function processImageWithMetadata(imageRef, processConfigs = [], metadata = {}) {
  const imageId = imageRef?.documentId || imageRef?.id || imageRef;

  if (!imageId) {
    console.log('Brak ID obrazu');
    return null;
  }

  const image = await strapi.documents('plugin::upload.file').findOne({
    documentId: imageId
  });

  if (!image || !image.mime?.startsWith('image/')) {
    console.log('Nie znaleziono obrazu lub nie jest obrazem');
    return null;
  }

  console.log(`🖼️ Przetwarzam obraz: ${image.name}`);

  const processedVariants = [];

  for (const config of processConfigs) {
    try {
      const result = await processImageWithOptions(imageRef, config);
      if (result) {
        processedVariants.push({
          suffix: config.suffix,
          url: result.url,
          width: result.width,
          height: result.height,
          format: result.format
        });
        console.log(`✅ Przetworzono ${config.suffix}: ${config.width}x${config.height}`);
      }
    } catch (error) {
      console.error(`❌ Błąd przetwarzania ${config.suffix}:`, error);
    }
  }

  // Zapisz metadane w caption obrazu
  try {
    await strapi.documents('plugin::upload.file').update({
      documentId: imageId,
      data: {
        caption: JSON.stringify({
          processed: true,
          variants: processedVariants,
          processedAt: new Date().toISOString(),
          ...metadata
        })
      }
    });

    console.log(`💾 Zapisano metadane dla ${image.name}: ${processConfigs.map(c => c.suffix).join(', ')}`);
  } catch (error) {
    console.error('Błąd zapisywania metadanych:', error);
  }

  return { originalImage: image, processedVariants };
}

async function processImageWithOptions(imageRef, options) {
  const imageId = imageRef?.documentId || imageRef?.id || imageRef;

  const image = await strapi.documents('plugin::upload.file').findOne({
    documentId: imageId
  });

  if (!image) return null;

  const uploadsDir = path.join(strapi.dirs.static.public, 'uploads');
  const publicRoot = strapi.dirs.static.public;
  const relativeUrl = (image.url || '').replace(/^\//, '');
  const originalPath = path.join(publicRoot, relativeUrl);

  const baseHash = image.hash || path.parse(relativeUrl).name;
  const extension = (options.format === 'jpeg' ? 'jpg' : options.format) || (image.ext ? image.ext.replace('.', '') : 'jpg');
  const processedFilename = `${baseHash}_${options.suffix}_${options.width}x${options.height}.${extension}`;
  const processedPath = path.join(uploadsDir, processedFilename);

  // Sprawdź czy plik już istnieje
  try {
    await fs.access(processedPath);
    return {
      filename: processedFilename,
      url: `/uploads/${processedFilename}`,
      width: options.width,
      height: options.height,
      format: options.format
    };
  } catch {
    // Plik nie istnieje, utwórz go
  }

  // Sprawdź czy oryginalny plik istnieje
  try {
    await fs.access(originalPath);
  } catch {
    console.log(`Oryginalny plik nie istnieje: ${originalPath}`);
    return null;
  }

  // Przetwórz obraz
  let processedSharp = sharp(originalPath).resize(options.width, options.height, {
    fit: options.fit || 'cover',
    position: options.position || 'center',
    withoutEnlargement: options.withoutEnlargement !== false
  });

  switch (options.format) {
    case 'webp':
      processedSharp = processedSharp.webp({ quality: options.quality || 85 });
      break;
    case 'png':
      processedSharp = processedSharp.png({
        quality: options.quality || 85,
        compressionLevel: 9
      });
      break;
    case 'jpeg':
    default:
      processedSharp = processedSharp.jpeg({
        quality: options.quality || 85,
        progressive: true,
        mozjpeg: true
      });
      break;
  }

  await processedSharp.toFile(processedPath);

  return {
    filename: processedFilename,
    url: `/uploads/${processedFilename}`,
    width: options.width,
    height: options.height,
    format: options.format
  };
}

/**
 * Parsuje metadane obrazu z caption
 */
function parseImageMetadata(image) {
  if (!image?.caption) return null;

  try {
    const metadata = JSON.parse(image.caption);
    return metadata.processed ? metadata : null;
  } catch {
    return null;
  }
}

module.exports = {
  processImageWithMetadata,
  parseImageMetadata
};
