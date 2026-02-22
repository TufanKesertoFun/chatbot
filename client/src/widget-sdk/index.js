import React from 'react';
import { createRoot } from 'react-dom/client';
import { OvoWidget } from './OvoWidget';
import { OvoWidgetClient } from './OvoWidgetClient';
import {
  createWidgetI18n,
  defaultWidgetTranslations,
  SUPPORTED_WIDGET_LOCALES,
  DEFAULT_WIDGET_LOCALE,
} from './i18n';

export {
  OvoWidget,
  OvoWidgetClient,
  createWidgetI18n,
  defaultWidgetTranslations,
  SUPPORTED_WIDGET_LOCALES,
  DEFAULT_WIDGET_LOCALE,
};

export function mountOvoWidget(container, options = {}) {
  const root = createRoot(container);
  root.render(React.createElement(React.StrictMode, null, React.createElement(OvoWidget, options)));

  return () => root.unmount();
}

// Backward compatibility aliases
export const VoraWidget = OvoWidget;
export const VoraWidgetClient = OvoWidgetClient;
export const mountVoraWidget = mountOvoWidget;
