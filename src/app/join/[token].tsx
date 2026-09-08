import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { formatLanguage, isLanguageCode } from '@/config/languages';
import { extractJoinToken, formatCountdown, secondsUntil } from '@/config/session';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import { usePendingJoinStore } from '@/stores/pending-join-store';
import { useSessionStore } from '@/stores/session-store';

interface Preview {
  creatorLanguage: string;
  participantLanguage: string;
  joinable: boolean;
  status: string;
  expiresAt: string | null;
}

export default function JoinScreen() {
  const params = useLocalSearchParams<{ token: string }>();
  const token = extractJoinToken(String(params.token ?? '')) ?? String(params.token ?? '');
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const setSession = useSessionStore((s) => s.setSession);
  const clearPending = usePendingJoinStore((s) => s.clear);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    clearPending();
    if (!token) return;
    let cancelled = false;
    conversationsService
      .lookupInvitation({ token })
      .then((p) => {
        if (cancelled) return;
        setPreview(p);
        setRemaining(secondsUntil(p.expiresAt));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof ApiRequestError && e.status === 404
              ? t('join.notExist')
              : t('join.cannotRead'),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, clearPending, t]);

  useEffect(() => {
    if (remaining == null) return;
    const t = setInterval(
      () => setRemaining((r) => (r == null ? null : Math.max(0, r - 1))),
      1000,
    );
    return () => clearInterval(t);
  }, [remaining]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const session = await conversationsService.joinByToken(token);
      setSession(session);
      router.replace(`/conversation/${session.id}`);
    } catch (e) {
      const msg =
        e instanceof ApiRequestError
          ? {
              expired: t('join.expired'),
              not_found: t('join.notExist'),
              not_joinable: t('join.notJoinable'),
              own_session: t('join.ownSession'),
            }[e.code] ?? e.message
          : t('join.cannotJoin');
      setError(msg);
      setJoining(false);
    }
  }

  const expired = preview?.status === 'expired' || remaining === 0;
  const shownError = !token ? t('join.invalidLink') : error;

  return (
    <Screen center>
      <ThemedText style={styles.logo}>Lingo Link</ThemedText>

      {shownError ? (
        <>
          <ThemedText style={styles.title}>{t('join.invitationUnavailable')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {shownError}
          </ThemedText>
          <Button label={t('common.home')} onPress={() => router.replace('/')} style={styles.cta} />
        </>
      ) : !preview ? (
        <ActivityIndicator color={theme.tint} style={{ marginTop: Spacing.four }} />
      ) : (
        <>
          <ThemedText style={styles.title}>{t('join.title')}</ThemedText>
          <View style={[styles.langCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText style={styles.langs}>
              {isLanguageCode(preview.creatorLanguage)
                ? formatLanguage(preview.creatorLanguage)
                : preview.creatorLanguage}
              {'  ↔  '}
              {isLanguageCode(preview.participantLanguage)
                ? formatLanguage(preview.participantLanguage)
                : preview.participantLanguage}
            </ThemedText>
          </View>
          {expired ? (
            <ThemedText style={[styles.center, { color: theme.danger }]}>
              {t('join.expired')}
            </ThemedText>
          ) : remaining != null ? (
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {t('join.expiresIn', { time: formatCountdown(remaining) })}
            </ThemedText>
          ) : null}

          <Button
            label={t('join.join')}
            onPress={join}
            loading={joining}
            disabled={expired || !preview.joinable}
            style={styles.cta}
          />
          <Button label={t('common.cancel')} variant="ghost" onPress={() => router.replace('/')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { fontSize: 26, fontWeight: '700', marginBottom: Spacing.four },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  center: { textAlign: 'center' },
  langCard: {
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  langs: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  cta: { marginTop: Spacing.five, alignSelf: 'stretch' },
});
