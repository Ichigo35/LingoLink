/**
 * Capture audio (§8) — enveloppe simple d'`expo-audio`.
 *
 * Un seul segment par prise de parole : `start()` lance l'enregistrement,
 * `stop()` l'arrête et renvoie le fichier complet (transcrit + traduit ensuite,
 * une fois). Pas de découpage automatique sur les pauses — la traduction
 * phrase-par-phrase « en direct » a été retirée (pas assez fluide/précise).
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

/** En dessous = appui accidentel / bruit, on ignore. */
const MIN_SEGMENT_MS = 400;

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

  const startedAtRef = useRef(0);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const res = await requestRecordingPermissionsAsync();
    setPermission(res.granted ? 'granted' : 'denied');
    return res.granted;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!(await ensurePermission())) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAtRef.current = Date.now();
    return true;
  }, [ensurePermission, recorder]);

  const stop = useCallback(async (): Promise<AudioSegment | null> => {
    let uri: string | null = null;
    try {
      if (recorder.isRecording) await recorder.stop();
      uri = recorder.uri;
    } catch {
      uri = null;
    }
    await setAudioModeAsync({ allowsRecording: false });
    const durationMs = Date.now() - startedAtRef.current;
    if (!uri || durationMs < MIN_SEGMENT_MS) return null;
    return { uri, durationMs };
  }, [recorder]);

  const cancel = useCallback(async () => {
    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch {
        /* ignore */
      }
    }
    await setAudioModeAsync({ allowsRecording: false });
  }, [recorder]);

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
