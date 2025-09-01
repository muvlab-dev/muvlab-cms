// src/utils/image-processor.js

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Przetwarza obraz do określonych wymiarów
 * @param {Object|String} imageRef - Referencja do obrazu (obiekt z documentId lub samo ID)
 * @param {Object} options - Opcje przetwarzania
 * @param {number} options.width - Szerokość docelowa
 * @param {number} options.height - Wysokość docelowa
 * @param {string} options.suffix - Sufiks dla nazwy pliku (np. 'avatar', 'thumb')
 * @param {number} options.quality - Jakość JPEG (1-100, domyślnie 85)
 * @param {string} options.format - Format wyjściowy ('jpeg', 'webp', 'png', domyślnie 'jpeg')
 * @param {string} options.fit - Sposób dopasowania ('cover', 'contain', 'fill', domyślnie 'cover')
 * @param {string} options.position - Pozycja przy przycinaniu (domyślnie 'center')
 * @param {boolean} options.withoutEnlargement - Nie powiększaj małych obrazów (domyślnie true)
 * @param {boolean} options.progressive - Progressive JPEG (domyślnie true)
 * @returns {Promise<Object|null>} - Informacje o przetworzoným obrazie lub null
 */
async function processImage(imageRef, options = {}) {
  try {
    // Domyślne opcje
    const defaultOptions = {
      quality: 85,
      format: 'jpeg',
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true,
      progressive: true
    };

    const config = { ...defaultOptions, ...options };

    // Sprawdź czy imageRef to obiekt czy ID
    const imageId = imageRef?.documentId || imageRef?.id || imageRef;

    if (!imageId) {
      console.log('Brak ID obrazu');
      return null;
    }

    // Pobierz informacje o pliku z Strapi
    const image = await strapi.documents('plugin::upload.file').findOne({
      documentId: imageId
    });

    if (!image) {
      console.log('Nie znaleziono pliku:', imageId);
      return null;
    }

    // Sprawdź czy to obraz
    if (!image.mime || !image.mime.startsWith('image/')) {
      console.log('Plik nie jest obrazem:', image.mime);
      return null;
    }

    const uploadsDir = path.join(strapi.dirs.static.public, 'uploads');
    const originalPath = path.join(uploadsDir, image.name);

    // Generuj nazwę przetworzonego pliku
    const extension = config.format === 'jpeg' ? 'jpg' : config.format;
    const processedFilename = `${config.suffix}_${config.width}x${config.height}_${path.parse(image.name).name}.${extension}`;
    const processedPath = path.join(uploadsDir, processedFilename);

    // Sprawdź czy oryginalny plik istnieje
    try {
      await fs.access(originalPath);
    } catch {
      console.log('Oryginalny plik nie istnieje:', originalPath);
      return null;
    }

    // Sprawdź czy przetworzony plik już istnieje
    try {
      await fs.access(processedPath);
      console.log('Przetworzony plik już istnieje:', processedPath);

      // Zwróć informacje o istniejącym pliku
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

    // Przetwórz obraz
    const sharpInstance = sharp(originalPath);

    // Pobierz metadata oryginalnego obrazu
    const metadata = await sharpInstance.metadata();
    console.log(`Przetwarzanie: ${image.name} (${metadata.width}x${metadata.height}) -> ${config.width}x${config.height}`);

    // Konfiguruj przetwarzanie według formatu
    let processedSharp = sharpInstance.resize(config.width, config.height, {
      fit: config.fit,
      position: config.position,
      withoutEnlargement: config.withoutEnlargement
    });

    // Wybierz format wyjściowy
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

    // Zwróć informacje o przetworzoným pliku
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
 * Przetwarza obraz do wielu rozmiarów jednocześnie
 * @param {Object|String} imageRef - Referencja do obrazu
 * @param {Array} sizesConfig - Tablica konfiguracji rozmiarów
 * @returns {Promise<Array>} - Tablica informacji o przetworzonych obrazach
 */
async function processImageMultipleSizes(imageRef, sizesConfig = []) {
  const results = [];

  for (const config of sizesConfig) {
    try {
      const result = await processImage(imageRef, config);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Błąd przetwarzania rozmiaru ${config.suffix}:`, error);
    }
  }

  return results;
}

/**
 * Generuje URL przetworzonego obrazu
 * @param {string} originalUrl - Oryginalny URL obrazu
 * @param {string} suffix - Sufiks
 * @param {number} width - Szerokość
 * @param {number} height - Wysokość
 * @param {string} format - Format (opcjonalnie, domyślnie 'jpg')
 * @returns {string|null} - URL przetworzonego obrazu
 */
function getProcessedImageUrl(originalUrl, suffix, width, height, format = 'jpg') {
  if (!originalUrl) return null;

  const urlParts = originalUrl.split('/');
  const filename = urlParts.pop();
  const nameWithoutExt = path.parse(filename).name;
  const extension = format === 'jpeg' ? 'jpg' : format;

  const processedFilename = `${suffix}_${width}x${height}_${nameWithoutExt}.${extension}`;

  return [...urlParts, processedFilename].join('/');
}

/**
 * Usuwa przetworzone obrazy dla danego oryginalnego obrazu
 * @param {string} originalImageName - Nazwa oryginalnego pliku
 * @returns {Promise<void>}
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
  cleanupProcessedImages
};