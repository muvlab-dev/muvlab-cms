// src/middlewares/image-enricher.js
const { parseImageMetadata } = require('../utils/image-processor');

module.exports = () => {
  return async (ctx, next) => {
    try {
      await next();
    } catch (e) {
      // Nie dotykaj błędów handlerów/ctrl — tylko je przekaż dalej
      throw e;
    }

    // Obsługujemy tylko success GET z payloadem API
    if (ctx.request.method !== 'GET') return;
    const body = ctx.response?.body;
    if (!body || !body.data) return;
    if (!String(ctx.request.url || '').startsWith('/api/')) return;

    try {
      enrich(body.data);
    } catch (err) {
      // pokaż pełny stack, żeby zobaczyć skąd to przyszło
      console.error('❌ Błąd w image-enricher middleware:', err && err.stack ? err.stack : err?.message || err);
      // nigdy nie blokujemy odpowiedzi
    }
  };
};

// ---- helpers ----

function enrich(node) {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) enrich(item);
    return;
  }

  // Strapi REST: { id, attributes } / GraphQL: bez attributes
  const container = node?.attributes || node;

  if (container && typeof container === 'object') {
    for (const key of Object.keys(container)) {
      const val = container[key];

      // pole media (pojedyncze)
      if (isImage(val)) {
        enrichImage(val);
        continue;
      }
      // pole media (relacja REST: { data: {...} } lub { data: [...] })
      if (isMediaRelation(val)) {
        if (Array.isArray(val.data)) val.data.forEach(enrichImage);
        else if (val.data) enrichImage(val.data);
        continue;
      }

      // rekurencja na zagnieżdżeniach
      if (val && typeof val === 'object') enrich(val);
    }
  }
}

function isImage(obj) {
  // typowy obiekt upload_file (GraphQL / zpopulowany REST)
  return obj && typeof obj === 'object' &&
    (typeof obj.url === 'string' || typeof obj.ext === 'string' || typeof obj.mime === 'string');
}

function isMediaRelation(obj) {
  // REST: { data: {...} } / { data: [...] }
  return obj && typeof obj === 'object' && 'data' in obj &&
    (Array.isArray(obj.data) || typeof obj.data === 'object');
}

function enrichImage(image) {
  try {
    // nie nadpisuj, jeśli już zrobione
    if (image.processedImages) return;

    const original = safeOriginal(image);
    const meta = parseImageMetadata(image); // próbuje JSON.parse(image.caption)

    image.processedImages = { original };

    if (meta && Array.isArray(meta.variants)) {
      for (const v of meta.variants) {
        if (!v || typeof v !== 'object') continue;
        if (typeof v.suffix !== 'string') continue;
        if (typeof v.url !== 'string' || !v.url) continue; // bez URL nie ma co dodawać
        image.processedImages[v.suffix] = {
          url: v.url,
          width: Number.isFinite(v.width) ? v.width : null,
          height: Number.isFinite(v.height) ? v.height : null,
          format: typeof v.format === 'string' ? v.format : 'unknown',
        };
      }
    }
  } catch (e) {
    // Nie przepuszczaj wyjątków dalej — tylko fallback
    console.error(`❌ Błąd wzbogacania obrazu ${image?.name || image?.url || '(brak nazwy)'}`, e && e.message ? e.message : e);
    if (!image.processedImages) image.processedImages = { original: safeOriginal(image) };
  }
}

function safeOriginal(image) {
  return {
    url: typeof image.url === 'string' ? image.url : null,
    width: Number.isFinite(image.width) ? image.width : null,
    height: Number.isFinite(image.height) ? image.height : null,
    format: typeof image.ext === 'string' && image.ext.startsWith('.') ? image.ext.slice(1) : 'unknown',
  };
}
