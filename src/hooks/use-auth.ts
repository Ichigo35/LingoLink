import type { LanguageCode } from '@/config/languages';
import { authClient, type SessionUser } from '@/lib/auth-client';
import { isGuest } from '@/services/auth';

export interface AuthSnapshot {
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  user: SessionUser | null;
  /** true si le profil doit encore être complété (langue préférée manquante). */
  needsOnboarding: boolean;
  preferredLanguage: LanguageCode | null;
}

export function useAuth(): AuthSnapshot {
  const { data, isPending } = authClient.useSession();
  const user = (data?.user ?? null) as SessionUser | null;
  const preferredLanguage =
    ((user as { preferredLanguage?: string | null } | null)?.preferredLanguage as
      | LanguageCode
      | null) ?? null;

  return {
    isLoading: isPending,
    isAuthenticated: Boolean(user),
    isGuest: isGuest(user),
    user,
    needsOnboarding: Boolean(user) && !preferredLanguage,
    preferredLanguage,
  };
}
