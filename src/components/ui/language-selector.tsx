import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LANGUAGE_LIST, type LanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface LanguageSelectorProps {
  label: string;
  value: LanguageCode | null;
  onChange: (code: LanguageCode) => void;
  /** Langue à ne pas proposer (celle déjà choisie de l'autre côté). */
  exclude?: LanguageCode | null;
}

export function LanguageSelector({ label, value, onChange, exclude }: LanguageSelectorProps) {
  const theme = useTheme();

  return (
    <>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <View style={styles.row}>
        {LANGUAGE_LIST.filter((lang) => lang.code !== exclude).map((lang) => {
          const selected = lang.code === value;
          return (
            <Pressable
              key={lang.code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(lang.code)}
              style={[
                styles.pill,
                {
                  backgroundColor: selected ? theme.tint : theme.backgroundElement,
                  borderColor: selected ? theme.tint : theme.border,
                },
              ]}>
              <ThemedText
                style={[
                  styles.pillText,
                  { color: selected ? theme.tintText : theme.text },
                ]}>
                {lang.flag} {lang.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
