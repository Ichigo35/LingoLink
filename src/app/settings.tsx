import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES, UI_LANGUAGES } from '@/config/languages';
import { useT, type TranslationKey } from '@/i18n';
import {
  useSettingsStore,
  type ThemePreference,
  type UiLanguage,
} from '@/stores/settings-store';

const THEME_OPTIONS: { value: ThemePreference; labelKey: TranslationKey }[] = [
  { value: 'system', labelKey: 'settings.theme.system' },
  { value: 'light', labelKey: 'settings.theme.light' },
  { value: 'dark', labelKey: 'settings.theme.dark' },
];

const UI_LANGUAGE_OPTIONS: { value: UiLanguage; label: string }[] = UI_LANGUAGES.map((code) => ({
  value: code,
  label: `${LANGUAGES[code].flag} ${LANGUAGES[code].endonym}`,
}));

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const { themePreference, uiLanguage, setThemePreference, setUiLanguage } = useSettingsStore();

  return (
    <Screen scroll>
      <View style={styles.group}>
        <ThemedText style={styles.groupTitle}>{t('settings.appearance')}</ThemedText>
        <View style={styles.row}>
          {THEME_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              label={t(opt.labelKey)}
              variant={themePreference === opt.value ? 'primary' : 'secondary'}
              onPress={() => setThemePreference(opt.value)}
              style={styles.flex}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText style={styles.groupTitle}>{t('settings.uiLanguage')}</ThemedText>
        <View style={styles.langGrid}>
          {UI_LANGUAGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              label={opt.label}
              variant={uiLanguage === opt.value ? 'primary' : 'secondary'}
              onPress={() => setUiLanguage(opt.value)}
              style={styles.langButton}
            />
          ))}
        </View>
        <ThemedText themeColor="textSecondary" style={styles.note}>
          {t('settings.uiLanguageNote')}
        </ThemedText>
      </View>

      {__DEV__ ? (
        <View style={styles.group}>
          <ThemedText style={styles.groupTitle}>{t('settings.dev')}</ThemedText>
          <Button
            label={t('settings.aiTest')}
            variant="secondary"
            onPress={() => router.push('/ai-test')}
          />
        </View>
      ) : null}

      <View style={[styles.about, { borderColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={styles.note}>
          {t('settings.about')}
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
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  langButton: {
    flexGrow: 1,
    flexBasis: '30%',
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
