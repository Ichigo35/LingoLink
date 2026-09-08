import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { authService } from '@/services/auth';

export default function WelcomeScreen() {
  const t = useT();
  const [busy, setBusy] = useState<null | 'guest' | 'google'>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    // Google OAuth : natif uniquement (le flux web sur domaine séparé n'est pas
    // câblé — la version web est en mode invité).
    if (Platform.OS === 'web') return;
    authService
      .getServerConfig()
      .then((cfg) => setGoogleEnabled(cfg.googleEnabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  async function run(kind: 'guest' | 'google') {
    setBusy(kind);
    try {
      if (kind === 'guest') await authService.signInAsGuest();
      else await authService.signInWithGoogle();
    } catch (e) {
      Alert.alert('Connexion impossible', e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen center>
      <View style={styles.hero}>
        <ThemedText style={styles.logo}>Lingo Link</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.tagline}>
          {t('welcome.tagline')}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        {googleEnabled ? (
          <Button
            label={t('welcome.google')}
            icon="G"
            onPress={() => run('google')}
            loading={busy === 'google'}
            disabled={busy !== null}
          />
        ) : null}
        <Button
          label={t('welcome.guest')}
          variant={googleEnabled ? 'secondary' : 'primary'}
          onPress={() => run('guest')}
          loading={busy === 'guest'}
          disabled={busy !== null}
        />
        <ThemedText themeColor="textSecondary" style={styles.note}>
          {t('welcome.note')}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.six,
  },
  logo: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
  },
  tagline: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.three,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
