/**
 * Capture audio (§8) — enveloppe `expo-audio` avec **segmentation automatique
 * sur les pauses** (VAD léger basé sur le niveau sonore).
 *
 * Tant que l'utilisateur maintient le bouton, on surveille le niveau : dès qu'un
 * silence suffisant suit de la parole, on coupe le segment courant, on le
 * remonte via `onSegment` (→ envoyé + traduit immédiatement) et on repart sur un
 * nouveau segment, sans relâcher. Un long monologue est ainsi traduit
 * phrase par phrase au fil de l'eau. `stop()` renvoie le dernier segment.
 */

import {
  AudioQuality,
  IOSOutputFormat,
  type RecordingOptions,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useRef, useState } from 'react';

export interface AudioSegment {
  uri: string;
  durationMs: number;
}

export type MicPermission = 'unknown' | 'granted' | 'denied';

/** Segments trop courts = bruit / appui accidentel. */
const MIN_SEGMENT_MS = 600;
/** Pas de coupure avant d'avoir au moins ça de parole dans le segment. */
const MIN_SPEECH_MS = 1100;
/** Silence (sous le seuil) à tenir pour déclencher une coupure. */
const SILENCE_HOLD_MS = 850;
/** Coupure forcée d'un segment qui n'en finit pas (parole continue). */
const MAX_SEGMENT_MS = 12_000;
/** Seuil de niveau (dBFS) : au-dessus = parole, en dessous = silence. */
const SPEECH_DB = -40;
const POLL_MS = 140;

/**
 * Réglage optimisé pour la voix : mono 16 kHz ~24 kbps AAC. Fichier ~5x plus
 * léger qu'en HIGH_QUALITY → upload + traitement Gemini plus rapides, qualité
 * amplement suffisante pour la transcription.
 */
const SPEECH_RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 24000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 24000 },
};

export function useAudioCapture() {
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const state = useAudioRecorderState(recorder);
  const [permission, setPermission] = useState<MicPermission>('unknown');

  const segmentStartRef = useRef(0);
  const lastLoudRef = useRef(0);
  const hadSpeechRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cuttingRef = useRef(false);
  const onSegmentRef = useRef<((seg: AudioSegment) => void) | null>(null);
  const activeRef = useRef(false);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const res = await requestRecordingPermissionsAsync();
    setPermission(res.granted ? 'granted' : 'denied');
    return res.granted;
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const beginSegment = useCallback(async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
    const now = Date.now();
    segmentStartRef.current = now;
    lastLoudRef.current = now;
    hadSpeechRef.current = false;
  }, [recorder]);

  /** Termine le segment courant et renvoie son fichier (ou null si négligeable). */
  const finishSegment = useCallback(async (): Promise<AudioSegment | null> => {
    try {
      await recorder.stop();
    } catch {
      return null;
    }
    const durationMs = Date.now() - segmentStartRef.current;
    const uri = recorder.uri;
    if (!uri || durationMs < MIN_SEGMENT_MS || !hadSpeechRef.current) return null;
    return { uri, durationMs };
  }, [recorder]);

  const tick = useCallback(async () => {
    if (!activeRef.current || cuttingRef.current) return;
    const level = recorder.getStatus().metering ?? -160;
    const now = Date.now();
    if (level > SPEECH_DB) {
      lastLoudRef.current = now;
      hadSpeechRef.current = true;
    }
    const sinceStart = now - segmentStartRef.current;
    const sinceLoud = now - lastLoudRef.current;
    const pauseCut =
      hadSpeechRef.current && sinceStart > MIN_SPEECH_MS && sinceLoud > SILENCE_HOLD_MS;
    const forceCut = hadSpeechRef.current && sinceStart > MAX_SEGMENT_MS;
    if (!pauseCut && !forceCut) return;

    cuttingRef.current = true;
    try {
      const seg = await finishSegment();
      if (seg) onSegmentRef.current?.(seg);
      if (activeRef.current) await beginSegment();
    } catch {
      /* on retentera au prochain tick */
    } finally {
      cuttingRef.current = false;
    }
  }, [recorder, finishSegment, beginSegment]);

  const start = useCallback(
    async (onSegment?: (seg: AudioSegment) => void): Promise<boolean> => {
      if (!(await ensurePermission())) return false;
      onSegmentRef.current = onSegment ?? null;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      activeRef.current = true;
      cuttingRef.current = false;
      await beginSegment();
      if (onSegment) {
        stopPoll();
        pollRef.current = setInterval(() => void tick(), POLL_MS);
      }
      return true;
    },
    [ensurePermission, beginSegment, stopPoll, tick],
  );

  const stop = useCallback(async (): Promise<AudioSegment | null> => {
    activeRef.current = false;
    stopPoll();
    // Laisse une éventuelle coupure en cours se terminer.
    for (let i = 0; i < 20 && cuttingRef.current; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const seg = recorder.isRecording ? await finishSegment() : null;
    await setAudioModeAsync({ allowsRecording: false });
    return seg;
  }, [recorder, finishSegment, stopPoll]);

  const cancel = useCallback(async () => {
    activeRef.current = false;
    stopPoll();
    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch {
        /* ignore */
      }
    }
    await setAudioModeAsync({ allowsRecording: false });
  }, [recorder, stopPoll]);

  return {
    isRecording: state.isRecording,
    /** Niveau sonore courant (dBFS) si disponible. */
    metering: state.metering,
    permission,
    start,
    stop,
    cancel,
    ensurePermission,
  };
}
