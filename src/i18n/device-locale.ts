/**
 * Détection de la langue d'interface initiale à partir de la locale de
 * l'appareil (§18). `expo-localization` `getLocales()` est synchrone et
 * fonctionne aussi sur le web (`navigator.language`).
 */

import { getLocales } from 'expo-localization';

import { UI_LANGUAGES, isLanguageCode, type LanguageCode } from '@/config/languages';

/**
 * Renvoie la 1ʳᵉ langue préférée de l'appareil qui possède une traduction d'UI,
 * sinon `'en'`. Ex. `zh-Hans`, `zh-CN` → `zh` ; `fr-CA` → `fr`.
 */
export function resolveInitialUiLanguage(): LanguageCode {
  try {
    for (const loc of getLocales()) {
      const code = loc.languageCode?.toLowerCase();
      if (code && isLanguageCode(code) && UI_LANGUAGES.includes(code)) {
        return code;
      }
    }
  } catch {
    /* getLocales indisponible (environnement de test) → repli anglais */
  }
  return 'en';
}
