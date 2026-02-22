import React, { createContext, useContext, useMemo, useState } from 'react';
import { translations } from './translations';

const STORAGE_KEY = 'vora_admin_lang';
const DEFAULT_LANG = 'tr';
const SUPPORTED_LANGS = ['tr', 'en', 'de', 'ru', 'fr'];

function normalizeLang(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_LANG;
  const short = raw.toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(short) ? short : DEFAULT_LANG;
}

function resolveInitialLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeLang(stored);
  const browser = typeof navigator !== 'undefined' ? navigator.language : DEFAULT_LANG;
  return normalizeLang(browser);
}

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, segment) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return acc[segment];
  }, obj);
}

function applyParams(template, params) {
  if (!params) return template;
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) return String(params[key]);
    return `{${key}}`;
  });
}

const I18nContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(resolveInitialLang);

  const setLang = (nextLang) => {
    const normalized = normalizeLang(nextLang);
    setLangState(normalized);
    localStorage.setItem(STORAGE_KEY, normalized);
  };

  const value = useMemo(() => {
    const t = (key, params) => {
      const selected = translations[lang] || translations[DEFAULT_LANG];
      const fallbackEn = translations.en;
      const fallbackTr = translations[DEFAULT_LANG];
      const text = resolvePath(selected, key) ?? resolvePath(fallbackEn, key) ?? resolvePath(fallbackTr, key) ?? key;
      return applyParams(text, params);
    };

    return { lang, setLang, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function getStoredLanguage() {
  return normalizeLang(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG);
}
