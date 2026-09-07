import type { Context } from 'hono';
import { Hono } from 'hono';

import type { AppEnv } from './context';
import type { Env } from './env';
import { DEFAULT_MODEL, GeminiError, generateJson } from './gemini';
import { type LanguageCode, isLanguageCode } from './languages';

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  lo: 'lao (Lao)',
  fr: 'français (French)',
  en: 'anglais (English)',
  th: 'thaï (Thai)',
  zh: 'chinois mandarin (Mandarin Chinese)',
};

/** Limite de taille de l'audio inline (~6 Mo binaire ; l'API Gemini plafonne à 20 Mo). */
const MAX_AUDIO_B64_LENGTH = 8_000_000;

/**
 * Fournisseur de traduction abstrait (§2). L'implémentation Gemini peut être
 * remplacée sans toucher aux routes.
 */
export interface TranslationProvider {
  processSpeech(input: {
    audioBase64: string;
    mimeType: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  }): Promise<{ transcript: string; translation: string }>;

  transcribeAudio(input: {
    audioBase64: string;
    mimeType: string;
    language: LanguageCode;
  }): Promise<{ transcript: string }>;

  translateText(input: {
    text: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  }): Promise<{ translation: string }>;
}

class GeminiProvider implements TranslationProvider {
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async processSpeech(input: {
    audioBase64: string;
    mimeType: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  }): Promise<{ transcript: string; translation: string }> {
    const src = LANGUAGE_NAMES[input.sourceLanguage];
    const tgt = LANGUAGE_NAMES[input.targetLanguage];
    return generateJson<{ transcript: string; translation: string }>({
      apiKey: this.apiKey,
      model: this.model,
      systemInstruction:
        "Tu es un interprète vocal en temps réel. Tu transcris fidèlement la parole (sans rien ajouter ni commenter) puis tu la traduis de façon naturelle. Si l'audio est vide, silencieux ou inintelligible, renvoie des chaînes vides.",
      parts: [
        {
          text: `Langue parlée : ${src}. Langue cible : ${tgt}.\nTranscris l'audio dans la langue parlée, puis fournis la traduction dans la langue cible.`,
        },
        { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
      ],
      responseSchema: {
        type: 'object',
        properties: { transcript: { type: 'string' }, translation: { type: 'string' } },
        required: ['transcript', 'translation'],
      },
    });
  }

  async transcribeAudio(input: {
    audioBase64: string;
    mimeType: string;
    language: LanguageCode;
  }): Promise<{ transcript: string }> {
    return generateJson<{ transcript: string }>({
      apiKey: this.apiKey,
      model: this.model,
      systemInstruction:
        "Tu transcris fidèlement la parole, sans rien ajouter. Si l'audio est vide ou inintelligible, renvoie une chaîne vide.",
      parts: [
        { text: `Transcris cet audio en ${LANGUAGE_NAMES[input.language]}.` },
        { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
      ],
      responseSchema: {
        type: 'object',
        properties: { transcript: { type: 'string' } },
        required: ['transcript'],
      },
    });
  }

  async translateText(input: {
    text: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  }): Promise<{ translation: string }> {
    return generateJson<{ translation: string }>({
      apiKey: this.apiKey,
      model: this.model,
      systemInstruction:
        'Tu traduis de façon naturelle et fidèle. Ne renvoie que la traduction, sans commentaire.',
      parts: [
        {
          text: `Traduis de ${LANGUAGE_NAMES[input.sourceLanguage]} vers ${LANGUAGE_NAMES[input.targetLanguage]} :\n\n${input.text}`,
        },
      ],
      responseSchema: {
        type: 'object',
        properties: { translation: { type: 'string' } },
        required: ['translation'],
      },
    });
  }
}

export function getTranslationProvider(env: Env): TranslationProvider | null {
  if (!env.GEMINI_API_KEY) return null;
  return new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || DEFAULT_MODEL);
}

function handleAiError(c: Context<AppEnv>, err: unknown) {
  if (err instanceof GeminiError) {
    const code =
      err.status === 504
        ? 'ai_timeout'
        : err.status === 429
          ? 'ai_rate_limited'
          : err.retriable
            ? 'ai_unavailable'
            : 'ai_error';
    return c.json({ code, message: 'Le service de traduction a échoué' }, 502);
  }
  return c.json({ code: 'ai_error', message: 'Erreur inattendue' }, 500);
}

export function registerAiRoutes(app: Hono<AppEnv>) {
  // Pipeline complet : audio -> transcription + traduction.
  app.post('/api/ai/process', async (c) => {
    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);

    const provider = getTranslationProvider(c.env);
    if (!provider) return c.json({ code: 'ai_disabled', message: 'Service IA non configuré' }, 503);

    const body = await c.req.json().catch(() => ({}));
    const { audioBase64, mimeType, sourceLanguage, targetLanguage } = body ?? {};
    if (typeof audioBase64 !== 'string' || !audioBase64) {
      return c.json({ code: 'missing_audio', message: 'Audio manquant' }, 400);
    }
    if (audioBase64.length > MAX_AUDIO_B64_LENGTH) {
      return c.json({ code: 'audio_too_large', message: 'Segment audio trop long' }, 413);
    }
    if (!isLanguageCode(sourceLanguage) || !isLanguageCode(targetLanguage)) {
      return c.json({ code: 'invalid_language', message: 'Langues invalides' }, 400);
    }

    try {
      const result = await provider.processSpeech({
        audioBase64,
        mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'audio/m4a',
        sourceLanguage,
        targetLanguage,
      });
      return c.json({
        transcript: (result.transcript ?? '').trim(),
        translation: (result.translation ?? '').trim(),
      });
    } catch (err) {
      return handleAiError(c, err);
    }
  });

