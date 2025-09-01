const { parseImageMetadata } = require('../utils/image-processor');

module.exports = () => {
  return async (ctx, next) => {
    try {
      await next();

      if (ctx.request.method !== 'GET') {
        return;
      }

      if (!ctx.response.body?.data || !ctx.request.url.startsWith('/api/')) {
        return;
      }

      console.log('🔍 Wzbogacam response dla:', ctx.request.url);

      enrichResponseWithProcessedImages(ctx.response.body.data);

    } catch (error) {
      console.error('❌ Błąd w image-enricher middleware:', error.message);
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

    Object.keys(item).forEach(key => {
      try {
        const value = item[key];
        if (Array.isArray(value)) {
          value.forEach(enrichItem);
        } else if (value && typeof value === 'object') {
          if (isImageObject(value)) {
            enrichImageWithProcessedVariants(value);
          }
          enrichItem(value);
        }
      } catch (error) {
        console.error(`❌ Błąd przetwarzania pola ${key}:`, error.message);
      }
    });
  } catch (error) {
    console.error('❌ Błąd w enrichItem:', error.message);
  }
}

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

function enrichImageWithProcessedVariants(image) {
  try {
    if (image.processedImages) {
      return;
    }

    const metadata = parseImageMetadata(image);

    image.processedImages = {
      original: {
        url: image.url,
        width: image.width || null,
        height: image.height || null,
        format: image.ext?.substring(1) || 'unknown'
      }
    };

    if (metadata?.processed && metadata?.variants) {
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
    }

  } catch (error) {
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