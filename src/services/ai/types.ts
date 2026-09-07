/**
 * Interface abstraite du service IA (§2 du cahier des charges).
 *
 * L'application ne dépend JAMAIS directement de Gemini. Elle dépend de cette
 * interface. L'implémentation concrète (Gemini via le backend) est branchée
 * dans `index.ts`. Remplacer de fournisseur = écrire une nouvelle classe qui
 * respecte `AITranslationService`, sans toucher aux composants.
 */

import type { LanguageCode } from '@/config/languages';

export interface TranscriptionResult {
  text: string;
  /** true tant que la transcription n'est pas finale (résultats progressifs). */
  isPartial: boolean;
  detectedLanguage?: LanguageCode;
}

export interface TranslationResult {
  text: string;
  isPartial: boolean;
}

export interface ProcessSpeechInput {
  /** URI locale du fichier audio capturé (m4a/wav). */
  audioUri: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  /** ID de session pour la corrélation côté backend. */
  sessionId: string;
}

export interface ProcessSpeechUpdate {
  stage: 'transcribing' | 'translating' | 'done' | 'failed';
  transcript?: TranscriptionResult;
  translation?: TranslationResult;
  error?: string;
}

export type ProcessSpeechCallback = (update: ProcessSpeechUpdate) => void;

export interface ProcessSpeechHandle {
  /** Promesse résolue quand le pipeline complet est terminé. */
  completion: Promise<ProcessSpeechUpdate>;
  /** Annule la requête en cours (réseau + traitement). */
  cancel: () => void;
}

export interface AITranslationService {
  translateText(input: {
    text: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  }): Promise<TranslationResult>;

  /**
   * Pipeline complet audio -> transcription -> traduction, avec remontée
   * progressive via `onUpdate`. Retourne un handle annulable.
   */
  processSpeech(input: ProcessSpeechInput, onUpdate: ProcessSpeechCallback): ProcessSpeechHandle;

  cancelProcessing(handle: ProcessSpeechHandle): void;
}