  // Transcription seule.
  app.post('/api/ai/transcribe', async (c) => {
    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);
    const provider = getTranslationProvider(c.env);
    if (!provider) return c.json({ code: 'ai_disabled', message: 'Service IA non configuré' }, 503);

    const body = await c.req.json().catch(() => ({}));
    const { audioBase64, mimeType, language } = body ?? {};
    if (typeof audioBase64 !== 'string' || !audioBase64) {
      return c.json({ code: 'missing_audio', message: 'Audio manquant' }, 400);
    }
    if (audioBase64.length > MAX_AUDIO_B64_LENGTH) {
      return c.json({ code: 'audio_too_large', message: 'Segment audio trop long' }, 413);
    }
    if (!isLanguageCode(language)) {
      return c.json({ code: 'invalid_language', message: 'Langue invalide' }, 400);
    }
    try {
      const result = await provider.transcribeAudio({
        audioBase64,
        mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'audio/m4a',
        language,
      });
      return c.json({ transcript: (result.transcript ?? '').trim() });
    } catch (err) {
      return handleAiError(c, err);
    }
  });

  // Traduction texte seul.
  app.post('/api/ai/translate', async (c) => {
    const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ code: 'unauthenticated', message: 'Connexion requise' }, 401);

    const provider = getTranslationProvider(c.env);
    if (!provider) return c.json({ code: 'ai_disabled', message: 'Service IA non configuré' }, 503);

    const body = await c.req.json().catch(() => ({}));
    const { text, sourceLanguage, targetLanguage } = body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      return c.json({ code: 'missing_text', message: 'Texte manquant' }, 400);
    }
    if (!isLanguageCode(sourceLanguage) || !isLanguageCode(targetLanguage)) {
      return c.json({ code: 'invalid_language', message: 'Langues invalides' }, 400);
    }

    try {
      const result = await provider.translateText({ text: text.trim(), sourceLanguage, targetLanguage });
      return c.json({ translation: (result.translation ?? '').trim() });
    } catch (err) {
      return handleAiError(c, err);
    }
  });
}
