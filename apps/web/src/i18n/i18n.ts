import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { LANGUAGES_CONFIG } from '@/i18n/languages.config';
import { SUPPORTED_LANGUAGES } from '@/i18n/supported-languages';

/**
 * Initialize i18n without env access to avoid triggering validation before React mounts.
 * Debug mode will be enabled in development by checking import.meta.env.DEV directly.
 */
await i18n
  .use(LanguageDetector) // detect browser language
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    // necessary because imported outside of error boundary so not possible to catch env validation errors
    debug: import.meta.env.DEV,
    interpolation: { escapeValue: false },
    load: 'languageOnly',
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    resources: Object.fromEntries(
      Object.entries(LANGUAGES_CONFIG).map(
        ([lang, config]) =>
          [lang, { translation: config.i18nTranslations }] as const,
      ),
    ),
  });

export { default } from 'i18next';
