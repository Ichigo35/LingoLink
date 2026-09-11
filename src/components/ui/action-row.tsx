import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  /** Option mise en avant : bordure d'accent + badge. */
  recommended?: boolean;
  recommendedLabel?: string;
  style?: ViewStyle;
}

export function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  recommended = false,
  recommendedLabel,
  style,
}: ActionRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: recommended ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: recommended ? theme.tint : 'transparent',
          borderWidth: recommended ? 2 : 0,
        },
        pressed && styles.pressed,
        style,
      ]}>
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: recommended ? theme.tint : theme.backgroundSelected },
        ]}>
        <Ionicons name={icon} size={22} color={recommended ? theme.tintText : theme.tint} />
      </View>
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {recommended && recommendedLabel ? (
            <View style={[styles.badge, { backgroundColor: theme.tint }]}>
              <ThemedText style={[styles.badgeText, { color: theme.tintText }]} numberOfLines={1}>
                {recommendedLabel}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    flexGrow: 1,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    flexShrink: 0,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
