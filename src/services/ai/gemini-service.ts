/**
 * Implémentation Gemini de `AITranslationService` — via le backend (la clé
 * Gemini reste côté Worker). L'app ne parle jamais directement à Gemini.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { apiRequest } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import type {
  AITranslationService,
  ProcessSpeechCallback,
  ProcessSpeechHandle,
  ProcessSpeechInput,
  ProcessSpeechUpdate,
  TranscriptionResult,
  TranslationResult,
} from './types';

function mimeForUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'caf':
      return 'audio/x-caf';
    case 'aac':
      return 'audio/aac';
    case '3gp':
      return 'audio/3gpp';
    default:
      return 'audio/mp4';
  }
}

async function readAudioBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

async function cookie(): Promise<string | null> {
  return (await authClient.getCookie()) ?? null;
}

export class GeminiAIService implements AITranslationService {
  async transcribeAudio(input: {
    audioUri: string;
    language: ProcessSpeechInput['sourceLanguage'];
    sessionId: string;
  }): Promise<TranscriptionResult> {
    const audioBase64 = await readAudioBase64(input.audioUri);
    const res = await apiRequest<{ transcript: string }>('/api/ai/transcribe', {
      method: 'POST',
      cookie: await cookie(),
      timeoutMs: 45_000,
      body: { audioBase64, mimeType: mimeForUri(input.audioUri), language: input.language },
    });
    return { text: res.transcript, isPartial: false };
  }

  async translateText(input: {
    text: string;
    sourceLanguage: ProcessSpeechInput['sourceLanguage'];
    targetLanguage: ProcessSpeechInput['targetLanguage'];
  }): Promise<TranslationResult> {
    const res = await apiRequest<{ translation: string }>('/api/ai/translate', {
      method: 'POST',
      cookie: await cookie(),
      timeoutMs: 30_000,
      body: input,
    });
    return { text: res.translation, isPartial: false };
  }

  processSpeech(input: ProcessSpeechInput, onUpdate: ProcessSpeechCallback): ProcessSpeechHandle {
    const controller = new AbortController();

    const run = async (): Promise<ProcessSpeechUpdate> => {
      try {
        onUpdate({ stage: 'transcribing' });
        const audioBase64 = await readAudioBase64(input.audioUri);
        onUpdate({ stage: 'translating' });
        const res = await apiRequest<{ transcript: string; translation: string }>(
          '/api/ai/process',
          {
            method: 'POST',
            cookie: await cookie(),
            signal: controller.signal,
            timeoutMs: 45_000,
            body: {
              audioBase64,
              mimeType: mimeForUri(input.audioUri),
              sourceLanguage: input.sourceLanguage,
              targetLanguage: input.targetLanguage,
            },
          },
        );
        const done: ProcessSpeechUpdate = {
          stage: 'done',
          transcript: { text: res.transcript, isPartial: false },
          translation: { text: res.translation, isPartial: false },
        };
        onUpdate(done);
        return done;
      } catch (err) {
        const failed: ProcessSpeechUpdate = {
          stage: 'failed',
          error: err instanceof Error ? err.message : 'Traduction impossible',
        };
        onUpdate(failed);
        return failed;
      }
    };

    return { completion: run(), cancel: () => controller.abort() };
  }

  cancelProcessing(handle: ProcessSpeechHandle): void {
    handle.cancel();
  }
}
