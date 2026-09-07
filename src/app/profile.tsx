import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Screen } from '@/components/ui/screen';
import { formatLanguage, type LanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { authService } from '@/services/auth';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isGuest, preferredLanguage } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [language, setLanguage] = useState<LanguageCode | null>(preferredLanguage);
  const [saving, setSaving] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Hydratation du formulaire depuis les données serveur (session async).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!user) return;
    setName(user.name && user.name !== 'Anonymous' ? user.name : '');
    setUsername((user as { username?: string | null }).username ?? '');
    setLanguage((preferredLanguage as LanguageCode | null) ?? null);
  }, [user, preferredLanguage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    authService.getServerConfig().then((c) => setGoogleEnabled(c.googleEnabled)).catch(() => {});
  }, []);

  const dirty = useMemo(() => {
    const u = (user as { username?: string | null } | null)?.username ?? '';
    const n = user?.name && user.name !== 'Anonymous' ? user.name : '';
    return name.trim() !== n || username.trim() !== u || language !== preferredLanguage;
  }, [name, username, language, user, preferredLanguage]);

  async function save() {
    setSaving(true);
    try {
      const trimmedUsername = username.trim().toLowerCase();
      if (!isGuest && trimmedUsername) {
        const check = await authService.isUsernameAvailable(trimmedUsername);
        const currentUsername = (user as { username?: string | null } | null)?.username ?? '';
        if (!check.available && trimmedUsername !== currentUsername) {
          Alert.alert(
            'Nom d’utilisateur indisponible',
            check.reason === 'format'
              ? '3 à 20 caractères : minuscules, chiffres, tiret bas.'
              : 'Ce nom est déjà pris.',
          );
          return;
        }
      }
      await authService.updateProfile({
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(!isGuest && trimmedUsername ? { username: trimmedUsername } : {}),
        ...(language ? { preferredLanguage: language } : {}),
      });
      await authClient.getSession({ query: { disableCookieCache: true } });
      Alert.alert('Profil enregistré');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  }

  async function linkGoogle() {
    try {
      await authService.signInWithGoogle();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Connexion Google impossible');
    }
  }

  async function signOut() {
    await authService.signOut();
    router.replace('/welcome');
  }

  return (
    <Screen scroll>
      <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.badgeText}>
          {isGuest ? '👤 Compte invité' : `✅ Connecté${user?.email ? ` — ${user.email}` : ''}`}
        </ThemedText>
        {isGuest ? (
          <ThemedText themeColor="textSecondary" style={styles.badgeHint}>
            Vos données sont temporaires. Reliez un compte Google pour les conserver.
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.block}>
        <ThemedText themeColor="textSecondary" style={styles.label}>
          Nom affiché
        </ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Votre prénom"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, inputTheme(theme)]}
        />
      </View>

      {!isGuest ? (
        <View style={styles.block}>
          <ThemedText themeColor="textSecondary" style={styles.label}>
            Nom d’utilisateur
          </ThemedText>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="jimmy"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, inputTheme(theme)]}
          />
        </View>
      ) : null}

      <View style={styles.block}>
        <LanguageSelector label="Ma langue principale" value={language} onChange={setLanguage} />
        {language ? (
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Actuelle : {formatLanguage(language)}
          </ThemedText>
        ) : null}
      </View>

      <Button label="Enregistrer" onPress={save} loading={saving} disabled={!dirty} style={styles.cta} />

      {isGuest && googleEnabled ? (
        <Button label="Relier un compte Google" icon="G" variant="secondary" onPress={linkGoogle} />
      ) : null}

      <Button label="Se déconnecter" variant="ghost" onPress={signOut} style={styles.signOut} />
    </Screen>
  );
}

function inputTheme(theme: ReturnType<typeof useTheme>) {
  return {
    color: theme.text,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  };
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  badgeText: { fontSize: 15, fontWeight: '600' },
  badgeHint: { fontSize: 13, lineHeight: 18 },
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
  signOut: { marginTop: Spacing.two },
});
