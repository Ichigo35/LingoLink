import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionCard } from '@/components/ui/action-card';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSessionStore } from '@/stores/session-store';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { isGuest, user } = useAuth();
  const activeSession = useSessionStore((s) => s.session);
  const resumable = activeSession && (activeSession.status === 'active' || activeSession.status === 'waiting');
  const username = (user as { username?: string | null } | null)?.username;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <ThemedText style={styles.logo}>Lingo Link</ThemedText>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.profile')}
              onPress={() => router.push('/profile')}>
              <ThemedText style={styles.headerIcon}>👤</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.settings')}
              onPress={() => router.push('/settings')}>
              <ThemedText style={styles.headerIcon}>⚙️</ThemedText>
            </Pressable>
          </View>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.tagline}>
          {t('home.tagline')}
        </ThemedText>
        {isGuest ? (
          <ThemedText themeColor="textSecondary" style={styles.identity}>
            {t('home.guest')}
          </ThemedText>
        ) : username ? (
          <ThemedText themeColor="textSecondary" style={styles.identity}>
            @{username}
          </ThemedText>
        ) : null}
      </View>

      {resumable ? (
        <Pressable
          onPress={() => router.push(`/conversation/${activeSession.id}`)}
          style={[styles.resume, { backgroundColor: theme.tint }]}>
          <ThemedText style={[styles.resumeText, { color: theme.tintText }]}>
            {t('home.resume')}
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        <ActionCard
          icon="⚡"
          title={t('home.newConversation')}
          subtitle={t('home.newConversation.sub')}
          emphasis
          onPress={() => router.push('/new-conversation')}
        />
        <ActionCard
          icon="📷"
          title={t('home.scan')}
          subtitle={t('home.scan.sub')}
          onPress={() => router.push('/scan')}
        />
        <ActionCard
          icon="👥"
          title={t('home.contacts')}
          subtitle={t('home.contacts.sub')}
          onPress={() => router.push('/contacts')}
        />
        <ActionCard
          icon="📍"
          title={t('home.nearby')}
          subtitle={t('home.nearby.sub')}
          onPress={() => router.push('/nearby')}
        />
      </View>

      <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>
        {t('home.footer')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, marginTop: Spacing.two, marginBottom: Spacing.three },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 30, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: Spacing.three },
  headerIcon: { fontSize: 22 },
  tagline: { fontSize: 16, lineHeight: 22 },
  identity: { fontSize: 13 },
  resume: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  resumeText: { fontSize: 16, fontWeight: '700' },
  grid: { gap: Spacing.three },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.four,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
