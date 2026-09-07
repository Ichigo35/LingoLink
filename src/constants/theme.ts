/**
 * Design tokens for Lingo Link.
 *
 * Palette premium / minimaliste, pensée pour une lecture rapide entre deux
 * personnes : fort contraste, une seule couleur d'accent, dark mode natif.
 * Ne jamais coder une couleur en dur dans un composant : passer par `useTheme()`.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  brand: '#2F6BFF',
  brandDark: '#5B8CFF',
  positive: '#1FB57A',
  warning: '#F0A020',
  danger: '#E5484D',
};

export const Colors = {
  light: {
    text: '#0B0C0F',
    textSecondary: '#5B606B',
    background: '#FFFFFF',
    backgroundElement: '#F3F4F7',
    backgroundSelected: '#E4E7EE',
    border: '#E1E3E9',
    tint: palette.brand,
    tintText: '#FFFFFF',
    positive: palette.positive,
    warning: palette.warning,
    danger: palette.danger,
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A0A5AE',
    background: '#0A0B0D',
    backgroundElement: '#17191D',
    backgroundSelected: '#23262B',
    border: '#26292F',
    tint: palette.brandDark,
    tintText: '#0A0B0D',
    positive: palette.positive,
    warning: palette.warning,
    danger: palette.danger,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
