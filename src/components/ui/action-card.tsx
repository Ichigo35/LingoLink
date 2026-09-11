import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  emphasis?: boolean;
  style?: ViewStyle;
}

export function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
  emphasis = false,
  style,
}: ActionCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: emphasis ? theme.tint : theme.backgroundElement,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
        style,
      ]}>
      <Ionicons
        name={icon}
        size={26}
        color={emphasis ? theme.tintText : theme.text}
        style={styles.icon}
      />
      <ThemedText
        style={[styles.title, { color: emphasis ? theme.tintText : theme.text }]}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText
          style={[
            styles.subtitle,
            { color: emphasis ? theme.tintText : theme.textSecondary },
          ]}>
          {subtitle}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
});
