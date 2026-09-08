import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Screen } from '@/components/ui/screen';
import { DEFAULT_MY_LANGUAGE, type LanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { authService } from '@/services/auth';
import { authClient } from '@/lib/auth-client';

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const { isGuest } = useAuth();

  const [language, setLanguage] = useState<LanguageCode>(DEFAULT_MY_LANGUAGE);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    try {
      const trimmed = username.trim().toLowerCase();
      if (!isGuest && trimmed.length > 0) {
        const check = await authService.isUsernameAvailable(trimmed);
        if (!check.available) {
          Alert.alert(
            t('onboarding.usernameUnavailable'),
            check.reason === 'format'
              ? t('onboarding.usernameFormat')
              : t('onboarding.usernameTaken'),
          );
          return;
        }
      }
      await authService.updateProfile({
        preferredLanguage: language,
        ...(!isGuest && trimmed ? { username: trimmed } : {}),
      });
      await authClient.getSession({ query: { disableCookieCache: true } });
      router.replace('/');
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('onboarding.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <ThemedText style={styles.h1}>{t('onboarding.title')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('onboarding.subtitle')}</ThemedText>

      <View style={styles.block}>
        <LanguageSelector label={t('common.mainLanguage')} value={language} onChange={setLanguage} />
      </View>

      {!isGuest ? (
        <View style={styles.block}>
          <ThemedText themeColor="textSecondary" style={styles.label}>
            {t('onboarding.usernameLabel')}
          </ThemedText>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('onboarding.usernamePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          />
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            {t('onboarding.usernameHint')}
          </ThemedText>
        </View>
      ) : null}

      <Button label={t('onboarding.start')} onPress={finish} loading={saving} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, lineHeight: 33, fontWeight: '700' },
  block: { gap: Spacing.two, marginTop: Spacing.three },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  hint: { fontSize: 13 },
  cta: { marginTop: Spacing.five },
});
