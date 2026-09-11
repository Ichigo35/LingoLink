/**
 * Design tokens for Lingo Link — direction "Warm Bridge" (itér. 11, exploration
 * Stitch portée dans l'app : voir CLAUDE.md).
 *
 * Palette chaleureuse et humaine, pensée pour une lecture rapide entre deux
 * personnes : un seul accent corail fort, neutres à légère tonalité chaude,
 * dark mode natif. Ne jamais coder une couleur en dur dans un composant :
 * passer par `useTheme()`.
 *
 * Le corail de la maquette Stitch (#FF6B4A) est trop clair pour porter du
 * texte blanc en accessibilité (contraste ~2.8:1, sous le seuil AA 4.5:1) :
 * `brand` est une teinte plus profonde de la même famille qui passe le
 * contraste (~4.6:1) ; `brandDark` (mode sombre, texte foncé dessus) peut
 * rester plus vif.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  brand: '#D14526',
  brandDark: '#FF8F6B',
  positive: '#1FB57A',
  warning: '#F0A020',
  danger: '#E5484D',
};

export const Colors = {
  light: {
    text: '#1C1B1A',
    textSecondary: '#68615A',
    background: '#FFFFFF',
    backgroundElement: '#F5F1EC',
    backgroundSelected: '#EFE3D9',
    border: '#E7E0D8',
    tint: palette.brand,
    tintText: '#FFFFFF',
    positive: palette.positive,
    warning: palette.warning,
    danger: palette.danger,
  },
  dark: {
    text: '#F5F1EC',
    textSecondary: '#B3AC9F',
    background: '#15120F',
    backgroundElement: '#211C17',
    backgroundSelected: '#2E2620',
    border: '#332C24',
    tint: palette.brandDark,
    tintText: '#1C1006',
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
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
