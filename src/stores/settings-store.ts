/**
 * Préférences utilisateur persistées localement (langue d'interface, thème,
 * dernières langues choisies pour aller plus vite). Zustand + AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_MY_LANGUAGE,
  DEFAULT_OTHER_LANGUAGE,
  type LanguageCode,
} from '@/config/languages';
import { resolveInitialUiLanguage } from '@/i18n/device-locale';

export type ThemePreference = 'system' | 'light' | 'dark';
/** Toute langue disposant d'un bloc de traduction UI (cf. UI_LANGUAGES). */
export type UiLanguage = LanguageCode;

interface SettingsState {
  uiLanguage: UiLanguage;
  /** `true` dès que l'utilisateur a choisi une langue à la main (Réglages). */
  uiLanguageExplicit: boolean;
  themePreference: ThemePreference;
  /** Mémorise le dernier couple de langues pour pré-remplir "Nouvelle conversation". */
  lastMyLanguage: LanguageCode;
  lastOtherLanguage: LanguageCode;
  hydrated: boolean;

  setUiLanguage: (code: UiLanguage) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setLastLanguages: (my: LanguageCode, other: LanguageCode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      uiLanguage: resolveInitialUiLanguage(),
      uiLanguageExplicit: false,
      themePreference: 'system',
      lastMyLanguage: DEFAULT_MY_LANGUAGE,
      lastOtherLanguage: DEFAULT_OTHER_LANGUAGE,
      hydrated: false,

      setUiLanguage: (uiLanguage) => set({ uiLanguage, uiLanguageExplicit: true }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setLastLanguages: (lastMyLanguage, lastOtherLanguage) =>
        set({ lastMyLanguage, lastOtherLanguage }),
    }),
    {
      name: 'lingolink.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({
        uiLanguage,
        uiLanguageExplicit,
        themePreference,
        lastMyLanguage,
        lastOtherLanguage,
      }) => ({
        uiLanguage,
        uiLanguageExplicit,
        themePreference,
        lastMyLanguage,
        lastOtherLanguage,
      }),
      onRehydrateStorage: () => (state) => {
        // Tant que l'utilisateur n'a pas choisi explicitement, la langue d'UI
        // suit la locale de l'appareil (utile si elle a changé entre deux lancements).
        if (state && !state.uiLanguageExplicit) {
          state.uiLanguage = resolveInitialUiLanguage();
        }
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);
