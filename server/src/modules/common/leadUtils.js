const LEAD_STATUS_VALUES = ['NEW', 'QUALIFIED', 'CONTACTED', 'WON', 'LOST'];
const LEAD_SOURCE_VALUES = ['WIDGET', 'SDK_API', 'MANUAL'];

const MAX_EXTERNAL_ID = 128;
const MAX_EMAIL = 320;
const MAX_FULL_NAME = 150;
const MAX_PHONE = 64;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9()\-\s]{6,25}$/;

function createValidationError(code, message) {
  const err = new Error(message || code);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function validateLength(value, max, code) {
  if (value && value.length > max) {
    throw createValidationError(code);
  }
}

function sanitizeUserProfile(raw) {
  if (raw === undefined || raw === null) {
    return { data: {}, hasAny: false };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw createValidationError('errors.invalidUserProfile');
  }

  const visitorExternalId = cleanText(raw.externalId ?? raw.id ?? raw.userId);
  const visitorEmail = cleanText(raw.email)?.toLowerCase() || null;
  const visitorFullName = cleanText(raw.fullName ?? raw.name ?? raw.visitorName);
  const visitorPhone = cleanText(raw.phone);

  validateLength(visitorExternalId, MAX_EXTERNAL_ID, 'errors.invalidUserProfile');
  validateLength(visitorEmail, MAX_EMAIL, 'errors.invalidEmail');
  validateLength(visitorFullName, MAX_FULL_NAME, 'errors.invalidUserProfile');
  validateLength(visitorPhone, MAX_PHONE, 'errors.invalidPhone');

  if (visitorEmail && !EMAIL_REGEX.test(visitorEmail)) {
    throw createValidationError('errors.invalidEmail');
  }
  if (visitorPhone && !PHONE_REGEX.test(visitorPhone)) {
    throw createValidationError('errors.invalidPhone');
  }

  const data = {};
  if (visitorExternalId) data.visitor_external_id = visitorExternalId;
  if (visitorEmail) data.visitor_email = visitorEmail;
  if (visitorFullName) data.visitor_full_name = visitorFullName;
  if (visitorPhone) data.visitor_phone = visitorPhone;

  return { data, hasAny: Object.keys(data).length > 0 };
}

function normalizeLeadStatus(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (!LEAD_STATUS_VALUES.includes(normalized)) {
    throw createValidationError('errors.invalidLeadStatus');
  }
  return normalized;
}

function normalizeLeadSource(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (!LEAD_SOURCE_VALUES.includes(normalized)) {
    throw createValidationError('errors.invalidLeadSource');
  }
  return normalized;
}

function mapLeadFields(conversation) {
  return {
    externalId: conversation?.visitor_external_id || null,
    email: conversation?.visitor_email || null,
    fullName: conversation?.visitor_full_name || null,
    phone: conversation?.visitor_phone || null,
    status: conversation?.lead_status || 'NEW',
    source: conversation?.lead_source || 'WIDGET',
    lastContactAt: conversation?.lead_last_contact_at || null,
  };
}

module.exports = {
  LEAD_STATUS_VALUES,
  LEAD_SOURCE_VALUES,
  createValidationError,
  sanitizeUserProfile,
  normalizeLeadStatus,
  normalizeLeadSource,
  mapLeadFields,
};
