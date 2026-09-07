/**
 * Client Gemini bas niveau (REST `generateContent`). Pas de SDK : plus léger
 * pour un Worker, et l'API REST est stable.
 *
 * https://ai.google.dev/gemini-api/docs
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30_000;

export class GeminiError extends Error {
  status: number;
  retriable: boolean;
  constructor(message: string, status: number, retriable: boolean) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.retriable = retriable;
  }
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GenerateOptions {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  parts: GeminiPart[];
  /** Schéma JSON de sortie (structured output). */
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  /** Désactive le "thinking" (latence plus faible). Défaut : true. */
  disableThinking?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(opts: GenerateOptions): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0,
      ...(opts.disableThinking === false ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      ...(opts.responseSchema
        ? { responseMimeType: 'application/json', responseSchema: opts.responseSchema }
        : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  let lastError: GeminiError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(
        `${GEMINI_BASE}/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const text = await res.text();
      if (!res.ok) {
        const retriable = res.status === 429 || res.status === 503 || res.status >= 500;
        lastError = new GeminiError(
          `Gemini ${res.status}: ${text.slice(0, 200)}`,
          res.status,
          retriable,
        );
        if (retriable && attempt < MAX_ATTEMPTS) {
          await sleep(400 * 2 ** (attempt - 1));
          continue;
        }
        throw lastError;
      }
      const json = JSON.parse(text) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      if (json.promptFeedback?.blockReason) {
        throw new GeminiError(`Contenu bloqué: ${json.promptFeedback.blockReason}`, 422, false);
      }
      const out = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      return out;
    } catch (err) {
      if (err instanceof GeminiError) {
        if (err.retriable && attempt < MAX_ATTEMPTS) {
          lastError = err;
          await sleep(400 * 2 ** (attempt - 1));
          continue;
        }
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new GeminiError('Gemini: délai dépassé', 504, true);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(400 * 2 ** (attempt - 1));
          continue;
        }
        throw lastError;
      }
      lastError = new GeminiError('Gemini: erreur réseau', 502, true);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new GeminiError('Gemini: échec', 500, false);
}

/** Appelle Gemini en attendant un objet JSON conforme au schéma. */
export async function generateJson<T>(
  opts: GenerateOptions & { responseSchema: Record<string, unknown> },
): Promise<T> {
  const raw = await callGemini(opts);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new GeminiError(`Réponse Gemini non JSON: ${raw.slice(0, 200)}`, 502, false);
  }
}

export { DEFAULT_MODEL };
