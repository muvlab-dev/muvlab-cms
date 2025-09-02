const formats = require('../../../../image-formats');
const { makeVariantFromDocumentId } = require('../../../../services/custom-format.service');

function pickDocId(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v.documentId) return v.documentId;
  if (v.connect && typeof v.connect[0] === 'string') return v.connect[0];
  if (v.connect && v.connect[0] && v.connect[0].documentId) return v.connect[0].documentId;
  if (v.set && typeof v.set[0] === 'string') return v.set[0];
  if (v.set && v.set[0] && v.set[0].documentId) return v.set[0].documentId;
  return null;
}

async function processData(uid, data) {
  const conf = formats[uid] || {};
  const custom = data.customFormats || {};
  for (const field of Object.keys(conf)) {
    const docId = pickDocId(data[field]);
    if (!docId) continue;
    const v = await makeVariantFromDocumentId(docId, conf[field]);
    custom[field] = Object.assign({}, custom[field] || {}, { webp: v });
  }
  if (Object.keys(custom).length) data.customFormats = custom;
}

module.exports = {
  async beforeCreate(event) {
    if (event && event.params && event.params.data) {
      await processData('api::instructor.instructor', event.params.data);
    }
  },
  async beforeUpdate(event) {
    if (event && event.params && event.params.data) {
      await processData('api::instructor.instructor', event.params.data);
    }
  }
};
