'use strict';

/**
 * class-type router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::class-type.class-type');
