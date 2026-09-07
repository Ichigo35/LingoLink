/**
 * Client Gemini bas niveau (REST `generateContent` / `streamGenerateContent`).
 * Pas de SDK : plus léger pour un Worker, API REST stable.
 * https://ai.google.dev/gemini-api/docs
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.5-flash';
const MAX_ATTEMPTS = 3;
const CONNECT_TIMEOUT_MS = 20_000;

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

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GenerateOptions {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  parts: GeminiPart[];
  temperature?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildBody(opts: GenerateOptions) {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  return body;
}

async function openGemini(
  opts: GenerateOptions,
  method: 'generateContent' | 'streamGenerateContent',
): Promise<Response> {
  const model = opts.model ?? DEFAULT_MODEL;
  const qs = method === 'streamGenerateContent' ? '?alt=sse' : '';
  let lastError: GeminiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    try {
      const res = await fetch(`${GEMINI_BASE}/models/${model}:${method}${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
        body: JSON.stringify(buildBody(opts)),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return res;

      const text = await res.text();
      const retriable = res.status === 429 || res.status >= 500;
      lastError = new GeminiError(`Gemini ${res.status}: ${text.slice(0, 160)}`, res.status, retriable);
      if (retriable && attempt < MAX_ATTEMPTS) {
        await sleep(350 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof GeminiError) {
        if (err.retriable && attempt < MAX_ATTEMPTS) {
          lastError = err;
          await sleep(350 * 2 ** (attempt - 1));
          continue;
        }
        throw err;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      lastError = new GeminiError(
        isAbort ? 'Gemini: délai de connexion dépassé' : 'Gemini: erreur réseau',
        isAbort ? 504 : 502,
        true,
      );
      if (attempt < MAX_ATTEMPTS) {
        await sleep(350 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new GeminiError('Gemini: échec', 500, false);
}

function extractText(json: unknown): string {
  const j = json as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  if (j.promptFeedback?.blockReason) {
    throw new GeminiError(`Contenu bloqué: ${j.promptFeedback.blockReason}`, 422, false);
  }
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}

/** Génération non-streamée : renvoie le texte complet. */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const res = await openGemini(opts, 'generateContent');
  return extractText(JSON.parse(await res.text()));
}

/**
 * Génération streamée : yield des fragments de texte au fur et à mesure.
 * (SSE `alt=sse`, lignes `data: {json}`.)
 */
export async function* streamText(opts: GenerateOptions): AsyncGenerator<string, void, unknown> {
  const res = await openGemini(opts, 'streamGenerateContent');
  if (!res.body) throw new GeminiError('Gemini: flux vide', 502, true);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const chunk = extractText(JSON.parse(payload));
        if (chunk) yield chunk;
      } catch (err) {
        if (err instanceof GeminiError) throw err;
        /* fragment JSON partiel — ignoré */
      }
    }
  }
}

export { DEFAULT_MODEL };
