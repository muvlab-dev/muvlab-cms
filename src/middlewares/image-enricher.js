// src/middlewares/image-enricher.js

const {
  getProcessedVariantsFromMetadata,
  parseImageMetadata
} = require('../utils/image-helpers');

module.exports = () => {
  return async (ctx, next) => {
    await next();

    // Sprawdź czy to API response z danymi
    if (ctx.response.body?.data && ctx.request.url.startsWith('/api/')) {
      enrichResponseWithProcessedImages(ctx.response.body.data);
    }
  };
};

function enrichResponseWithProcessedImages(data) {
  if (Array.isArray(data)) {
    data.forEach(enrichItem);
  } else if (data && typeof data === 'object') {
    enrichItem(data);
  }
}

function enrichItem(item) {
  if (!item || typeof item !== 'object') return;

  // Sprawdź wszystkie pola w obiekcie
  Object.keys(item).forEach(key => {
    const value = item[key];

    if (Array.isArray(value)) {
      // Jeśli to tablica, przetwórz każdy element
      value.forEach(enrichItem);
    } else if (value && typeof value === 'object') {
      // Sprawdź czy to obraz Strapi
      if (isImageObject(value)) {
        enrichImageWithProcessedVariants(value);
      }
      // Rekurencyjnie przetwórz zagnieżdżone obiekty
      enrichItem(value);
    }
  });
}

/**
 * Sprawdza czy obiekt to obraz Strapi
 */
function isImageObject(obj) {
  return obj &&
    typeof obj === 'object' &&
    obj.url &&
    obj.mime &&
    obj.mime.startsWith('image/');
}

/**
 * Wzbogaca obraz o przetworzone warianty z metadanych
 */
function enrichImageWithProcessedVariants(image) {
  // Sprawdź czy obraz ma metadane o przetwarzaniu
  const metadata = parseImageMetadata(image);

  if (metadata?.processed && metadata?.variants) {
    // Użyj metadanych z bazy danych
    image.processedImages = {
      // Zawsze dodaj oryginał
      original: {
        url: image.url,
        width: image.width,
        height: image.height,
        format: image.ext?.substring(1) || 'unknown'
      }
    };

    // Dodaj wszystkie przetworzone warianty
    metadata.variants.forEach(variant => {
      image.processedImages[variant.suffix] = {
        url: variant.url,
        width: variant.width,
        height: variant.height,
        format: variant.format
      };
    });

    console.log(`🖼️ Wzbogacono obraz ${image.name} o ${metadata.variants.length} wariantów: ${metadata.variants.map(v => v.suffix).join(', ')}`);
  } else {
    // Jeśli nie ma metadanych, dodaj tylko oryginał
    image.processedImages = {
      original: {
        url: image.url,
        width: image.width,
        height: image.height,
        format: image.ext?.substring(1) || 'unknown'
      }
    };

    console.log(`ℹ️ Obraz ${image.name} nie ma przetworzonych wariantów`);
  }
}