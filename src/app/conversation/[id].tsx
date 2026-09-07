import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { formatLanguage, isLanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveSession } from '@/hooks/use-live-session';
import { useTheme } from '@/hooks/use-theme';
import { conversationsService } from '@/services/conversations';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'En attente du participant',
  connecting: 'Connexion…',
  active: 'Conversation active',
  ended: 'Conversation terminée',
  expired: 'Session expirée',
};

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { session, loading, error, connected, peerOnline } = useLiveSession(id, user?.id);

  if (loading && !session) {
    return (
      <Screen center>
        <ActivityIndicator color={theme.tint} />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen center>
        <ThemedText style={styles.h1}>Session introuvable</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {error ?? 'Cette conversation n’existe plus.'}
        </ThemedText>
        <Button label="Retour à l’accueil" onPress={() => router.replace('/')} style={styles.cta} />
      </Screen>
    );
  }

  const isCreator = user?.id === session.creatorId;
  const myLang = isCreator ? session.creatorLanguage : session.participantLanguage;
  const otherLang = isCreator ? session.participantLanguage : session.creatorLanguage;
  const ended = session.status === 'ended' || session.status === 'expired';
  const joined = session.status === 'active' && !!session.participantId;

  const sessionId = session.id;
  const leave = async () => {
    try {
      if (isCreator) await conversationsService.endSession(sessionId);
      else await conversationsService.leaveSession(sessionId);
    } catch {
      /* ignore */
    }
    router.replace('/');
  };

  function confirmLeave() {
    Alert.alert(
      isCreator ? 'Terminer la conversation ?' : 'Quitter la conversation ?',
      isCreator
        ? 'La session sera fermée pour les deux participants.'
        : 'Vous pourrez rejoindre une autre conversation ensuite.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: isCreator ? 'Terminer' : 'Quitter', style: 'destructive', onPress: leave },
      ],
    );
  }

  return (
    <Screen scroll>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: ended ? theme.danger : joined ? theme.positive : theme.warning },
            ]}
          />
          <ThemedText style={styles.statusText}>
            {STATUS_LABEL[session.status] ?? session.status}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.rtBadge}>
            {connected ? '● temps réel' : '○ hors ligne'}
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.langs}>
          {isLanguageCode(myLang) ? formatLanguage(myLang) : myLang} (vous)
          {'  ↔  '}
          {isLanguageCode(otherLang) ? formatLanguage(otherLang) : otherLang}
        </ThemedText>
      </View>

      <View style={styles.participants}>
        <ParticipantRow label="Vous" online themeColor={theme.positive} />
        <ParticipantRow
          label="L’autre personne"
          online={peerOnline}
          themeColor={peerOnline ? theme.positive : theme.textSecondary}
        />
      </View>

      <View style={[styles.note, { borderColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={styles.noteText}>
          {peerOnline
            ? 'Les deux téléphones sont connectés. Le micro et la traduction en direct arrivent en Phase 6.'
            : joined
              ? 'L’autre personne a rejoint mais n’est pas connectée pour le moment.'
              : 'Dès que l’autre personne rejoint, la conversation démarre ici.'}
        </ThemedText>
      </View>

      {ended ? (
        <Button label="Retour à l’accueil" onPress={() => router.replace('/')} style={styles.cta} />
      ) : (
        <Button
          label={isCreator ? 'Terminer la conversation' : 'Quitter'}
          variant="danger"
          onPress={confirmLeave}
          style={styles.cta}
        />
      )}
    </Screen>
  );
}

function ParticipantRow({
  label,
  online,
  themeColor,
}: {
  label: string;
  online: boolean;
  themeColor: string;
}) {
  return (
    <View style={styles.participantRow}>
      <View style={[styles.dot, { backgroundColor: themeColor }]} />
      <ThemedText>{label}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.participantState}>
        {online ? 'connecté' : 'absent'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700' },
  center: { textAlign: 'center' },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statusText: { fontSize: 17, fontWeight: '600' },
  rtBadge: { fontSize: 12, marginLeft: 'auto' },
  langs: { fontSize: 15 },
  participants: { marginTop: Spacing.four, gap: Spacing.three },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  participantState: { marginLeft: 'auto', fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  note: {
    marginTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  noteText: { fontSize: 13, lineHeight: 19 },
  cta: { marginTop: Spacing.five },
});
