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

export type ThemePreference = 'system' | 'light' | 'dark';
export type UiLanguage = Extract<LanguageCode, 'fr' | 'en'>;

interface SettingsState {
  uiLanguage: UiLanguage;
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
      uiLanguage: 'fr',
      themePreference: 'system',
      lastMyLanguage: DEFAULT_MY_LANGUAGE,
      lastOtherLanguage: DEFAULT_OTHER_LANGUAGE,
      hydrated: false,

      setUiLanguage: (uiLanguage) => set({ uiLanguage }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setLastLanguages: (lastMyLanguage, lastOtherLanguage) =>
        set({ lastMyLanguage, lastOtherLanguage }),
    }),
    {
      name: 'lingolink.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ uiLanguage, themePreference, lastMyLanguage, lastOtherLanguage }) => ({
        uiLanguage,
        themePreference,
        lastMyLanguage,
        lastOtherLanguage,
      }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);
