import { useEffect, useRef, useState } from 'react';

import { SESSION_POLL_INTERVAL_MS } from '@/config/session';
import { ApiRequestError } from '@/lib/api-client';
import { conversationsService } from '@/services/conversations';
import { useSessionStore } from '@/stores/session-store';
import type { ConversationSession } from '@/types';

interface UseSessionResult {
  session: ConversationSession | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Charge une session et la rafraîchit périodiquement (jusqu'à Phase 4).
 * Le polling s'arrête quand la session est terminée/expirée/introuvable.
 */
export function useSession(sessionId: string | undefined): UseSessionResult {
  const { session, setSession } = useSessionStore();
  // Erreur rattachée à un id : évite tout reset synchrone dans l'effet.
  const [errorFor, setErrorFor] = useState<{ id: string; message: string } | null>(null);
  const stoppedRef = useRef(false);

  const current = session?.id === sessionId ? session : null;
  const error = errorFor && errorFor.id === sessionId ? errorFor.message : null;

  useEffect(() => {
    if (!sessionId) return;
    stoppedRef.current = false;
    const cancelled = { current: false };

    async function fetchOnce() {
      try {
        const next = await conversationsService.getSession(sessionId!);
        if (cancelled.current) return;
        setSession(next);
        setErrorFor(null);
        if (next.status === 'ended' || next.status === 'expired') stoppedRef.current = true;
      } catch (e) {
        if (cancelled.current) return;
        setErrorFor({
          id: sessionId!,
          message: e instanceof ApiRequestError ? e.message : 'Erreur de chargement',
        });
        if (e instanceof ApiRequestError && e.status === 404) stoppedRef.current = true;
      }
    }

    fetchOnce();
    const timer = setInterval(() => {
      if (!stoppedRef.current) fetchOnce();
    }, SESSION_POLL_INTERVAL_MS);

    return () => {
      cancelled.current = true;
      clearInterval(timer);
    };
  }, [sessionId, setSession]);

  async function refresh() {
    if (!sessionId) return;
    try {
      setSession(await conversationsService.getSession(sessionId));
      setErrorFor(null);
    } catch (e) {
      setErrorFor({
        id: sessionId,
        message: e instanceof ApiRequestError ? e.message : 'Erreur de chargement',
      });
    }
  }

  return {
    session: current,
    loading: !current && !error,
    error,
    refresh,
  };
}
