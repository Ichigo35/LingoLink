import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Préfixe texte court (ex. "G" pour Google) — pour une icône, préférer `iconName`. */
  icon?: string;
  /** Icône vectorielle Ionicons affichée avant le texte. */
  iconName?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconName,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const bg =
    variant === 'primary'
      ? theme.tint
      : variant === 'danger'
        ? theme.danger
        : variant === 'secondary'
          ? theme.backgroundElement
          : 'transparent';

  const fg =
    variant === 'primary' || variant === 'danger' ? theme.tintText : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg },
        variant === 'ghost' && { borderWidth: 1, borderColor: theme.border },
        (pressed || disabled || loading) && styles.dimmed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : iconName ? (
        <View style={styles.iconRow}>
          <Ionicons name={iconName} size={18} color={fg} />
          <ThemedText style={[styles.label, { color: fg }]}>{label}</ThemedText>
        </View>
      ) : (
        <ThemedText style={[styles.label, { color: fg }]}>
          {icon ? `${icon}  ${label}` : label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dimmed: {
    opacity: 0.6,
  },
});
