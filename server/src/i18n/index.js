const messages = require('./messages');

const DEFAULT_LOCALE = 'tr';
const SUPPORTED = ['tr', 'en', 'de', 'ru', 'fr'];

function normalizeLocale(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_LOCALE;
  const short = raw.toLowerCase().slice(0, 2);
  return SUPPORTED.includes(short) ? short : DEFAULT_LOCALE;
}

function resolveLocaleFromRequest(request) {
  const explicit = request.headers['x-lang'];
  if (explicit) return normalizeLocale(String(explicit));

  const accept = request.headers['accept-language'];
  if (!accept) return DEFAULT_LOCALE;

  const first = String(accept).split(',')[0]?.trim();
  return normalizeLocale(first);
}

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, part) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return acc[part];
  }, obj);
}

function translate(locale, key) {
  const selected = messages[locale];
  const fallbackEn = messages.en;
  const fallbackTr = messages[DEFAULT_LOCALE];
  return resolvePath(selected, key) || resolvePath(fallbackEn, key) || resolvePath(fallbackTr, key) || key;
}

function attachI18n(fastify) {
  fastify.addHook('onRequest', async (request) => {
    const locale = resolveLocaleFromRequest(request);
    request.locale = locale;
    request.t = (key) => translate(locale, key);
  });
}

module.exports = {
  attachI18n,
  resolveLocaleFromRequest,
  translate,
};
