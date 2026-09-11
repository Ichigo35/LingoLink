import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LanguageSelector } from '@/components/ui/language-selector';
import { formatLanguage, isLanguageCode, type LanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAudioCapture } from '@/features/conversation/use-audio-capture';
import { useAuth } from '@/hooks/use-auth';
import { useLiveSession } from '@/hooks/use-live-session';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { ConversationMessage } from '@/types';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const t = useT();
  const { session, loading, error, connected, peerOnline, messages } = useLiveSession(id, user?.id);
  const capture = useAudioCapture();

  const [pending, setPending] = useState<ConversationMessage[]>([]);
  const [inFlight, setInFlight] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  /** Enregistrement en cours (appui unique : 1er tap démarre, 2e tap termine). */
  const [recording, setRecording] = useState(false);
  const micBusyRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  /** true dès que l'utilisateur local déclenche lui-même la sortie. */
  const [leaving, setLeaving] = useState(false);
  /** Confirmation « Quitter / Terminer » ouverte. */
  const [leaveOpen, setLeaveOpen] = useState(false);
  /** L'utilisateur a choisi de rester après le départ de l'autre. */
  const [peerLeftDismissed, setPeerLeftDismissed] = useState(false);
  /** Sélecteur « changer ma langue » ouvert. */
  const [langOpen, setLangOpen] = useState(false);
  const [langBusy, setLangBusy] = useState(false);
  const [langError, setLangError] = useState<string | null>(null);

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

  /** Envoie un segment audio (coupé automatiquement ou à la fin) + bulle optimiste. */
  const sendSegment = useCallback(
    async (segment: { uri: string }) => {
      if (!id || !session || !myLang || !otherLang) return;
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
      setInFlight((n) => n + 1);
      Haptics.selectionAsync().catch(() => {});
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      try {
        await conversationsService.sendVoiceMessage(id, segment.uri, clientId);
      } catch (e) {
        setPending((p) => p.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)));
        setMicError(e instanceof ApiRequestError ? e.message : t('conv.sendFailed'));
      } finally {
        setInFlight((n) => Math.max(0, n - 1));
      }
    },
    [id, session, myLang, otherLang, user?.id, t],
  );

  const toggleRecord = useCallback(async () => {
    if (micBusyRef.current) return;
    micBusyRef.current = true;
    try {
      if (recording) {
        setRecording(false);
        const segment = await capture.stop();
        if (segment) void sendSegment(segment);
      } else {
        setMicError(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const ok = await capture.start();
        if (ok) setRecording(true);
        else setMicError(t('conv.micNotAllowed'));
      }
    } finally {
      micBusyRef.current = false;
    }
  }, [recording, capture, sendSegment, t]);

  // Coupe proprement l'enregistrement si l'écran est quitté pendant la parole.
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  });
  useEffect(() => () => void captureRef.current.cancel(), []);

  async function leave() {
    setLeaving(true);
    try {
      if (isCreator) await conversationsService.endSession(id!);
      else await conversationsService.leaveSession(id!);
    } catch {
      /* ignore */
    }
    useSessionStore.getState().clear();
    router.replace('/');
  }

  const changeMyLanguage = useCallback(
    async (code: LanguageCode) => {
      if (!id || code === myLang || langBusy) return;
      setLangBusy(true);
      setLangError(null);
      try {
        await conversationsService.setMyLanguage(id, code);
        if (otherLang && isLanguageCode(otherLang)) {
          useSettingsStore.getState().setLastLanguages(code, otherLang);
        }
        setLangOpen(false);
      } catch (e) {
        setLangError(e instanceof ApiRequestError ? e.message : t('conv.langChangeError'));
      } finally {
        setLangBusy(false);
      }
    },
    [id, myLang, otherLang, langBusy, t],
  );

  // L'autre personne a quitté / terminé sans qu'on l'ait fait soi-même :
  // vibration d'alerte (le dialogue « rester / quitter » est rendu plus bas).
  const peerLeft = ended && !leaving;
  useEffect(() => {
    if (peerLeft) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [peerLeft]);

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
        <ThemedText style={styles.h1}>{t('conv.notFound')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          {error ?? t('conv.notFoundText')}
        </ThemedText>
        <Button label={t('common.home')} onPress={() => router.replace('/')} style={{ marginTop: Spacing.four }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}>
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
              ? t('conv.ended')
              : peerOnline
                ? t('conv.online')
                : active
                  ? t('conv.waiting')
                  : t('conv.connecting')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.rtBadge}>
            {connected ? t('conv.direct') : t('conv.offline')}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isCreator ? t('conv.end') : t('conv.leave')}
          onPress={() => setLeaveOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [styles.leaveBtn, pressed && styles.pressed]}>
          <ThemedText style={[styles.leave, { color: theme.danger }]}>
            {isCreator ? t('conv.end') : t('conv.leave')}
          </ThemedText>
        </Pressable>
      </View>

      {/* Barre de langue : chacun change SA langue en cours de conversation. */}
      {!ended && myLang && otherLang ? (
        <View style={[styles.langBar, { borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('conv.changeLanguage')}
            onPress={() => {
              setLangError(null);
              setLangOpen(true);
            }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.langChip,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.langChipText}>
              {formatLanguage(myLang as LanguageCode)}
            </ThemedText>
            <Ionicons name="pencil" size={12} color={theme.textSecondary} />
          </Pressable>
          <Ionicons
            name="swap-horizontal"
            size={15}
            color={theme.textSecondary}
            style={styles.langArrow}
          />
          <ThemedText themeColor="textSecondary" style={styles.langOther}>
            {formatLanguage(otherLang as LanguageCode)}
          </ThemedText>
        </View>
      ) : null}
      {langError ? (
        <ThemedText style={[styles.micError, { color: theme.danger }]}>{langError}</ThemedText>
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={langOpen}
        onRequestClose={() => setLangOpen(false)}>
        <View style={styles.langBackdrop}>
          <View style={[styles.langCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText style={styles.langTitle}>{t('conv.changeLanguage')}</ThemedText>
            <LanguageSelector
              label={t('common.myLanguage')}
              value={myLang}
              exclude={otherLang}
              onChange={changeMyLanguage}
            />
            {langBusy ? <ActivityIndicator color={theme.tint} style={{ marginTop: Spacing.two }} /> : null}
            <Button
              label={t('common.close')}
              variant="ghost"
              onPress={() => setLangOpen(false)}
              style={{ marginTop: Spacing.two }}
            />
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={leaveOpen}
        title={isCreator ? t('conv.endTitle') : t('conv.leaveTitle')}
        message={isCreator ? t('conv.endBody') : t('conv.leaveBody')}
        confirmLabel={isCreator ? t('conv.end') : t('conv.leave')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setLeaveOpen(false);
          void leave();
        }}
        onCancel={() => setLeaveOpen(false)}
      />

      <ConfirmDialog
        visible={peerLeft && !peerLeftDismissed}
        title={t('conv.peerLeftTitle')}
        message={t('conv.peerLeftBody')}
        confirmLabel={t('conv.leave')}
        cancelLabel={t('conv.peerLeftStay')}
        destructive
        onConfirm={() => {
          useSessionStore.getState().clear();
          router.replace('/');
        }}
        onCancel={() => setPeerLeftDismissed(true)}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {allMessages.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {myLang && otherLang
              ? `${formatLanguage(myLang as LanguageCode)} ↔ ${formatLanguage(otherLang as LanguageCode)}\n\n${t('conv.emptyHint')}`
              : t('conv.emptyHint')}
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
          <Button label={t('common.home')} onPress={() => router.replace('/')} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? t('conv.stopTalk') : t('conv.talk')}
            onPress={toggleRecord}
            disabled={!active}
            style={({ pressed }) => [
              styles.mic,
              {
                backgroundColor: recording ? theme.danger : theme.tint,
                opacity: !active ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}>
            {recording ? (
              <ThemedText style={[styles.micLabel, { color: theme.tintText }]}>
                {t('conv.stopTalk')}
              </ThemedText>
            ) : inFlight > 0 ? (
              <View style={styles.micRow}>
                <ActivityIndicator color={theme.tintText} />
                <ThemedText style={[styles.micLabel, { color: theme.tintText }]}>
                  {t('conv.translating')}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={[styles.micLabel, { color: theme.tintText }]}>
                {t('conv.talk')}
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
  const t = useT();
  const failed = message.status === 'failed';
  // "En écoute" tant qu'aucun mot n'est encore transcrit (statuts processing OU
  // partial sans texte) — évite un flash "…" entre le début d'envoi et le 1ᵉʳ mot.
  const awaitingFirstWord =
    (message.status === 'processing' || message.status === 'partial') &&
    !message.originalTranscript;
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
          {mine ? `${t('conv.you')} · ${src}` : src}
        </ThemedText>

        {failed ? (
          <ThemedText style={{ color: mine ? theme.tintText : theme.danger }}>
            {message.error || t('conv.translationFailed')}
          </ThemedText>
        ) : awaitingFirstWord ? (
          <View style={styles.micRow}>
            <ActivityIndicator size="small" color={mine ? theme.tintText : theme.text} />
            <ThemedText style={{ color: mine ? theme.tintText : theme.textSecondary }}>
              {t('conv.listening')}
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
                {t('conv.translatingShort')}
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
  leaveBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.one },
  leave: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  langChipText: { fontSize: 13, fontWeight: '600' },
  langArrow: { marginHorizontal: 2 },
  langOther: { fontSize: 13, fontWeight: '600' },
  langBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  langCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  langTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.one },
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
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  micLabel: { fontSize: 17, fontWeight: '700' },
});
