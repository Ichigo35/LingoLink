import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { formatLanguage, isLanguageCode, type LanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAudioCapture } from '@/features/conversation/use-audio-capture';
import { useAuth } from '@/hooks/use-auth';
import { useLiveSession } from '@/hooks/use-live-session';
import { useTheme } from '@/hooks/use-theme';
import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import type { ConversationMessage } from '@/types';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { session, loading, error, connected, peerOnline, messages } = useLiveSession(id, user?.id);
  const capture = useAudioCapture();

  const [pending, setPending] = useState<ConversationMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const isCreator = !!session && user?.id === session.creatorId;
  const myLang = session ? (isCreator ? session.creatorLanguage : session.participantLanguage) : null;
  const otherLang = session
    ? isCreator
      ? session.participantLanguage
      : session.creatorLanguage
    : null;
  const ended = session?.status === 'ended' || session?.status === 'expired';
  const active = session?.status === 'active';

  const allMessages = useMemo(() => {
    const merged = [
      ...messages,
      ...pending.filter((p) => !messages.some((m) => m.clientId && m.clientId === p.clientId)),
    ];
    return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, pending]);

  const onRecordStart = useCallback(async () => {
    setMicError(null);
    const ok = await capture.start();
    if (!ok) setMicError('Micro non autorisé. Activez-le dans les réglages.');
  }, [capture]);

  const onRecordStop = useCallback(async () => {
    const segment = await capture.stop();
    if (!segment || !id || !session || !myLang || !otherLang) return;
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ConversationMessage = {
      id: `pending-${clientId}`,
      sessionId: id,
      senderId: user?.id ?? '',
      sourceLanguage: myLang as LanguageCode,
      targetLanguage: otherLang as LanguageCode,
      originalTranscript: '',
      translatedText: '',
      status: 'processing',
      clientId,
      createdAt: new Date().toISOString(),
    };
    setPending((p) => [...p, optimistic]);
    setSending(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      await conversationsService.sendVoiceMessage(id, segment.uri, clientId);
    } catch (e) {
      setPending((p) =>
        p.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)),
      );
      setMicError(e instanceof ApiRequestError ? e.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  }, [capture, id, session, myLang, otherLang, user?.id]);

  async function leave() {
    try {
      if (isCreator) await conversationsService.endSession(id!);
      else await conversationsService.leaveSession(id!);
    } catch {
      /* ignore */
    }
    router.replace('/');
  }

  function confirmLeave() {
    Alert.alert(
      isCreator ? 'Terminer la conversation ?' : 'Quitter la conversation ?',
      isCreator ? 'La session sera fermée pour les deux.' : 'Vous pourrez en rejoindre une autre.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: isCreator ? 'Terminer' : 'Quitter', style: 'destructive', onPress: leave },
      ],
    );
  }

  if (loading && !session) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.h1}>Conversation introuvable</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          {error ?? 'Cette conversation n’existe plus.'}
        </ThemedText>
        <Button label="Accueil" onPress={() => router.replace('/')} style={{ marginTop: Spacing.four }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.background }]} edges={['bottom']}>
      {/* Barre d'état */}
      <View style={[styles.topbar, { borderColor: theme.border }]}>
        <View style={styles.topbarLeft}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: ended
                  ? theme.danger
                  : peerOnline
                    ? theme.positive
                    : theme.warning,
              },
            ]}
          />
          <ThemedText style={styles.topbarText}>
            {ended
              ? 'Terminée'
              : peerOnline
                ? 'En ligne'
                : active
                  ? 'En attente…'
                  : 'Connexion…'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.rtBadge}>
            {connected ? '● direct' : '○ hors ligne'}
          </ThemedText>
        </View>
        <Pressable onPress={confirmLeave} hitSlop={10}>
          <ThemedText style={[styles.leave, { color: theme.danger }]}>
            {isCreator ? 'Terminer' : 'Quitter'}
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {allMessages.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {myLang && otherLang
              ? `${formatLanguage(myLang as LanguageCode)} ↔ ${formatLanguage(otherLang as LanguageCode)}\n\nMaintenez le bouton et parlez.`
              : 'Maintenez le bouton et parlez.'}
          </ThemedText>
        ) : (
          allMessages.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.senderId === user?.id} />
          ))
        )}
      </ScrollView>

      {micError ? (
        <ThemedText style={[styles.micError, { color: theme.danger }]}>{micError}</ThemedText>
      ) : null}

      {/* Bouton micro */}
      <View style={styles.micZone}>
        {ended ? (
          <Button label="Retour à l’accueil" onPress={() => router.replace('/')} />
        ) : (
          <Pressable
            onPressIn={onRecordStart}
            onPressOut={onRecordStop}
            disabled={sending || !active}
            style={[
              styles.mic,
              {
                backgroundColor: capture.isRecording ? theme.danger : theme.tint,
                opacity: sending || !active ? 0.5 : 1,
              },
            ]}>
            {sending ? (
              <View style={styles.micRow}>
                <ActivityIndicator color={theme.tintText} />
                <ThemedText style={[styles.micLabel, { color: theme.tintText }]}>
                  Traduction…
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={[styles.micLabel, { color: theme.tintText }]}>
                {capture.isRecording ? '● Relâchez pour envoyer' : '🎤 Maintenir pour parler'}
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function MessageBubble({ message, mine }: { message: ConversationMessage; mine: boolean }) {
  const theme = useTheme();
  const processing = message.status === 'processing';
  const failed = message.status === 'failed';
  const src = isLanguageCode(message.sourceLanguage)
    ? formatLanguage(message.sourceLanguage)
    : message.sourceLanguage;

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRight : styles.bubbleLeft]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: mine ? theme.tint : theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}>
        <ThemedText
          style={[styles.bubbleMeta, { color: mine ? theme.tintText : theme.textSecondary }]}>
          {mine ? `Vous · ${src}` : src}
        </ThemedText>

        {failed ? (
          <ThemedText style={{ color: mine ? theme.tintText : theme.danger }}>
            Échec de la traduction
          </ThemedText>
        ) : processing && !message.originalTranscript ? (
          <View style={styles.micRow}>
            <ActivityIndicator size="small" color={mine ? theme.tintText : theme.text} />
            <ThemedText style={{ color: mine ? theme.tintText : theme.textSecondary }}>
              Écoute…
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText
              style={[styles.original, { color: mine ? theme.tintText : theme.text }]}>
              {message.originalTranscript || '…'}
            </ThemedText>
            {message.translatedText ? (
              <ThemedText
                style={[
                  styles.translated,
                  { color: mine ? theme.tintText : theme.text, opacity: mine ? 0.85 : 1 },
                ]}>
                {message.translatedText}
              </ThemedText>
            ) : message.status !== 'completed' ? (
              <ThemedText
                style={[styles.translating, { color: mine ? theme.tintText : theme.textSecondary }]}>
                traduction…
              </ThemedText>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  centerText: { textAlign: 'center' },
  h1: { fontSize: 22, fontWeight: '700' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  topbarText: { fontSize: 15, fontWeight: '600' },
  rtBadge: { fontSize: 11 },
  leave: { fontSize: 15, fontWeight: '600' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  messages: { padding: Spacing.three, gap: Spacing.three, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.six, fontSize: 15, lineHeight: 22 },
  bubbleRow: { flexDirection: 'row' },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  bubbleMeta: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  original: { fontSize: 17, lineHeight: 23 },
  translated: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  translating: { fontSize: 13, fontStyle: 'italic' },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  micError: { textAlign: 'center', fontSize: 13, paddingHorizontal: Spacing.three },
  micZone: { padding: Spacing.three },
  mic: {
    minHeight: 72,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLabel: { fontSize: 17, fontWeight: '700' },
});
