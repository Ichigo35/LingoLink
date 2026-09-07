/**
 * Capture audio Push-to-Talk (§8) — enveloppe `expo-audio`.
 *
 * Gère la permission micro, le mode audio, l'enregistrement d'un segment et
 * renvoie l'URI du fichier. La détection automatique de parole / fin de phrase
 * viendra plus tard derrière la même interface.
 */

import {
  RecordingPresets,
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
const MIN_SEGMENT_MS = 400;

export function useAudioCapture() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const startedAtRef = useRef<number>(0);

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
    if (!recorder.isRecording) return null;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const durationMs = Date.now() - startedAtRef.current;
    const uri = recorder.uri;
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
