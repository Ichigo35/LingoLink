import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { formatLanguage, isLanguageCode } from '@/config/languages';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiRequestError } from '@/lib/api-client';
import {
  type Contact,
  type ContactProfile,
  type IncomingRequest,
  contactsService,
} from '@/services/contacts';
import { useInboxStore } from '@/stores/inbox-store';

export default function ContactsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isGuest, user } = useAuth();
  const hasUsername = !!(user as { username?: string | null } | null)?.username;
  const contactsVersion = useInboxStore((s) => s.contactsVersion);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (isGuest || !hasUsername) {
      setLoading(false);
      return;
    }
    try {
      const [c, r] = await Promise.all([
        contactsService.list(),
        contactsService.incomingRequests(),
      ]);
      setContacts(c);
      setRequests(r);
    } catch {
      /* garde l'état précédent */
    } finally {
      setLoading(false);
    }
  }, [isGuest, hasUsername]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Un évènement contact temps réel a été reçu -> rafraîchir (action async).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (contactsVersion > 0) refresh();
  }, [contactsVersion, refresh]);

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await contactsService.search(q));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function add(username: string) {
    try {
      const res = await contactsService.sendRequest(username);
      Alert.alert(res.status === 'accepted' ? 'Contact ajouté' : 'Demande envoyée');
      setQuery('');
      setResults([]);
      refresh();
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiRequestError ? e.message : 'Échec');
    }
  }

  async function respond(id: string, accept: boolean) {
    try {
      if (accept) await contactsService.acceptRequest(id);
      else await contactsService.declineRequest(id);
    } catch {
      /* ignore */
    }
    refresh();
  }

  async function startConversation(contact: Contact) {
    setStarting(contact.id);
    try {
      const { sessionId } = await contactsService.startConversation(contact.id);
      router.push(`/conversation/${sessionId}`);
    } catch (e) {
      Alert.alert(
        'Impossible de démarrer',
        e instanceof ApiRequestError ? e.message : 'Erreur',
      );
    } finally {
      setStarting(null);
    }
  }

  function confirmRemove(contact: Contact) {
    Alert.alert('Supprimer le contact ?', contact.displayName ?? contact.username ?? '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await contactsService.remove(contact.id).catch(() => {});
          refresh();
        },
      },
    ]);
  }

  if (isGuest || !hasUsername) {
    return (
      <Screen center>
        <ThemedText style={styles.h1}>Contacts</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Créez un compte et choisissez un nom d’utilisateur pour ajouter des
          contacts. Vous pouvez toujours discuter via QR code ou lien sans compte.
        </ThemedText>
        <Button label="Aller au profil" onPress={() => router.push('/profile')} style={styles.cta} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <TextInput
        value={query}
        onChangeText={runSearch}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Rechercher un nom d’utilisateur"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      />

      {searching ? <ActivityIndicator color={theme.tint} style={styles.pad} /> : null}
      {results.map((u) => (
        <View key={u.id} style={[styles.row, { borderColor: theme.border }]}>
          <View style={styles.rowMain}>
            <ThemedText style={styles.name}>{u.displayName || u.username}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sub}>
              @{u.username}
              {u.preferredLanguage && isLanguageCode(u.preferredLanguage)
                ? ` · ${formatLanguage(u.preferredLanguage)}`
                : ''}
            </ThemedText>
          </View>
          <Button label="Ajouter" variant="secondary" onPress={() => add(u.username ?? '')} />
        </View>
      ))}

      {requests.length > 0 ? (
        <>
          <ThemedText style={styles.section}>Demandes reçues</ThemedText>
          {requests.map((r) => (
            <View key={r.id} style={[styles.row, { borderColor: theme.border }]}>
              <View style={styles.rowMain}>
                <ThemedText style={styles.name}>
                  {r.from.displayName || r.from.username}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sub}>
                  @{r.from.username}
                </ThemedText>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => respond(r.id, true)} hitSlop={8}>
                  <ThemedText style={[styles.accept, { color: theme.positive }]}>Accepter</ThemedText>
                </Pressable>
                <Pressable onPress={() => respond(r.id, false)} hitSlop={8}>
                  <ThemedText style={[styles.decline, { color: theme.textSecondary }]}>
                    Refuser
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <ThemedText style={styles.section}>Mes contacts</ThemedText>
      {loading ? (
        <ActivityIndicator color={theme.tint} style={styles.pad} />
      ) : contacts.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.pad}>
          Aucun contact pour l’instant.
        </ThemedText>
      ) : (
        contacts.map((contact) => (
          <Pressable
            key={contact.id}
            onLongPress={() => confirmRemove(contact)}
            style={[styles.row, { borderColor: theme.border }]}>
            <View style={styles.rowMain}>
              <View style={styles.nameRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: contact.isOnline ? theme.positive : theme.border },
                  ]}
                />
                <ThemedText style={styles.name}>
                  {contact.displayName || contact.username}
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.sub}>
                {contact.preferredLanguage && isLanguageCode(contact.preferredLanguage)
                  ? formatLanguage(contact.preferredLanguage)
                  : `@${contact.username}`}
                {contact.isOnline ? ' · en ligne' : ''}
              </ThemedText>
            </View>
            <Button
              label="Démarrer"
              onPress={() => startConversation(contact)}
              loading={starting === contact.id}
            />
          </Pressable>
        ))
      )}
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        Appui long sur un contact pour le supprimer.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '700' },
  center: { textAlign: 'center', lineHeight: 22 },
  cta: { marginTop: Spacing.four, alignSelf: 'stretch' },
  input: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  section: { fontSize: 16, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  accept: { fontSize: 15, fontWeight: '600' },
  decline: { fontSize: 15 },
  pad: { marginVertical: Spacing.three },
  hint: { fontSize: 12, marginTop: Spacing.three, textAlign: 'center' },
});
