/** Langues supportées (miroir de src/config/languages.ts côté app). */
export const LANGUAGE_CODES = ['lo', 'fr', 'en', 'th', 'zh', 'ja', 'ko', 'hi'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value);
}
