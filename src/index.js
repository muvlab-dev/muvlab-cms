'use strict';
const bootstrap = require("./bootstrap");
const cfg = require('./config/custom-image-formats');
const { makeWebpVariantFromUploadDocumentId } = require('./services/image-format.service');

const APPLY_TO = Object.keys(cfg);

module.exports = {
  register({ strapi }) {
    strapi.documents.use(async (ctx, next) => {
      if (!APPLY_TO.includes(ctx.uid) || !['create', 'update'].includes(ctx.action)) return next();

      const data = (ctx.params && ctx.params.data) ? ctx.params.data : {};
      const perModel = (cfg[ctx.uid] && cfg[ctx.uid].fields) || {};
      const customFormats = data.customFormats || {};

      const pickDocId = (v) => {
        if (!v) return null;
        if (typeof v === 'string') return v;
        if (v.documentId) return v.documentId;
        if (v.connect && typeof v.connect[0] === 'string') return v.connect[0];
        if (v.connect && v.connect[0] && v.connect[0].documentId) return v.connect[0].documentId;
        if (v.set && typeof v.set[0] === 'string') return v.set[0];
        if (v.set && v.set[0] && v.set[0].documentId) return v.set[0].documentId;
        return null;
      };

      for (const [field, opts] of Object.entries(perModel)) {
        const mediaChange = data[field];
        const documentId = pickDocId(mediaChange);
        if (!documentId) continue;

        try {
          const variant = await makeWebpVariantFromUploadDocumentId(documentId, opts);
          customFormats[field] = { ...(customFormats[field] || {}), webp: variant };
        } catch (e) {
          console.error('[image] FAILED', { uid: ctx.uid, field, documentId, msg: e && e.message });
          throw e;
        }
      }

      if (Object.keys(customFormats).length) {
        ctx.params.data = { ...data, customFormats };
      }

      return next();
    });
  },
  bootstrap
};
