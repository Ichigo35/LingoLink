import { useNetworkState } from 'expo-network';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Bandeau discret quand l'appareil est hors ligne. */
export function OfflineBanner() {
  const theme = useTheme();
  const state = useNetworkState();
  const offline = state.isConnected === false || state.isInternetReachable === false;

  if (!offline) return null;
  return (
    <SafeAreaView edges={['top']} style={[styles.wrap, { backgroundColor: theme.danger }]}>
      <ThemedText style={styles.text}>Hors ligne — reconnexion automatique</ThemedText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  text: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: Spacing.one,
  },
});
