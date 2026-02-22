const PII_PATTERNS = [
  { key: 'EMAIL', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { key: 'PHONE', regex: /(\+?\d{1,3}[\s-]?)?(\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{2}[\s-]?\d{2}/gi },
  { key: 'TC_ID', regex: /\b[1-9]\d{10}\b/g },
  { key: 'IBAN', regex: /\bTR\d{24}\b/gi }
];

const maskPII = (text) => {
  if (!text || typeof text !== 'string') return { masked: text, hits: [] };

  let masked = text;
  const hits = [];

  PII_PATTERNS.forEach(({ key, regex }) => {
    masked = masked.replace(regex, (match) => {
      hits.push({ type: key, value: match });
      return `<${key}>`;
    });
  });

  return { masked, hits };
};

module.exports = { maskPII };
