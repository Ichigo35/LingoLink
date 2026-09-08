/**
 * Client Gemini bas niveau (REST `generateContent` / `streamGenerateContent`).
 * Pas de SDK : plus léger pour un Worker, API REST stable.
 * https://ai.google.dev/gemini-api/docs
 *
 * Repli multi-modèles : `GEMINI_MODEL` peut lister plusieurs modèles séparés par
 * des virgules. Chaque modèle du niveau gratuit a un quota journalier propre ;
 * quand un modèle renvoie `RESOURCE_EXHAUSTED` (quota du jour), on le met en
 * pause côté isolat et on bascule sur le suivant.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Ordre par défaut. `gemini-2.5-flash` d'abord (quota gratuit large, éprouvé
 * pour l'audio de cette app), puis des modèles plus récents en repli, et
 * `gemini-3.5-flash` en dernier (quota gratuit minuscule mais réinitialisé
 * chaque jour — autant s'en servir quand les autres sont saturés).
 */
export const DEFAULT_MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
];

/** Compat : premier modèle de la chaîne par défaut. */
export const DEFAULT_MODEL = DEFAULT_MODEL_CHAIN[0];

const MAX_ATTEMPTS_PER_MODEL = 2;
const CONNECT_TIMEOUT_MS = 20_000;
/** Budget global : au-delà, on arrête d'essayer d'autres modèles. */
const TOTAL_BUDGET_MS = 38_000;
/** Attente max qu'on tolère sur un 429 "par minute" avant de basculer. */
const MAX_INLINE_RETRY_WAIT_MS = 6_000;
/** Pause par défaut d'un modèle dont le quota du jour est épuisé. */
const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;

/** État par isolat (best-effort, réinitialisé au cold start). */
const modelCooldownUntil = new Map<string, number>();
const modelNoThinking = new Set<string>();

export type GeminiErrorKind = 'quota' | 'rate' | 'timeout' | 'blocked' | 'error';

