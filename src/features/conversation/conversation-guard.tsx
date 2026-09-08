/**
 * Garde « une seule conversation à la fois ».
 *
 * Tant qu'une session est en cours (`waiting` / `connecting` / `active`), toute
 * tentative de démarrer ou rejoindre une AUTRE conversation passe par une
 * confirmation « Quitter la conversation en cours pour accéder à la nouvelle ? ».
 * « Oui » → on quitte proprement l'actuelle (end si créateur, leave sinon) puis
 * on exécute l'action ; « Non » → rien.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/i18n';
import { conversationsService } from '@/services/conversations';
import { useSessionStore } from '@/stores/session-store';

type GuardFn = (proceed: () => void) => void;

const GuardContext = createContext<GuardFn>((proceed) => proceed());

/** `const guard = useConversationGuard(); guard(() => router.push(...))`. */
export function useConversationGuard(): GuardFn {
  return useContext(GuardContext);
}

const BUSY_STATUSES = ['waiting', 'connecting', 'active'];

export function ConversationGuardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const t = useT();
  const [proceed, setProceed] = useState<null | (() => void)>(null);
  const [leaving, setLeaving] = useState(false);

  const guard = useCallback<GuardFn>((next) => {
    const current = useSessionStore.getState().session;
    const busy = !!current && BUSY_STATUSES.includes(current.status);
    if (!busy) {
      next();
      return;
    }
    // On stocke la fonction (setState(fn) exécuterait la fonction → double appel).
    setProceed(() => next);
  }, []);

  const cancel = useCallback(() => setProceed(null), []);

  const confirm = useCallback(async () => {
    if (leaving) return;
    const next = proceed;
    const current = useSessionStore.getState().session;
    setLeaving(true);
    try {
      if (current) {
        const isCreator = user?.id === current.creatorId;
        try {
          await (isCreator
            ? conversationsService.endSession(current.id)
            : conversationsService.leaveSession(current.id));
        } catch {
          /* best-effort : on continue même si la sortie échoue côté réseau */
        }
        useSessionStore.getState().clear();
      }
    } finally {
      setLeaving(false);
      setProceed(null);
    }
    next?.();
  }, [leaving, proceed, user?.id]);

  return (
    <GuardContext.Provider value={guard}>
      {children}
      <ConfirmDialog
        visible={proceed != null}
        title={t('guard.leaveCurrentTitle')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.no')}
        destructive
        onConfirm={confirm}
        onCancel={cancel}
      />
    </GuardContext.Provider>
  );
}
