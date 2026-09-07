import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';

interface ComingSoonProps {
  icon: string;
  title: string;
  description: string;
  phase: string;
}

/** Écran placeholder pour les fonctionnalités des phases suivantes. */
export function ComingSoon({ icon, title, description, phase }: ComingSoonProps) {
  return (
    <Screen center>
      <ThemedText style={styles.icon}>{icon}</ThemedText>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.description}>
        {description}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.phase}>
        Prévu en {phase}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 44,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  phase: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.three,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
