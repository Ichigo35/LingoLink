import { useCallback } from 'react';

import { useSettingsStore } from '@/stores/settings-store';
import { TRANSLATIONS, type TranslationKey } from './translations';

export type { TranslationKey };

/** Hook de traduction : `const t = useT(); t('home.tagline')`. */
export function useT() {
  const lang = useSettingsStore((s) => s.uiLanguage);
  return useCallback(
    (key: TranslationKey): string => TRANSLATIONS[lang][key] ?? TRANSLATIONS.fr[key] ?? key,
    [lang],
  );
}

/** Version non-hook (hors composants). */
export function translate(key: TranslationKey): string {
  const lang = useSettingsStore.getState().uiLanguage;
  return TRANSLATIONS[lang][key] ?? TRANSLATIONS.fr[key] ?? key;
}
