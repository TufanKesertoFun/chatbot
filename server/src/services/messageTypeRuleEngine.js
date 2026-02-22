const GRATITUDE_PATTERNS = [
  /\btesekkur(ler| ederim|ler ederim)?\b/i,
  /\bsag ol(un)?\b/i,
  /\bthank(s| you)?\b/i,
  /\bdanke\b/i,
  /\bgracias\b/i,
  /\bmerci\b/i,
  /\b🙏+\b/u,
  /\b👍+\b/u,
];

const CONFIRMATION_PATTERNS = [
  /\btamam\b/i,
  /\bok(ey)?\b/i,
  /\banladim\b/i,
  /\banladım\b/i,
  /\bolur\b/i,
  /\byes\b/i,
  /\bevet\b/i,
  /^\s*[👍👌]\s*$/u,
];

const SMALL_TALK_PATTERNS = [
  /\bmerhaba\b/i,
  /\bselam\b/i,
  /\biyi gunler\b/i,
  /\biyi günler\b/i,
  /\bhello\b/i,
  /\bhi\b/i,
  /\bhola\b/i,
  /\bbonjour\b/i,
  /\bhallo\b/i,
];

const RESPONSE_TEMPLATES = {
  GRATITUDE: {
    tr: 'Rica ederim. Baska bir konuda yardimci olabilirim.',
    en: 'You are welcome. I can help with another topic as well.',
  },
  CONFIRMATION: {
    tr: 'Harika. Baska bir sorunuz olursa buradayim.',
    en: 'Great. I am here if you have another question.',
  },
  SMALL_TALK: {
    tr: 'Merhaba. Proje, fiyat, odeme plani veya lokasyonla ilgili sorularinizi yanitlayabilirim.',
    en: 'Hello. I can help with project, pricing, payment plan, and location questions.',
  },
  CLARIFICATION: {
    tr: 'Bu konuda daha net yardimci olabilmem icin talebinizi biraz daha detaylandirir misiniz?',
    en: 'Could you share a bit more detail so I can help you better?',
  },
};

function normalizeText(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s👍👌🙏]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function detectMessageType(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  if (GRATITUDE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'GRATITUDE';
  }
  if (CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'CONFIRMATION';
  }
  if (SMALL_TALK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'SMALL_TALK';
  }
  return null;
}

function buildTemplate(type, lang) {
  const safeLang = typeof lang === 'string' ? lang.toLowerCase() : 'en';
  const locale = safeLang.startsWith('tr') ? 'tr' : 'en';
  const template = RESPONSE_TEMPLATES[type];
  if (!template) return null;
  return template[locale] || template.en;
}

module.exports = {
  detectMessageType,
  buildTemplate,
  normalizeText,
  RESPONSE_TEMPLATES,
};

