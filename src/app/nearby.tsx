import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { formatLanguage, isLanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useConversationGuard } from '@/features/conversation/conversation-guard';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiRequestError } from '@/lib/api-client';
import { type NearbyUser, nearbyService } from '@/services/nearby';

const POLL_MS = 8_000;
const REVISIBLE_MS = 90_000;

export default function NearbyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const t = useT();
  const { needsOnboarding } = useAuth();
  const guard = useConversationGuard();

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
        Alert.alert(t('nearby.locationRequired'), t('nearby.locationRequiredText'));
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
      Alert.alert(t('common.error'), e instanceof ApiRequestError ? e.message : t('nearby.visibleError'));
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

  function connect(u: NearbyUser) {
    guard(() => void runConnect(u));
  }

  async function runConnect(u: NearbyUser) {
    setRequesting(u.profileId);
    try {
      const { sessionId } = await nearbyService.requestConversation(u.profileId);
      router.push(`/conversation/${sessionId}`);
    } catch (e) {
      const msg =
        e instanceof ApiRequestError
          ? {
              too_soon: t('nearby.tooSoon'),
              not_visible: t('nearby.notVisible'),
              same_language: t('nearby.sameLanguage'),
            }[e.code] ?? e.message
          : t('nearby.requestFailed');
      Alert.alert(t('nearby.cannotConnect'), msg);
    } finally {
      setRequesting(null);
    }
  }

  if (needsOnboarding) {
    return (
      <Screen center>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {t('nearby.onboardingFirst')}
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText style={styles.cardTitle}>
          {visible ? t('nearby.visibleTitle') : t('nearby.discoveryTitle')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.cardText}>
          {visible ? t('nearby.visibleText') : t('nearby.discoveryText')}
        </ThemedText>
        {visible ? (
          <Button label={t('nearby.goInvisible')} variant="danger" onPress={disable} />
        ) : (
          <Button label={t('nearby.goVisible')} onPress={enable} loading={busy} />
        )}
      </View>

      {visible ? (
        users.length === 0 ? (
          <View style={styles.emptyRow}>
            <ActivityIndicator color={theme.tint} />
            <ThemedText themeColor="textSecondary">{t('nearby.searching')}</ThemedText>
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
                label={t('nearby.connect')}
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
