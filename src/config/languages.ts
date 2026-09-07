/**
 * Configuration centralisée des langues (§18 du cahier des charges).
 *
 * Ajouter une langue = ajouter une entrée ici. Aucun composant ne doit
 * référencer une langue en dur ailleurs que via ce module.
 */

export type LanguageCode = 'lo' | 'fr' | 'en' | 'th' | 'zh';

export interface LanguageDefinition {
  /** Code ISO 639-1 (utilisé par la base de données et l'API IA). */
  code: LanguageCode;
  /** Nom affiché dans la langue de l'interface (français par défaut). */
  label: string;
  /** Nom endonyme (dans sa propre langue), utile pour l'onboarding. */
  endonym: string;
  /** Emoji drapeau pour l'affichage rapide. */
  flag: string;
  /** Sens d'écriture — réservé pour la mise en page future. */
  direction: 'ltr' | 'rtl';
}

export const LANGUAGES: Record<LanguageCode, LanguageDefinition> = {
  lo: { code: 'lo', label: 'Lao', endonym: 'ລາວ', flag: '🇱🇦', direction: 'ltr' },
  fr: { code: 'fr', label: 'Français', endonym: 'Français', flag: '🇫🇷', direction: 'ltr' },
  en: { code: 'en', label: 'Anglais', endonym: 'English', flag: '🇬🇧', direction: 'ltr' },
  th: { code: 'th', label: 'Thaï', endonym: 'ไทย', flag: '🇹🇭', direction: 'ltr' },
  zh: { code: 'zh', label: 'Chinois', endonym: '中文', flag: '🇨🇳', direction: 'ltr' },
};

export const LANGUAGE_LIST: LanguageDefinition[] = Object.values(LANGUAGES);

/** Langues proposées comme langue d'interface (sous-ensemble avec traduction UI). */
export const UI_LANGUAGES: LanguageCode[] = ['fr', 'en'];

export const DEFAULT_MY_LANGUAGE: LanguageCode = 'fr';
export const DEFAULT_OTHER_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(value: string): value is LanguageCode {
  return value in LANGUAGES;
}

export function getLanguage(code: LanguageCode): LanguageDefinition {
  return LANGUAGES[code];
}

/** Libellé compact "🇫🇷 Français" pour les pastilles et en-têtes. */
export function formatLanguage(code: LanguageCode): string {
  const lang = LANGUAGES[code];
  return `${lang.flag} ${lang.label}`;
}
