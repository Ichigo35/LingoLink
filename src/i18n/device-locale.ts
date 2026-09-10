/**
 * Détection de la langue d'interface initiale à partir de la locale de
 * l'appareil (§18). `expo-localization` `getLocales()` est synchrone et
 * fonctionne aussi sur le web (`navigator.language`).
 *
 * Sur le web, un paramètre d'URL `?hl=<code>` (ou `?lang=<code>`) est prioritaire :
 * la page de rebond `/join/<token>` du Worker le renseigne avec la langue qu'elle
 * a elle-même détectée (via l'en-tête `Accept-Language`), ce qui rattrape les cas
 * où `navigator.language` du navigateur mobile ne reflète pas la langue du
 * téléphone (navigateur intégré WhatsApp, Chrome configuré autrement, etc.).
 */

import { Platform } from 'react-native';

import { getLocales } from 'expo-localization';

import { UI_LANGUAGES, isLanguageCode, type LanguageCode } from '@/config/languages';

/** Langue d'UI passée en paramètre d'URL sur le web (`?hl=` ou `?lang=`), sinon `null`. */
export function uiLanguageFromUrl(): LanguageCode | null {
  if (Platform.OS !== 'web') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('hl') ?? params.get('lang') ?? '').toLowerCase().split('-')[0];
    if (raw && isLanguageCode(raw) && UI_LANGUAGES.includes(raw)) return raw;
  } catch {
    /* window indisponible */
  }
  return null;
}

/**
 * Renvoie la 1ʳᵉ langue préférée de l'appareil qui possède une traduction d'UI,
 * sinon `'en'`. Ex. `zh-Hans`, `zh-CN` → `zh` ; `fr-CA` → `fr`.
 * Le paramètre d'URL `?hl=` (web) est prioritaire.
 */
export function resolveInitialUiLanguage(): LanguageCode {
  const fromUrl = uiLanguageFromUrl();
  if (fromUrl) return fromUrl;
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
