import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LANGUAGES, UI_LANGUAGES } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSettingsStore } from '@/stores/settings-store';

/**
 * Sélecteur compact de langue d'interface (drapeau + endonyme), à placer sur les
 * écrans d'entrée (accueil invité, rejoindre). Indispensable sur le web : la
 * détection automatique de langue n'est pas fiable sur tous les navigateurs
 * mobiles, l'utilisateur doit pouvoir corriger l'affichage sans passer par les
 * Réglages (inaccessibles en mode invité web).
 */
export function UiLanguageBar() {
  const theme = useTheme();
  const t = useT();
  const uiLanguage = useSettingsStore((s) => s.uiLanguage);
  const setUiLanguage = useSettingsStore((s) => s.setUiLanguage);

  return (
    <View style={styles.wrap}>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {t('settings.uiLanguage')}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {UI_LANGUAGES.map((code) => {
          const lang = LANGUAGES[code];
          const selected = code === uiLanguage;
          return (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setUiLanguage(code)}
              style={[
                styles.pill,
                {
                  backgroundColor: selected ? theme.tint : theme.backgroundElement,
                  borderColor: selected ? theme.tint : theme.border,
                },
              ]}>
              <ThemedText
                style={[styles.pillText, { color: selected ? theme.tintText : theme.text }]}>
                {lang.flag} {lang.endonym}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one, alignSelf: 'stretch' },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  row: { gap: Spacing.two, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { fontSize: 14, fontWeight: '500' },
});
