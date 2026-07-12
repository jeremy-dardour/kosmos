import enMessages from './locales/en.json';
import esMessages from './locales/es.json';
import frMessages from './locales/fr.json';

import type { SupportedLanguages } from '@/i18n/supported-languages';
import type { Translations } from '@/types/i18n';

interface LanguageConfig {
  i18nTranslations: Translations;
}

export const LANGUAGES_CONFIG: Record<SupportedLanguages, LanguageConfig> = {
  en: {
    i18nTranslations: enMessages,
  },
  fr: {
    i18nTranslations: frMessages,
  },
  es: {
    i18nTranslations: esMessages,
  },
};
