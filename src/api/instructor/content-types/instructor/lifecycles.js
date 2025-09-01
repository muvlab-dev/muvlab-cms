// 3. src/api/instructor/content-types/instructor/lifecycles.js
const { processImageWithMetadata } = require('../../../../utils/image-processor');

module.exports = {
  async afterCreate(event) {
    console.log('🔥 LIFECYCLE afterCreate - START dla:', event.result.name);
    await processInstructorImages(event.result);
    console.log('✅ LIFECYCLE afterCreate - END');
  },

  async afterUpdate(event) {
    console.log('🔥 LIFECYCLE afterUpdate - START dla:', event.result.name);
    await processInstructorImages(event.result);
    console.log('✅ LIFECYCLE afterUpdate - END');
  }
};

async function processInstructorImages(instructor) {
  try {
    console.log('🖼️ Przetwarzam obrazy dla instruktora:', instructor.name);

    if (instructor.avatar) {
      console.log('👤 Przetwarzam avatar...');
      await processImageWithMetadata(instructor.avatar, [
        { suffix: 'avatar', width: 500, height: 500, format: 'jpeg', quality: 85 }
      ], {
        context: 'instructor-avatar',
        usage: 'profile'
      });
      console.log('✅ Avatar przetworzony');
    }

    if (instructor.picture) {
      console.log('🖼️ Przetwarzam picture...');
      await processImageWithMetadata(instructor.picture, [
        { suffix: 'thumb', width: 200, height: 150, format: 'webp', quality: 75 },
        { suffix: 'card', width: 400, height: 300, format: 'webp', quality: 80 },
        { suffix: 'medium', width: 800, height: 600, format: 'jpeg', quality: 85 },
        { suffix: 'large', width: 1200, height: 900, format: 'jpeg', quality: 90 }
      ], {
        context: 'instructor-picture',
        usage: 'gallery'
      });
      console.log('✅ Picture przetworzone');
    }

  } catch (error) {
    console.error('❌ Błąd przetwarzania obrazów instruktora:', error);
  }
}