export class GeminiError extends Error {
  status: number;
  retriable: boolean;
  kind: GeminiErrorKind;
  /** Secondes suggérées avant de réessayer (RetryInfo de l'API), si connu. */
  retryAfterSec?: number;
  constructor(
    message: string,
    status: number,
    retriable: boolean,
    kind: GeminiErrorKind = 'error',
    retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.retriable = retriable;
    this.kind = kind;
    this.retryAfterSec = retryAfterSec;
  }
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GenerateOptions {
  apiKey: string;
  /** Chaîne de modèles à essayer dans l'ordre. */
  models: string[];
  systemInstruction?: string;
  parts: GeminiPart[];
  temperature?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "gemini-2.5-flash, gemini-3.5-flash" -> ["gemini-2.5-flash", "gemini-3.5-flash"] */
export function parseModelChain(raw?: string): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped = list.filter((m) => (seen.has(m) ? false : (seen.add(m), true)));
  return deduped.length ? deduped : [...DEFAULT_MODEL_CHAIN];
}

function buildBody(opts: GenerateOptions, model: string) {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: opts.parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0,
      // Certains modèles (ex. gemini-3.6-flash) rejettent thinkingConfig -> on
      // le retire pour ce modèle après un premier 400 (voir attemptModel).
      ...(modelNoThinking.has(model) ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  return body;
}

/** Extrait `retryDelay` (ex. "49s", "1.5s") des détails d'erreur Gemini. */
function parseRetryInfo(json: unknown): { retryAfterSec?: number; isDailyQuota: boolean } {
  const details =
    (json as { error?: { details?: Array<Record<string, unknown>> } })?.error?.details ?? [];
  let retryAfterSec: number | undefined;
  let isDailyQuota = false;
  for (const d of details) {
    const type = String(d['@type'] ?? '');
    if (type.endsWith('RetryInfo') && typeof d.retryDelay === 'string') {
      const m = d.retryDelay.match(/([\d.]+)s/);
      if (m) retryAfterSec = Math.ceil(parseFloat(m[1]));
    }
    if (type.endsWith('QuotaFailure')) {
      const violations = (d.violations as Array<Record<string, unknown>>) ?? [];
      if (
        violations.some((v) =>
          /per\s*day|PerDay|free_tier/i.test(`${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`),
        )
      ) {
        isDailyQuota = true;
      }
    }
  }
  return { retryAfterSec, isDailyQuota };
}

/**
 * Une tentative complète sur UN modèle (avec quelques retries internes pour les
 * erreurs transitoires). Renvoie la Response OK, ou lève une GeminiError.
 */
async function attemptModel(
  model: string,
  opts: GenerateOptions,
  method: 'generateContent' | 'streamGenerateContent',
  deadline: number,
): Promise<Response> {
  const qs = method === 'streamGenerateContent' ? '?alt=sse' : '';
  const url = `${GEMINI_BASE}/models/${model}:${method}${qs}`;
  let lastError: GeminiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
    if (Date.now() > deadline) {
      throw lastError ?? new GeminiError('Gemini: délai global dépassé', 504, false, 'timeout');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
        body: JSON.stringify(buildBody(opts, model)),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return res;

      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }

      // 429 : quota du jour (on bascule) ou débit court (petite attente).
      if (res.status === 429) {
        const { retryAfterSec, isDailyQuota } = parseRetryInfo(json);
        if (isDailyQuota) {
          throw new GeminiError(
            `Gemini ${model}: quota du jour épuisé`,
            429,
            true,
            'quota',
            retryAfterSec,
          );
        }
        const waitMs = Math.min((retryAfterSec ?? 3) * 1000, MAX_INLINE_RETRY_WAIT_MS);
        if (attempt < MAX_ATTEMPTS_PER_MODEL && Date.now() + waitMs < deadline) {
          await sleep(waitMs);
          continue;
        }
        throw new GeminiError(`Gemini ${model}: débit dépassé`, 429, true, 'rate', retryAfterSec);
      }

      // 400 thinkingConfig non supporté par ce modèle -> on retire et on retente.
      if (
        res.status === 400 &&
        !modelNoThinking.has(model) &&
        /invalid argument|thinking/i.test(text)
      ) {
        modelNoThinking.add(model);
        continue;
      }

      const retriable = res.status >= 500;
      lastError = new GeminiError(
        `Gemini ${model} ${res.status}: ${text.slice(0, 160)}`,
        res.status,
        retriable,
        retriable ? 'error' : 'error',
      );
      if (retriable && attempt < MAX_ATTEMPTS_PER_MODEL) {
        await sleep(350 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof GeminiError) {
        if (err.retriable && err.kind === 'error' && attempt < MAX_ATTEMPTS_PER_MODEL) {
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
        isAbort ? 'timeout' : 'error',
      );
      if (attempt < MAX_ATTEMPTS_PER_MODEL) {
        await sleep(350 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new GeminiError('Gemini: échec', 500, false);
}

/**
 * Parcourt la chaîne de modèles jusqu'à une réponse exploitable. Les modèles
 * en cooldown (quota du jour) sont sautés, sauf si tous le sont.
 */
async function openGemini(
  opts: GenerateOptions,
  method: 'generateContent' | 'streamGenerateContent',
): Promise<Response> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const now = Date.now();
  const fresh = opts.models.filter((m) => (modelCooldownUntil.get(m) ?? 0) <= now);
  const chain = fresh.length ? fresh : opts.models;

  let quotaError: GeminiError | null = null;
  let lastError: GeminiError | null = null;

  for (const model of chain) {
    if (Date.now() > deadline) break;
    try {
      return await attemptModel(model, opts, method, deadline);
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err;
      lastError = err;
      if (err.kind === 'quota') {
        modelCooldownUntil.set(
          model,
          Date.now() + (err.retryAfterSec ? err.retryAfterSec * 1000 : DEFAULT_COOLDOWN_MS),
        );
        quotaError = err;
        continue; // modèle suivant
      }
      if (err.kind === 'rate') continue; // modèle suivant (déjà attendu en interne)
      if (err.kind === 'blocked') throw err; // inutile de réessayer ailleurs
      if (err.retriable) continue; // 5xx / réseau : tenter un autre modèle
      throw err; // 400 non lié au thinking, etc.
    }
  }

  if (quotaError) {
    throw new GeminiError(
      'Gemini: quota du jour épuisé sur tous les modèles',
      429,
      true,
      'quota',
      quotaError.retryAfterSec,
    );
  }
  throw lastError ?? new GeminiError('Gemini: échec', 502, true);
}

function extractText(json: unknown): string {
  const j = json as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  if (j.promptFeedback?.blockReason) {
    throw new GeminiError(`Contenu bloqué: ${j.promptFeedback.blockReason}`, 422, false, 'blocked');
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
