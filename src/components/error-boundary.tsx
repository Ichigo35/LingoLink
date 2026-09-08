import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Spacing } from '@/constants/theme';
import { translate } from '@/i18n';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Attrape les erreurs de rendu pour éviter un écran blanc / redbox en prod. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // Palette claire par défaut (le contexte thème peut ne pas être dispo ici).
    const c = Colors.light;
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <ThemedText style={styles.title}>{translate('error.title')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          {translate('error.body')}
        </ThemedText>
        <Button
          label={translate('common.retry')}
          onPress={() => this.setState({ error: null })}
          style={styles.cta}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  title: { fontSize: 22, fontWeight: '700' },
  text: { textAlign: 'center' },
  cta: { marginTop: Spacing.four, alignSelf: 'stretch' },
});
