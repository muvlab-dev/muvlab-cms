// src/utils/image-processor.js

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Konfiguracja rozmiarów dla każdego sufiksu
const SIZE_CONFIGS = {
  // Avatar
  'avatar': { width: 500, height: 500, format: 'jpeg', quality: 85 },

  // Picture variants
  'thumb': { width: 150, height: 100, format: 'webp', quality: 75 },
  'small': { width: 300, height: 200, format: 'webp', quality: 80 },
  'medium': { width: 600, height: 400, format: 'jpeg', quality: 85 },
  'large': { width: 1200, height: 800, format: 'jpeg', quality: 90 },

  // Możesz dodać więcej predefiniowanych rozmiarów
  'banner': { width: 1920, height: 600, format: 'jpeg', quality: 95 },
  'card': { width: 400, height: 300, format: 'webp', quality: 80 },
  'hero': { width: 1600, height: 900, format: 'jpeg', quality: 90 },

  // Muvlab custom
  'instructor-avatar': { width: 500, height: 550, format: 'webp', quality: 80 },
  'instructor-picture': { width: 840, height: 500, format: 'webp', quality: 80 },
};

/**
 * Przetwarza obraz według predefiniowanej konfiguracji
 * @param {Object|String} imageRef - Referencja do obrazu
 * @param {string} suffix - Sufiks określający rozmiar (np. 'avatar', 'thumb', 'medium')
 * @param {Object} customOptions - Opcjonalne nadpisanie domyślnych opcji
 */
async function processImage(imageRef, suffix, customOptions = {}) {
  const config = SIZE_CONFIGS[suffix];
  if (!config) {
    throw new Error(`Nieznany sufiks obrazu: ${suffix}. Dostępne: ${Object.keys(SIZE_CONFIGS).join(', ')}`);
  }

  const options = {
    suffix,
    ...config,
    ...customOptions
  };

  return await processImageWithOptions(imageRef, options);
}

/**
 * Wewnętrzna funkcja do przetwarzania z pełnymi opcjami
 */
async function processImageWithOptions(imageRef, options) {
  try {
    const defaultOptions = {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
      progressive: true
    };

    const config = { ...defaultOptions, ...options };

    const imageId = imageRef?.documentId || imageRef?.id || imageRef;

    if (!imageId) {
      console.log('Brak ID obrazu');
      return null;
    }

    const image = await strapi.documents('plugin::upload.file').findOne({
      documentId: imageId
    });

    if (!image) {
      console.log('Nie znaleziono pliku:', imageId);
      return null;
    }

    if (!image.mime || !image.mime.startsWith('image/')) {
      console.log('Plik nie jest obrazem:', image.mime);
      return null;
    }

    const uploadsDir = path.join(strapi.dirs.static.public, 'uploads');
    const originalPath = path.join(uploadsDir, image.name);

    const extension = config.format === 'jpeg' ? 'jpg' : config.format;
    const processedFilename = `${config.suffix}_${config.width}x${config.height}_${path.parse(image.name).name}.${extension}`;
    const processedPath = path.join(uploadsDir, processedFilename);

    try {
      await fs.access(originalPath);
    } catch {
      console.log('Oryginalny plik nie istnieje:', originalPath);
      return null;
    }

    try {
      await fs.access(processedPath);
      console.log('Przetworzony plik już istnieje:', processedPath);

      return {
        filename: processedFilename,
        path: processedPath,
        url: `/uploads/${processedFilename}`,
        width: config.width,
        height: config.height,
        format: config.format,
        suffix: config.suffix
      };
    } catch {
      // Plik nie istnieje, można go stworzyć
    }

    const sharpInstance = sharp(originalPath);
    const metadata = await sharpInstance.metadata();
    console.log(`Przetwarzanie: ${image.name} (${metadata.width}x${metadata.height}) -> ${config.width}x${config.height}`);

    let processedSharp = sharpInstance.resize(config.width, config.height, {
      fit: config.fit,
      position: config.position,
      withoutEnlargement: config.withoutEnlargement
    });

    switch (config.format) {
      case 'webp':
        processedSharp = processedSharp.webp({
          quality: config.quality
        });
        break;
      case 'png':
        processedSharp = processedSharp.png({
          quality: config.quality,
          compressionLevel: 9
        });
        break;
      case 'jpeg':
      default:
        processedSharp = processedSharp.jpeg({
          quality: config.quality,
          progressive: config.progressive,
          mozjpeg: true
        });
        break;
    }

    await processedSharp.toFile(processedPath);

    console.log(`✅ Przetworzono ${config.suffix}: ${processedFilename}`);

    return {
      filename: processedFilename,
      path: processedPath,
      url: `/uploads/${processedFilename}`,
      width: config.width,
      height: config.height,
      format: config.format,
      suffix: config.suffix,
      originalImage: image
    };

  } catch (error) {
    console.error(`Błąd przetwarzania obrazu (${options.suffix}):`, error);
    throw error;
  }
}

