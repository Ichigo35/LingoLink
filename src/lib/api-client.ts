/**
 * Client HTTP minimal vers le backend Lingo Link (Cloudflare Worker).
 *
 * Toute la logique sensible (appels Gemini, création/validation de token de
 * session, accès base de données) passe par le backend. L'app ne parle jamais
 * directement à Neon ni à Gemini.
 */

import { env } from '@/config/env';
import { getBearerToken } from '@/lib/auth-client';

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.status = error.status;
    this.code = error.code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Jeton d'accès backend, injecté par la couche auth. */
  accessToken?: string | null;
  /** Cookie de session Better Auth (obtenu via authClient.getCookie()). */
  cookie?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    accessToken,
    cookie,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    // Web : le cookie de session ne peut pas être posé manuellement (en-tête
    // interdit) ni envoyé cross-site de façon fiable → jeton bearer.
    const bearer = accessToken ?? getBearerToken();
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new ApiRequestError({
        status: response.status,
        code: payload?.code ?? 'unknown_error',
        message: payload?.message ?? `Erreur ${response.status}`,
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiRequestError({ status: 0, code: 'timeout', message: 'Délai dépassé' });
    }
    throw new ApiRequestError({
      status: 0,
      code: 'network_error',
      message: 'Pas de connexion au serveur',
    });
  } finally {
    clearTimeout(timeout);
  }
}
