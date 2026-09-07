/**
 * Résout le thème effectif à partir de la préférence utilisateur
 * ('system' | 'light' | 'dark') et du schéma système.
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/stores/settings-store';

export type ResolvedScheme = 'light' | 'dark';

export function useResolvedScheme(): ResolvedScheme {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.themePreference);

  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useResolvedScheme()];
}
