// 4. src/api/instructor/controllers/instructor.js (PROSTY - bez enrichment)
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::instructor.instructor', () => ({
  async find(ctx) {
    console.log('🎯 Instructor controller - find');
    const { data, meta } = await super.find(ctx);
    console.log('📊 Zwracam', data.length, 'instruktorów (middleware doda processedImages)');
    return { data, meta };
  },

  async findOne(ctx) {
    console.log('🎯 Instructor controller - findOne');
    const { data, meta } = await super.findOne(ctx);
    console.log('📊 Zwracam instruktora:', data?.name, '(middleware doda processedImages)');
    return { data, meta };
  }
}));