// src/middlewares/image-enricher.js

const {
  parseImageMetadata
} = require('../utils/image-helpers');

// Lista modeli, które mają lifecycle z przetwarzaniem obrazów
const MODELS_WITH_IMAGE_PROCESSING = [
  'api::instructor.instructor',
  // Dodaj tutaj inne modele które mają lifecycle z obrazami
];

module.exports = () => {
  return async (ctx, next) => {
    try {
      await next();

      // Tylko dla GET requestów
      if (ctx.request.method !== 'GET') {
        return;
      }

      // Sprawdź czy to API response z danymi
      if (!ctx.response.body?.data || !ctx.request.url.startsWith('/api/')) {
        return;
      }

      console.log('🔍 Sprawdzam możliwość wzbogacenia:', ctx.request.url);

      enrichResponseWithProcessedImages(ctx.response.body.data);

    } catch (error) {
      console.error('❌ Błąd w image-enricher middleware:', error.message);
      // Nie blokuj requesta, kontynuuj normalnie
    }
  };
};

function enrichResponseWithProcessedImages(data) {
  try {
    if (Array.isArray(data)) {
      data.forEach(enrichItem);
    } else if (data && typeof data === 'object') {
      enrichItem(data);
    }
  } catch (error) {
    console.error('❌ Błąd wzbogacania danych:', error);
  }
}

function enrichItem(item) {
  try {
    if (!item || typeof item !== 'object') return;

    // Sprawdź wszystkie pola w obiekcie
    Object.keys(item).forEach(key => {
      try {
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
      } catch (error) {
        console.error(`❌ Błąd przetwarzania pola ${key}:`, error.message);
        // Kontynuuj z innymi polami
      }
    });
  } catch (error) {
    console.error('❌ Błąd w enrichItem:', error.message);
  }
}

/**
 * Sprawdza czy obiekt to obraz Strapi (bezpieczniej)
 */
function isImageObject(obj) {
  try {
    return obj &&
      typeof obj === 'object' &&
      typeof obj.url === 'string' &&
      typeof obj.mime === 'string' &&
      obj.mime.startsWith('image/') &&
      obj.documentId; // Strapi 5 ma documentId
  } catch {
    return false;
  }
}

/**
 * Wzbogaca obraz o przetworzone warianty (bezpieczniej)
 */
function enrichImageWithProcessedVariants(image) {
  try {
    // Jeśli już ma processedImages, nie nadpisuj
    if (image.processedImages) {
      return;
    }

    // Sprawdź czy obraz ma metadane o przetwarzaniu
    const metadata = parseImageMetadata(image);

    // Zawsze dodaj podstawową strukturę
    image.processedImages = {
      original: {
        url: image.url,
        width: image.width || null,
        height: image.height || null,
        format: image.ext?.substring(1) || 'unknown'
      }
    };

    if (metadata?.processed && metadata?.variants) {
      // Dodaj przetworzone warianty z metadanych
      metadata.variants.forEach(variant => {
        if (variant.suffix && variant.url) {
          image.processedImages[variant.suffix] = {
            url: variant.url,
            width: variant.width || null,
            height: variant.height || null,
            format: variant.format || 'unknown'
          };
        }
      });

      console.log(`🖼️ Wzbogacono obraz ${image.name} o ${metadata.variants.length} wariantów`);
    } else {
      console.log(`ℹ️ Obraz ${image.name} nie ma przetworzonych wariantów`);
    }

  } catch (error) {
    console.error(`❌ Błąd wzbogacania obrazu ${image?.name}:`, error.message);

    // Fallback - dodaj przynajmniej oryginał
    if (!image.processedImages) {
      image.processedImages = {
        original: {
          url: image.url,
          width: image.width || null,
          height: image.height || null,
          format: image.ext?.substring(1) || 'unknown'
        }
      };
    }
  }
}

/**
 * Sprawdza czy model ma skonfigurowane przetwarzanie obrazów
 */
function hasImageProcessing(contentType) {
  return MODELS_WITH_IMAGE_PROCESSING.includes(contentType);
}

/**
 * Dodaje model do listy z przetwarzaniem obrazów
 */
function addModelWithImageProcessing(contentType) {
  if (!MODELS_WITH_IMAGE_PROCESSING.includes(contentType)) {
    MODELS_WITH_IMAGE_PROCESSING.push(contentType);
    console.log(`➕ Dodano model z przetwarzaniem obrazów: ${contentType}`);
  }
}

module.exports.addModelWithImageProcessing = addModelWithImageProcessing;