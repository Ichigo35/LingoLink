/**
 * Point d'entrée du service IA.
 *
 * Phase 1 : seule l'interface est câblée. L'implémentation Gemini (via le
 * backend Cloudflare Worker) arrivera en Phase 5. On expose déjà un
 * `getAIService()` pour que le reste du code s'y branche dès maintenant.
 */

import type { AITranslationService } from './types';

export * from './types';

class NotConfiguredAIService implements AITranslationService {
  private fail(): never {
    throw new Error(
      "Service IA non configuré. L'intégration Gemini est prévue en Phase 5.",
    );
  }

  transcribeAudio(): never {
    this.fail();
  }
  translateText(): never {
    this.fail();
  }
  processSpeech(): never {
    this.fail();
  }
  cancelProcessing(): void {
    /* no-op */
  }
}

let instance: AITranslationService = new NotConfiguredAIService();

export function getAIService(): AITranslationService {
  return instance;
}

/** Permet d'injecter une implémentation (Gemini, mock de test, autre). */
export function setAIService(service: AITranslationService): void {
  instance = service;
}
