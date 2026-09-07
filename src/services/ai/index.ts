/**
 * Point d'entrée du service IA (§2).
 *
 * L'app dépend de l'interface `AITranslationService`, jamais de Gemini
 * directement. L'implémentation par défaut (`GeminiAIService`) passe par le
 * backend ; `setAIService()` permet d'injecter un mock ou un autre fournisseur.
 */

import { GeminiAIService } from './gemini-service';
import type { AITranslationService } from './types';

export * from './types';

let instance: AITranslationService = new GeminiAIService();

export function getAIService(): AITranslationService {
  return instance;
}

export function setAIService(service: AITranslationService): void {
  instance = service;
}
