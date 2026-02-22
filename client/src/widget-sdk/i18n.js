const SUPPORTED_WIDGET_LOCALES = ['tr', 'en', 'de', 'ru', 'fr'];
const DEFAULT_WIDGET_LOCALE = 'en';

const defaultWidgetTranslations = {
  tr: {
    guestName: 'Misafir',
    greeting: {
      title: 'Merhaba',
      text: '{brand} platformuna hos geldiniz. Size nasil yardimci olabilirim?',
    },
    header: {
      title: '{brand} Concierge',
      subtitle: 'Dilinizde konusabiliriz',
    },
    status: {
      waitingAgent: 'Talebiniz canli destek ekibine aktarildi. Bir temsilci kisa surede yanit verecek.',
      agentLive: 'Canli temsilci baglandi. Mesajlariniz dogrudan temsilciye iletiliyor.',
      resolved: 'Bu konusma kapatildi.',
    },
    actions: {
      newChat: 'Yeni Sohbet',
    },
    labels: {
      translated: 'Cevrildi',
    },
    input: {
      placeholder: 'Mesaj yazin...',
      placeholderResolved: 'Yeni sohbet baslatarak devam edebilirsiniz.',
    },
  },
  en: {
    guestName: 'Guest',
    greeting: {
      title: 'Hello',
      text: 'Welcome to {brand}. How can I help you today?',
    },
    header: {
      title: '{brand} Concierge',
      subtitle: 'We speak your language',
    },
    status: {
      waitingAgent: 'Your request has been transferred to live support. An agent will reply shortly.',
      agentLive: 'A live agent is connected. Your messages are sent directly to the agent.',
      resolved: 'This conversation is closed.',
    },
    actions: {
      newChat: 'New Chat',
    },
    labels: {
      translated: 'Translated',
    },
    input: {
      placeholder: 'Type a message...',
      placeholderResolved: 'You can continue by starting a new chat.',
    },
  },
  de: {
    guestName: 'Gast',
    greeting: {
      title: 'Hallo',
      text: 'Willkommen bei {brand}. Wie kann ich Ihnen helfen?',
    },
    header: {
      title: '{brand} Concierge',
      subtitle: 'Wir sprechen Ihre Sprache',
    },
    status: {
      waitingAgent: 'Ihre Anfrage wurde an den Live-Support weitergeleitet. Ein Mitarbeiter antwortet in Kurze.',
      agentLive: 'Ein Live-Mitarbeiter ist verbunden. Ihre Nachrichten werden direkt ubermittelt.',
      resolved: 'Diese Unterhaltung wurde geschlossen.',
    },
    actions: {
      newChat: 'Neuer Chat',
    },
    labels: {
      translated: 'Ubersetzt',
    },
    input: {
      placeholder: 'Nachricht eingeben...',
      placeholderResolved: 'Sie konnen fortfahren, indem Sie einen neuen Chat starten.',
    },
  },
  ru: {
    guestName: 'Гость',
    greeting: {
      title: 'Здравствуйте',
      text: 'Добро пожаловать в {brand}. Чем я могу помочь?',
    },
    header: {
      title: '{brand} Concierge',
      subtitle: 'Мы говорим на вашем языке',
    },
    status: {
      waitingAgent: 'Ваш запрос передан в live-поддержку. Оператор ответит в ближайшее время.',
      agentLive: 'Оператор подключен. Сообщения отправляются напрямую оператору.',
      resolved: 'Этот диалог закрыт.',
    },
    actions: {
      newChat: 'Новый чат',
    },
    labels: {
      translated: 'Переведено',
    },
    input: {
      placeholder: 'Введите сообщение...',
      placeholderResolved: 'Чтобы продолжить, начните новый чат.',
    },
  },
  fr: {
    guestName: 'Invité',
    greeting: {
      title: 'Bonjour',
      text: 'Bienvenue sur {brand}. Comment puis-je vous aider ?',
    },
    header: {
      title: '{brand} Concierge',
      subtitle: 'Nous parlons votre langue',
    },
    status: {
      waitingAgent: 'Votre demande a ete transferee au support en direct. Un conseiller vous repondra bientot.',
      agentLive: 'Un conseiller est connecte. Vos messages sont envoyes directement au conseiller.',
      resolved: 'Cette conversation est fermee.',
    },
    actions: {
      newChat: 'Nouveau chat',
    },
    labels: {
      translated: 'Traduit',
    },
    input: {
      placeholder: 'Ecrire un message...',
      placeholderResolved: 'Vous pouvez continuer en demarrant une nouvelle conversation.',
    },
  },
};

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, extra) {
  if (!isObject(base)) return extra;
  const merged = { ...base };
  if (!isObject(extra)) return merged;
  for (const [key, value] of Object.entries(extra)) {
    if (isObject(value) && isObject(merged[key])) {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function resolvePath(source, path) {
  return path.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), source);
}

function interpolate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (params && Object.prototype.hasOwnProperty.call(params, key)) return String(params[key]);
    return `{${key}}`;
  });
}

export function normalizeWidgetLocale(rawLocale) {
  if (!rawLocale || typeof rawLocale !== 'string') return DEFAULT_WIDGET_LOCALE;
  const short = rawLocale.toLowerCase().slice(0, 2);
  return SUPPORTED_WIDGET_LOCALES.includes(short) ? short : DEFAULT_WIDGET_LOCALE;
}

export function createWidgetI18n({ locale, overrides } = {}) {
  const normalizedLocale = normalizeWidgetLocale(locale);
  const mergedByLocale = {};
  for (const lang of SUPPORTED_WIDGET_LOCALES) {
    mergedByLocale[lang] = deepMerge(defaultWidgetTranslations[lang], overrides?.[lang]);
  }

  const t = (key, params) => {
    const fromActive = resolvePath(mergedByLocale[normalizedLocale], key);
    const fromEn = resolvePath(mergedByLocale.en, key);
    const fromTr = resolvePath(mergedByLocale.tr, key);
    const value = fromActive ?? fromEn ?? fromTr ?? key;
    return interpolate(value, params);
  };

  return {
    locale: normalizedLocale,
    translations: mergedByLocale,
    t,
  };
}

export {
  DEFAULT_WIDGET_LOCALE,
  SUPPORTED_WIDGET_LOCALES,
  defaultWidgetTranslations,
};
