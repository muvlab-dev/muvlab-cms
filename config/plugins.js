module.exports = () => ({
  'drag-drop-content-types-strapi5': {
    enabled: true,
  },
  'webp-converter': {
    enabled: true,
    config: {
      mimeTypes: undefined,
      options: {
        quality: 100,
        // WebP options: https://sharp.pixelplumbing.com/api-output#webp
      },
    },
  },
});
