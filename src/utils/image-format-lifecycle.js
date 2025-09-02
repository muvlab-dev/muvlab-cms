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

async function processComponentBranch(branch, input, outStore, makeVariant) {
  const { fields = {}, repeatable = false } = branch;
  if (!input) return;

  const handleInto = async (target, node) => {
    let wrote = false;
    for (const field of Object.keys(fields)) {
      const docId = pickDocId(node[field]);
      if (!docId) continue;
      const v = await makeVariant(docId, fields[field]);
      target[field] = Object.assign({}, target[field] || {}, { webp: v });
      wrote = true;
    }
    return wrote;
  };

  if (repeatable && Array.isArray(input)) {
    const items = [];
    for (let i = 0; i < input.length; i++) {
      const tmp = {};
      const wrote = await handleInto(tmp, input[i]);
      items[i] = wrote ? tmp : null;
    }
    const hasAny = items.some(Boolean);
    if (hasAny) outStore.items = items;
  } else if (typeof input === 'object') {
    await handleInto(outStore, input);
  }
}


async function processComponents(uid, data, conf, custom) {
  const comps = conf.components || {};
  for (const attrName of Object.keys(comps)) {
    const branch = comps[attrName];
    const node = data[attrName];
    if (!node) continue; // brak komponentu w payloadzie → nic nie twórz

    const tmpStore = {};
    await processComponentBranch(branch, node, tmpStore, makeVariantFromDocumentId);

    // dopisz tylko, jeśli faktycznie coś powstało
    if (Object.keys(tmpStore).length || (tmpStore.items && tmpStore.items.some(Boolean))) {
      custom[attrName] = Object.assign({}, custom[attrName] || {}, tmpStore);
    }
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
