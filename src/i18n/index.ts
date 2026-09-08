import { useCallback } from 'react';

import { useSettingsStore } from '@/stores/settings-store';
import { TRANSLATIONS, type TranslationKey } from './translations';

export type { TranslationKey };

type Params = Record<string, string | number>;

/** Remplace les `{placeholders}` d'une chaîne par les valeurs fournies. */
function interpolate(str: string, params?: Params): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

/** Hook de traduction : `const t = useT(); t('home.tagline')` ; `t('host.expiresIn', { time })`. */
export function useT() {
  const lang = useSettingsStore((s) => s.uiLanguage);
  return useCallback(
    (key: TranslationKey, params?: Params): string =>
      interpolate(TRANSLATIONS[lang][key] ?? TRANSLATIONS.fr[key] ?? key, params),
    [lang],
  );
}

/** Version non-hook (hors composants). */
export function translate(key: TranslationKey, params?: Params): string {
  const lang = useSettingsStore.getState().uiLanguage;
  return interpolate(TRANSLATIONS[lang][key] ?? TRANSLATIONS.fr[key] ?? key, params);
}
