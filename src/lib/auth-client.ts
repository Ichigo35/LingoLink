/**
 * Client d'authentification (Better Auth).
 *
 * - **Natif (iOS/Android)** : plugin `@better-auth/expo` — cookies stockés dans
 *   `expo-secure-store`, OAuth via deep link `lingolink://`.
 * - **Web** : pas de plugin Expo. Auth par **jeton bearer** (le web est servi
 *   depuis un autre domaine que l'API → cookies cross-site peu fiables,
 *   surtout Safari). Le jeton est renvoyé par le serveur (`set-auth-token`,
 *   plugin `bearer`) et conservé en `localStorage`.
 *
 * L'app ne dépend pas directement de Better Auth : passer par `services/auth`.
 */

import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields, anonymousClient } from 'better-auth/client/plugins';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/config/env';

const isWeb = Platform.OS === 'web';
const BEARER_KEY = 'lingolink_bearer';

function readBearer(): string | null {
  if (!isWeb || typeof localStorage === 'undefined') return null;
  return localStorage.getItem(BEARER_KEY);
}

function writeBearer(token: string | null) {
  if (!isWeb || typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(BEARER_KEY, token);
  else localStorage.removeItem(BEARER_KEY);
}

export const authClient = createAuthClient({
  baseURL: env.apiBaseUrl,
  fetchOptions: isWeb
    ? {
        auth: { type: 'Bearer', token: () => readBearer() ?? '' },
        onSuccess: (ctx) => {
          const token = ctx.response.headers.get('set-auth-token');
          if (token) writeBearer(token);
          if (String(ctx.request.url).includes('/sign-out')) writeBearer(null);
        },
      }
    : undefined,
  plugins: [
    ...(isWeb
      ? []
      : [
          expoClient({
            scheme: 'lingolink',
            storagePrefix: 'lingolink',
            storage: SecureStore,
          }),
        ]),
    anonymousClient(),
    inferAdditionalFields({
      user: {
        username: { type: 'string', required: false },
        preferredLanguage: { type: 'string', required: false },
      },
    }),
  ],
});

export type SessionUser = typeof authClient.$Infer.Session.user;

/** Cookie de session à passer en en-tête `Cookie` (natif). `null` sur le web. */
export async function getAuthCookie(): Promise<string | null> {
  if (isWeb) return null;
  try {
    return (await authClient.getCookie()) ?? null;
  } catch {
    return null;
  }
}

/** Jeton bearer (web uniquement) à passer en `Authorization: Bearer`. */
export function getBearerToken(): string | null {
  return readBearer();
}