/**
 * Przetwarza obraz do wielu predefiniowanych rozmiarów
 * @param {Object|String} imageRef - Referencja do obrazu
 * @param {Array<string>} suffixes - Tablica sufiksów do przetworzenia
 */
async function processImageMultipleSizes(imageRef, suffixes = []) {
  const results = [];

  for (const suffix of suffixes) {
    try {
      const result = await processImage(imageRef, suffix);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Błąd przetwarzania rozmiaru ${suffix}:`, error);
    }
  }

  return results;
}

/**
 * Generuje URL przetworzonego obrazu (bez podawania wymiarów!)
 * @param {string} originalUrl - Oryginalny URL obrazu
 * @param {string} suffix - Sufiks (np. 'avatar', 'thumb', 'medium')
 * @returns {string|null} - URL przetworzonego obrazu
 */
function getProcessedImageUrl(originalUrl, suffix) {
  if (!originalUrl) return null;

  const config = SIZE_CONFIGS[suffix];
  if (!config) {
    console.warn(`Nieznany sufiks obrazu: ${suffix}. Dostępne: ${Object.keys(SIZE_CONFIGS).join(', ')}`);
    return originalUrl; // Zwróć oryginalny URL jako fallback
  }

  const urlParts = originalUrl.split('/');
  const filename = urlParts.pop();
  if (!filename) return null;

  const nameWithoutExt = path.parse(filename).name;
  const extension = config.format === 'jpeg' ? 'jpg' : config.format;

  const processedFilename = `${suffix}_${config.width}x${config.height}_${nameWithoutExt}.${extension}`;

  return [...urlParts, processedFilename].join('/');
}

/**
 * Dodaj nowy rozmiar do konfiguracji
 */
function addSizeConfig(suffix, config) {
  SIZE_CONFIGS[suffix] = config;
}

/**
 * Pobierz dostępne sufiksy
 */
function getAvailableSuffixes() {
  return Object.keys(SIZE_CONFIGS);
}

/**
 * Pobierz konfigurację dla sufiksu
 */
function getSizeConfig(suffix) {
  return SIZE_CONFIGS[suffix];
}

/**
 * Usuwa przetworzone obrazy dla danego oryginalnego obrazu
 */
async function cleanupProcessedImages(originalImageName) {
  try {
    const uploadsDir = path.join(strapi.dirs.static.public, 'uploads');
    const files = await fs.readdir(uploadsDir);

    const nameWithoutExt = path.parse(originalImageName).name;
    const filesToDelete = files.filter(file =>
      file.includes(`_${nameWithoutExt}.`) &&
      file.match(/^[a-zA-Z]+_\d+x\d+_/)
    );

    for (const file of filesToDelete) {
      const filePath = path.join(uploadsDir, file);
      await fs.unlink(filePath);
      console.log(`🗑️ Usunięto: ${file}`);
    }
  } catch (error) {
    console.error('Błąd czyszczenia przetworzonych obrazów:', error);
  }
}

module.exports = {
  processImage,
  processImageMultipleSizes,
  getProcessedImageUrl,
  cleanupProcessedImages,
  addSizeConfig,
  getAvailableSuffixes,
  getSizeConfig,
  SIZE_CONFIGS
};