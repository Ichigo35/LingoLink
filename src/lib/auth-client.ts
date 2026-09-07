/**
 * Client d'authentification (Better Auth + plugin Expo).
 *
 * - Stockage sécurisé des cookies de session via `expo-secure-store`.
 * - Mode invité : `authClient.signIn.anonymous()`.
 * - Google : `authClient.signIn.social({ provider: 'google', callbackURL: '/' })`.
 *
 * L'app ne dépend pas directement de Better Auth : passer par `services/auth`.
 */

import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields, anonymousClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

import { env } from '@/config/env';

export const authClient = createAuthClient({
  baseURL: env.apiBaseUrl,
  plugins: [
    expoClient({
      scheme: 'lingolink',
      storagePrefix: 'lingolink',
      storage: SecureStore,
    }),
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
