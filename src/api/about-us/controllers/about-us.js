'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::about-us.about-us', ({ strapi }) => ({
  async find(ctx) {
    console.log('🔍 About-us controller - find');
    const { data, meta } = await super.find(ctx);
    console.log('✅ About-us controller - data pobrane');
    return { data, meta };
  },

  async findOne(ctx) {
    console.log('🔍 About-us controller - findOne');
    const { data, meta } = await super.findOne(ctx);
    console.log('✅ About-us controller - data pobrane');
    return { data, meta };
  }
}));