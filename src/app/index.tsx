import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

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
  // Web = version « rejoindre + converser » uniquement (cf. join HTTPS).
  const webJoinOnly = Platform.OS === 'web';
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
              hitSlop={8}
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
              <Ionicons name="person-circle-outline" size={22} color={theme.text} />
              <ThemedText themeColor="textSecondary" style={styles.headerBtnLabel}>
                {t('nav.profile')}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.settings')}
              hitSlop={8}
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}>
              <Ionicons name="settings-outline" size={22} color={theme.text} />
              <ThemedText themeColor="textSecondary" style={styles.headerBtnLabel}>
                {t('nav.settings')}
              </ThemedText>
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
          accessibilityRole="button"
          onPress={() => router.push(`/conversation/${activeSession.id}`)}
          style={({ pressed }) => [
            styles.resume,
            { backgroundColor: theme.tint },
            pressed && styles.resumePressed,
          ]}>
          <ThemedText style={[styles.resumeText, { color: theme.tintText }]}>
            {t('home.resume')}
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        {!webJoinOnly ? (
          <ActionCard
            icon="add-circle-outline"
            title={t('home.newConversation')}
            subtitle={t('home.newConversation.sub')}
            emphasis
            onPress={() => router.push('/new-conversation')}
            style={styles.gridCard}
          />
        ) : null}
        <ActionCard
          icon={webJoinOnly ? 'link-outline' : 'camera-outline'}
          title={webJoinOnly ? t('home.joinWeb') : t('home.scan')}
          subtitle={webJoinOnly ? t('home.joinWeb.sub') : t('home.scan.sub')}
          emphasis={webJoinOnly}
          onPress={() => router.push('/scan')}
          style={styles.gridCard}
        />
        {!webJoinOnly ? (
          <>
            <ActionCard
              icon="people-outline"
              title={t('home.contacts')}
              subtitle={t('home.contacts.sub')}
              onPress={() => router.push('/contacts')}
              style={styles.gridCard}
            />
            <ActionCard
              icon="location-outline"
              title={t('home.nearby')}
              subtitle={t('home.nearby.sub')}
              onPress={() => router.push('/nearby')}
              style={styles.gridCard}
            />
          </>
        ) : null}
      </View>

      {!webJoinOnly ? (
        <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>
          {t('home.footer')}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, marginTop: Spacing.two, marginBottom: Spacing.three },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: Spacing.three },
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: Radius.sm,
  },
  headerBtnPressed: { opacity: 0.6 },
  headerBtnLabel: { fontSize: 11 },
  tagline: { fontSize: 16, lineHeight: 22 },
  identity: { fontSize: 13 },
  resume: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  resumePressed: { opacity: 0.85 },
  resumeText: { fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  gridCard: { flexBasis: '46%', flexGrow: 1 },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.four,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
