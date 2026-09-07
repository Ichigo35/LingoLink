import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { formatLanguage, isLanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiRequestError } from '@/lib/api-client';
import { type NearbyUser, nearbyService } from '@/services/nearby';

const POLL_MS = 8_000;
const REVISIBLE_MS = 90_000;

export default function NearbyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { needsOnboarding } = useAuth();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const visibleRef = useRef(false);

  const poll = useCallback(async () => {
    if (!coordsRef.current) return;
    try {
      setUsers(await nearbyService.getNearbyUsers(coordsRef.current));
    } catch {
      /* garde la liste */
    }
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Localisation requise', 'Autorisez la localisation pour être visible à proximité.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      coordsRef.current = coords;
      await nearbyService.enableDiscovery(coords);
      visibleRef.current = true;
      setVisible(true);
      poll();
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiRequestError ? e.message : 'Impossible de vous rendre visible');
    } finally {
      setBusy(false);
    }
  }

  const disable = useCallback(async () => {
    visibleRef.current = false;
    setVisible(false);
    setUsers([]);
    await nearbyService.disableDiscovery();
  }, []);

  // Polling + rafraîchissement de la visibilité tant que l'écran est ouvert.
  useEffect(() => {
    if (!visible) return;
    const p = setInterval(poll, POLL_MS);
    const v = setInterval(() => {
      if (coordsRef.current) nearbyService.enableDiscovery(coordsRef.current).catch(() => {});
    }, REVISIBLE_MS);
    return () => {
      clearInterval(p);
      clearInterval(v);
    };
  }, [visible, poll]);

  // Confidentialité : on quitte l'écran -> on n'est plus visible.
  useEffect(() => {
    return () => {
      if (visibleRef.current) nearbyService.disableDiscovery();
    };
  }, []);

  async function connect(u: NearbyUser) {
    setRequesting(u.profileId);
    try {
      const { sessionId } = await nearbyService.requestConversation(u.profileId);
      router.push(`/conversation/${sessionId}`);
    } catch (e) {
      const msg =
        e instanceof ApiRequestError
          ? {
              too_soon: 'Vous avez déjà envoyé une demande à cette personne.',
              not_visible: 'Cette personne n’est plus disponible.',
              same_language: 'Vous parlez la même langue.',
            }[e.code] ?? e.message
          : 'Demande impossible';
      Alert.alert('Impossible', msg);
    } finally {
      setRequesting(null);
    }
  }

  if (needsOnboarding) {
    return (
      <Screen center>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Choisissez d’abord votre langue dans le profil.
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText style={styles.cardTitle}>
          {visible ? '📍 Vous êtes visible' : 'Découverte de proximité'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.cardText}>
          {visible
            ? 'Les personnes tout près peuvent vous envoyer une demande de conversation. Vous redevenez invisible en quittant cet écran.'
            : 'Rendez-vous visible pour que des personnes physiquement proches puissent démarrer une conversation avec vous. Votre position exacte n’est jamais partagée.'}
        </ThemedText>
        {visible ? (
          <Button label="Me rendre invisible" variant="danger" onPress={disable} />
        ) : (
          <Button label="Me rendre visible à proximité" onPress={enable} loading={busy} />
        )}
      </View>

      {visible ? (
        users.length === 0 ? (
          <View style={styles.emptyRow}>
            <ActivityIndicator color={theme.tint} />
            <ThemedText themeColor="textSecondary">Recherche autour de vous…</ThemedText>
          </View>
        ) : (
          users.map((u) => (
            <Pressable key={u.profileId} style={[styles.row, { borderColor: theme.border }]}>
              <View style={styles.rowMain}>
                <ThemedText style={styles.name}>👤 {u.displayName}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sub}>
                  {u.language && isLanguageCode(u.language) ? formatLanguage(u.language) : '—'}
                  {'  ·  ~'}
                  {u.approxDistanceM} m
                </ThemedText>
              </View>
              <Button
                label="Se connecter"
                onPress={() => connect(u)}
                loading={requesting === u.profileId}
              />
            </Pressable>
          ))
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardText: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.two },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.five,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13 },
});
