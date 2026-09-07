import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionCard } from '@/components/ui/action-card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <ThemedText style={styles.logo}>Lingo Link</ThemedText>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profil"
              onPress={() => router.push('/profile')}>
              <ThemedText style={styles.headerIcon}>👤</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Paramètres"
              onPress={() => router.push('/settings')}>
              <ThemedText style={styles.headerIcon}>⚙️</ThemedText>
            </Pressable>
          </View>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.tagline}>
          Parlez naturellement. Comprenez-vous instantanément.
        </ThemedText>
      </View>

      <View style={styles.grid}>
        <ActionCard
          icon="⚡"
          title="Nouvelle conversation"
          subtitle="Créer une session et inviter quelqu'un"
          emphasis
          onPress={() => router.push('/new-conversation')}
        />
        <ActionCard
          icon="📷"
          title="Scanner un QR"
          subtitle="Rejoindre une conversation existante"
          onPress={() => router.push('/scan')}
        />
        <ActionCard
          icon="👥"
          title="Mes contacts"
          subtitle="Vos interlocuteurs réguliers"
          onPress={() => router.push('/contacts')}
        />
        <ActionCard
          icon="📍"
          title="Personnes à proximité"
          subtitle="Découvrir qui est disponible autour de vous"
          onPress={() => router.push('/nearby')}
        />
      </View>

      <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>
        Ouvrir → Connecter → Parler
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 30,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  headerIcon: {
    fontSize: 22,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 22,
  },
  grid: {
    gap: Spacing.three,
  },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.four,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
