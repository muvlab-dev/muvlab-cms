const formats = require('../image-formats');
const { makeVariantFromDocumentId } = require('../services/custom-format.service');

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

async function processTopLevel(uid, data, conf, custom) {
  const top = conf.fields || {};
  for (const field of Object.keys(top)) {
    const docId = pickDocId(data[field]);
    if (!docId) continue;
    const v = await makeVariantFromDocumentId(docId, top[field]);
    custom[field] = Object.assign({}, custom[field] || {}, { webp: v });
  }
}

async function processComponentBranch(branch, input, store, makeVariant) {
  const { fields = {}, repeatable = false } = branch;
  if (!input) return;

  const handleOne = async (node) => {
    for (const field of Object.keys(fields)) {
      const docId = pickDocId(node[field]);
      if (!docId) continue;
      const v = await makeVariant(docId, fields[field]);
      store[field] = Object.assign({}, store[field] || {}, { webp: v });
    }
  };

  if (repeatable && Array.isArray(input)) {
    store.items = store.items || [];
    for (let i = 0; i < input.length; i++) {
      const dest = store.items[i] || {};
      await handleOne(input[i]);
      store.items[i] = dest;
    }
  } else if (typeof input === 'object') {
    await handleOne(input);
  }
}

async function processComponents(uid, data, conf, custom) {
  const comps = conf.components || {};
  for (const attrName of Object.keys(comps)) {
    const branch = comps[attrName];
    const node = data[attrName];
    custom[attrName] = custom[attrName] || {};
    await processComponentBranch(branch, node, custom[attrName], makeVariantFromDocumentId);
  }
}

function createLifecycle(uid) {
  return {
    async beforeCreate(event) {
      const data = event?.params?.data;
      if (!data) return;
      const conf = formats[uid] || {};
      const custom = data.customFormats || {};
      await processTopLevel(uid, data, conf, custom);
      await processComponents(uid, data, conf, custom);
      if (Object.keys(custom).length) data.customFormats = custom;
    },
    async beforeUpdate(event) {
      const data = event?.params?.data;
      if (!data) return;
      const conf = formats[uid] || {};
      const custom = data.customFormats || {};
      await processTopLevel(uid, data, conf, custom);
      await processComponents(uid, data, conf, custom);
      if (Object.keys(custom).length) data.customFormats = custom;
    },
  };
}

module.exports = createLifecycle;
