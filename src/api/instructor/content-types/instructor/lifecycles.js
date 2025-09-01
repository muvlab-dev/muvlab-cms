const { processImage } = require('../../../../utils/image-helpers');

module.exports = {
  async afterCreate(event) {
    await processInstructorImages(event.result);
  },

  async afterUpdate(event) {
    await processInstructorImages(event.result);
  }
};

async function processInstructorImages(instructor) {
  try {
    if (instructor.avatar) {
      await processImage(instructor.avatar, {
        width: 500,
        height: 500,
        suffix: 'avatar-cropped',
        quality: 80,
        format: 'webp'
      });
    }

    if (instructor.picture) {
      await processImage(instructor.picture, {
        width: 840,
        height: 500,
        suffix: 'picture-cropped',
        quality: 80,
        format: 'webp'
      });
    }

  } catch (error) {
    console.error('Błąd przetwarzania obrazów instruktora:', error);
  }
}