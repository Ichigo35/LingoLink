import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  useSettingsStore,
  type ThemePreference,
  type UiLanguage,
} from '@/stores/settings-store';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

const UI_LANGUAGE_OPTIONS: { value: UiLanguage; label: string }[] = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { themePreference, uiLanguage, setThemePreference, setUiLanguage } = useSettingsStore();

  return (
    <Screen scroll>
      <View style={styles.group}>
        <ThemedText style={styles.groupTitle}>Apparence</ThemedText>
        <View style={styles.row}>
          {THEME_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              label={opt.label}
              variant={themePreference === opt.value ? 'primary' : 'secondary'}
              onPress={() => setThemePreference(opt.value)}
              style={styles.flex}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText style={styles.groupTitle}>Langue de l’interface</ThemedText>
        <View style={styles.row}>
          {UI_LANGUAGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              label={opt.label}
              variant={uiLanguage === opt.value ? 'primary' : 'secondary'}
              onPress={() => setUiLanguage(opt.value)}
              style={styles.flex}
            />
          ))}
        </View>
        <ThemedText themeColor="textSecondary" style={styles.note}>
          La traduction complète de l’interface sera branchée avec le système i18n
          (Phase 10). Ce réglage est déjà persisté.
        </ThemedText>
      </View>

      <View style={[styles.about, { borderColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={styles.note}>
          Lingo Link — MVP en cours de développement. Base de données : Neon.
          Traduction : Gemini (via backend sécurisé).
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  about: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
});
