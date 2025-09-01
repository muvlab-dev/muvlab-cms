const { processImageWithMetadata } = require('../../../../utils/image-helpers');

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
    // Avatar - małe zdjęcie profilowe
    if (instructor.avatar) {
      await processImageWithMetadata(instructor.avatar, [
        { suffix: 'avatar', width: 500, height: 500, format: 'jpeg', quality: 85 },
        { suffix: 'profile-small', width: 150, height: 150, format: 'webp', quality: 80 }
      ], {
        context: 'instructor-avatar',
        usage: 'profile'
      });
    }

    // Picture - główne zdjęcie, potrzebne w różnych rozmiarach
    if (instructor.picture) {
      await processImageWithMetadata(instructor.picture, [
        { suffix: 'thumb', width: 200, height: 150, format: 'webp', quality: 75 },
        { suffix: 'card', width: 400, height: 300, format: 'webp', quality: 80 },
        { suffix: 'medium', width: 800, height: 600, format: 'jpeg', quality: 85 },
        { suffix: 'large', width: 1200, height: 900, format: 'jpeg', quality: 90 }
      ], {
        context: 'instructor-picture',
        usage: 'gallery'
      });
    }

  } catch (error) {
    console.error('Błąd przetwarzania obrazów instruktora:', error);
  }
}
