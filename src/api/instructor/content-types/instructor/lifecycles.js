// src/api/instructor/content-types/instructor/lifecycles.js
const { processImageWithMetadata } = require('../../../../utils/image-processor');

const FIELD_CONFIG = {
  avatar: [
    { suffix: 'avatar', width: 500, height: 500, format: 'jpeg', quality: 85 },
  ],
  picture: [
    { suffix: 'thumb',  width: 200,  height: 150,  format: 'webp', quality: 75 },
    { suffix: 'card',   width: 400,  height: 300,  format: 'webp', quality: 80 },
    { suffix: 'medium', width: 800,  height: 600,  format: 'jpeg', quality: 85 },
    { suffix: 'large',  width: 1200, height: 900,  format: 'jpeg', quality: 90 },
  ],
};

const EXTRA = {
  avatar:  { context: 'instructor-avatar',  usage: 'profile' },
  picture: { context: 'instructor-picture', usage: 'gallery' },
};

async function processFields(entity, fieldConfig, extra = {}) {
  const tasks = Object.entries(fieldConfig).map(async ([field, cfg]) => {
    const ref = entity?.[field];
    if (!ref) return;
    await processImageWithMetadata(ref, cfg, extra[field] || {});
  });
  await Promise.all(tasks);
}

module.exports = {
  async afterCreate(event) {
    await processFields(event.result, FIELD_CONFIG, EXTRA);
  },
  async afterUpdate(event) {
    await processFields(event.result, FIELD_CONFIG, EXTRA);
  },
};
