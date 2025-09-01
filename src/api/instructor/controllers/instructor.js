'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { getProcessedImageUrl } = require('../../../utils/image-helpers');

function enrichInstructor(instructor) {
  if (!instructor) return instructor;

  return {
    ...instructor,
    processedImages: {
      avatar: instructor.avatar ? {
        original: instructor.avatar.url,
        processed: getProcessedImageUrl(instructor.avatar.url, 'instructor-avatar')
      } : null,
      picture: instructor.picture ? {
        original: instructor.picture.url,
        processed: getProcessedImageUrl(instructor.picture.url, 'instructor-picture')
      } : null
    }
  };
}

module.exports = createCoreController('api::instructor.instructor', () => ({
  async find(ctx) {
    const { data, meta } = await super.find(ctx);
    const enrichedData = data.map(enrichInstructor);
    return { data: enrichedData, meta };
  },

  async findOne(ctx) {
    const { data, meta } = await super.findOne(ctx);
    const enrichedData = enrichInstructor(data);
    return { data: enrichedData, meta };
  }
}));