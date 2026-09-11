import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { formatLanguage } from '@/config/languages';
import { formatCountdown, secondsUntil } from '@/config/session';
import { Radius, Spacing } from '@/constants/theme';
import { useLiveSession } from '@/hooks/use-live-session';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import { useNewConversationStore } from '@/stores/new-conversation-store';
import type { ConversationSession } from '@/types';

export default function HostSessionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { myLanguage, otherLanguage, method } = useNewConversationStore();

  const [session, setSession] = useState<ConversationSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const creatingRef = useRef(false);

  // Suit la session en temps réel dès sa création (présence + statut).
  const live = useLiveSession(session?.id);
  const liveStatus = live.session?.status;

  const createSession = useCallback(async () => {
    if (!myLanguage || !otherLanguage) {
      router.replace('/new-conversation');
      return;
    }
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const created = await conversationsService.createSession({
        creatorLanguage: myLanguage,
        participantLanguage: otherLanguage,
        method: method ?? 'qr',
      });
      setError(null);
      setSession(created);
      setRemaining(secondsUntil(created.expiresAt));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : t('host.createFailed'));
    } finally {
      creatingRef.current = false;
    }
  }, [myLanguage, otherLanguage, method, router, t]);

  useEffect(() => {
    // Création de la session au montage de l'écran (action asynchrone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void createSession();
  }, [createSession]);

  // Un participant a rejoint -> on ouvre la conversation.
  useEffect(() => {
    if (session && liveStatus === 'active') {
      router.replace(`/conversation/${session.id}`);
    }
  }, [session, liveStatus, router]);

  // Compte à rebours local.
  useEffect(() => {
    if (remaining == null) return;
    const t = setInterval(() => setRemaining((r) => (r == null ? null : Math.max(0, r - 1))), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  async function cancel() {
    if (session) {
      try {
        await conversationsService.endSession(session.id);
      } catch {
        /* ignore */
      }
    }
    router.back();
  }

  async function shareLink() {
    if (!session) return;
    await Share.share({
      message: t('host.shareMessage', { url: session.joinUrl }),
    });
  }

  async function copyLink() {
    if (!session) return;
    await Clipboard.setStringAsync(session.joinUrl);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) {
    return (
      <Screen center>
        <ThemedText style={styles.title}>{t('host.createErrorTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {error}
        </ThemedText>
        <Button label={t('common.retry')} onPress={createSession} style={styles.cta} />
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen center>
        <ActivityIndicator color={theme.tint} />
      </Screen>
    );
  }

  const expired = session.status === 'expired' || remaining === 0;

  return (
    <Screen scroll>
      <ThemedText style={styles.title}>{t('host.waiting')}</ThemedText>
      {myLanguage && otherLanguage ? (
        <ThemedText themeColor="textSecondary">
          {formatLanguage(myLanguage)} ↔ {formatLanguage(otherLanguage)}
        </ThemedText>
      ) : null}

      <View style={[styles.qrCard, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
        {expired ? (
          <ThemedText style={{ color: '#0B0C0F' }}>{t('host.qrExpired')}</ThemedText>
        ) : (
          <QRCode
            value={session.joinUrl}
            size={220}
            backgroundColor="#FFFFFF"
            color="#0B0C0F"
          />
        )}
      </View>

      <ThemedText themeColor="textSecondary" style={styles.linkHint}>
        {t('host.linkHint')}
      </ThemedText>

      <ThemedText
        style={[
          styles.countdown,
          { color: expired ? theme.danger : theme.textSecondary },
        ]}>
        {expired
          ? t('host.sessionExpired')
          : t('host.expiresIn', { time: formatCountdown(remaining ?? 0) })}
      </ThemedText>

      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: theme.warning }]} />
        <ThemedText themeColor="textSecondary">
          {t('host.waitingForOther')}
        </ThemedText>
      </View>

      {expired ? (
        <Button label={t('host.newSession')} onPress={createSession} style={styles.cta} />
      ) : (
        <>
          <Button
            label={t('host.shareLink')}
            iconName="share-outline"
            onPress={shareLink}
            style={styles.cta}
          />
          <Button
            label={copied ? t('host.linkCopied') : t('host.copyLink')}
            variant={copied ? 'primary' : 'secondary'}
            iconName={copied ? 'checkmark-circle' : 'copy-outline'}
            onPress={copyLink}
          />
        </>
      )}
      <Button label={t('common.cancel')} variant="ghost" onPress={cancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  center: { textAlign: 'center' },
  qrCard: {
    alignSelf: 'center',
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    minWidth: 260,
  },
  linkHint: { textAlign: 'center', marginTop: Spacing.four, fontSize: 14 },
  countdown: { textAlign: 'center', marginTop: Spacing.two, fontSize: 15 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cta: { marginTop: Spacing.five },
});
