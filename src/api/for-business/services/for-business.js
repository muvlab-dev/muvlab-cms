'use strict';

/**
 * for-business service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::for-business.for-business');
