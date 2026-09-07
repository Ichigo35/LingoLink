import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Screen } from '@/components/ui/screen';
import { DEFAULT_MY_LANGUAGE, DEFAULT_OTHER_LANGUAGE, formatLanguage, type LanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAudioCapture } from '@/features/conversation/use-audio-capture';
import { useTheme } from '@/hooks/use-theme';
import { getAIService } from '@/services/ai';

interface Result {
  transcript: string;
  translation: string;
  ms: number;
}

export default function AiTestScreen() {
  const theme = useTheme();
  const capture = useAudioCapture();

  const [source, setSource] = useState<LanguageCode>(DEFAULT_MY_LANGUAGE);
  const [target, setTarget] = useState<LanguageCode>(DEFAULT_OTHER_LANGUAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onPressIn() {
    setError(null);
    const ok = await capture.start();
    if (!ok) setError('Micro non autorisé.');
  }

  async function onPressOut() {
    const segment = await capture.stop();
    if (!segment) {
      setError('Segment trop court.');
      return;
    }
    setBusy(true);
    setResult(null);
    const startedAt = Date.now();
    const handle = getAIService().processSpeech(
      { audioUri: segment.uri, sourceLanguage: source, targetLanguage: target, sessionId: 'ai-test' },
      () => {},
    );
    const update = await handle.completion;
    setBusy(false);
    if (update.stage === 'failed') {
      setError(update.error ?? 'Échec');
      return;
    }
    setResult({
      transcript: update.transcript?.text ?? '',
      translation: update.translation?.text ?? '',
      ms: Date.now() - startedAt,
    });
  }

  const recording = capture.isRecording;

  return (
    <Screen scroll>
      <ThemedText style={styles.h1}>Test du pipeline IA</ThemedText>
      <ThemedText themeColor="textSecondary">
        Maintenez le bouton, parlez, relâchez. Transcription + traduction via Gemini (backend).
      </ThemedText>

      <View style={styles.block}>
        <LanguageSelector label="Langue parlée" value={source} onChange={setSource} exclude={target} />
      </View>
      <View style={styles.block}>
        <LanguageSelector label="Traduire vers" value={target} onChange={setTarget} exclude={source} />
      </View>

      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={busy}
        style={[
          styles.mic,
          {
            backgroundColor: recording ? theme.danger : theme.tint,
            opacity: busy ? 0.5 : 1,
          },
        ]}>
        <ThemedText style={[styles.micLabel, { color: theme.tintText }]}>
          {recording ? '● Enregistrement — relâchez' : '🎤 Maintenir pour parler'}
        </ThemedText>
      </Pressable>

      {busy ? (
        <View style={styles.processing}>
          <ActivityIndicator color={theme.tint} />
          <ThemedText themeColor="textSecondary">Traitement…</ThemedText>
        </View>
      ) : null}

      {error ? (
        <ThemedText style={[styles.error, { color: theme.danger }]}>{error}</ThemedText>
      ) : null}

      {result ? (
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText themeColor="textSecondary" style={styles.cardLabel}>
            {formatLanguage(source)}
          </ThemedText>
          <ThemedText style={styles.original}>{result.transcript || '—'}</ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.cardLabel, { marginTop: Spacing.three }]}>
            {formatLanguage(target)}
          </ThemedText>
          <ThemedText style={styles.translated}>{result.translation || '—'}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.timing}>
            {(result.ms / 1000).toFixed(1)} s
          </ThemedText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '700' },
  block: { gap: Spacing.two, marginTop: Spacing.three },
  mic: {
    minHeight: 72,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.five,
  },
  micLabel: { fontSize: 17, fontWeight: '700' },
  processing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  error: { marginTop: Spacing.three, fontSize: 14 },
  card: {
    marginTop: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
  },
  cardLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  original: { fontSize: 18, marginTop: Spacing.one },
  translated: { fontSize: 18, fontWeight: '600', marginTop: Spacing.one },
  timing: { marginTop: Spacing.three, fontSize: 12, textAlign: 'right' },
});
