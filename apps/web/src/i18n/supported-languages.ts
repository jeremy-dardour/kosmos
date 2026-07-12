export const SUPPORTED_LANGUAGES = ['en', 'fr', 'es'] as const;
export type SupportedLanguages = (typeof SUPPORTED_LANGUAGES)[number];
