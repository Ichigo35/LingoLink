import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

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
        { backgroundColor: emphasis ? theme.tint : theme.backgroundElement },
        pressed && styles.pressed,
        style,
      ]}>
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: emphasis ? 'rgba(255,255,255,0.22)' : theme.backgroundSelected },
        ]}>
        <Ionicons name={icon} size={22} color={emphasis ? theme.tintText : theme.tint} />
      </View>
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
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
