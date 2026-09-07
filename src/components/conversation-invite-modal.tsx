import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { formatLanguage, isLanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { conversationsService } from '@/services/conversations';
import { useInboxStore } from '@/stores/inbox-store';
import { useSessionStore } from '@/stores/session-store';

/**
 * Modale globale : « X souhaite démarrer une conversation ». Affichée dès qu'une
 * invitation arrive dans la boîte de réception (contact ou proximité).
 */
export function ConversationInviteModal() {
  const theme = useTheme();
  const router = useRouter();
  const invite = useInboxStore((s) => s.pendingInvite);
  const clearInvite = useInboxStore((s) => s.clearInvite);
  const setSession = useSessionStore((s) => s.setSession);
  const [joining, setJoining] = useState(false);

  if (!invite) return null;

  const name = invite.from.displayName || invite.from.username || 'Quelqu’un';
  // Depuis le point de vue du destinataire : sa langue = participantLanguage.
  const mine = invite.participantLanguage;
  const theirs = invite.creatorLanguage;

  async function accept() {
    if (!invite) return;
    setJoining(true);
    try {
      const session = await conversationsService.joinByToken(invite.connectionToken);
      setSession(session);
      clearInvite();
      router.push(`/conversation/${session.id}`);
    } catch {
      clearInvite();
    } finally {
      setJoining(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={clearInvite}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ThemedText style={styles.title}>{name} souhaite démarrer une conversation</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.langs}>
            {isLanguageCode(theirs) ? formatLanguage(theirs) : theirs}
            {'  ↔  '}
            {isLanguageCode(mine) ? formatLanguage(mine) : mine}
          </ThemedText>
          <Button label="Rejoindre" onPress={accept} loading={joining} style={styles.cta} />
          <Button label="Refuser" variant="ghost" onPress={clearInvite} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: { fontSize: 18, fontWeight: '700' },
  langs: { fontSize: 15, marginBottom: Spacing.two },
  cta: { marginTop: Spacing.two },
});
