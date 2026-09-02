/**
 * Quortiv design tokens.
 * Brand marks: deep navy #1B2333 (structure) + electric blue #2E5BFF (action).
 * Every value below is consumed through `useTheme()` — never hardcode colours in screens.
 */
import { Platform } from 'react-native';

export const palette = {
  navy900: '#0C1220',
  navy800: '#131B2B',
  navy700: '#1B2333',
  navy600: '#243043',
  navy500: '#33415A',
  blue700: '#1D3FCC',
  blue600: '#2449E6',
  blue500: '#2E5BFF',
  blue400: '#5C81FF',
  blue300: '#93AAFF',
  blue100: '#E4EAFF',
  blue50: '#F2F5FF',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  white: '#FFFFFF',
  emerald: '#0FA97C',
  emeraldSoft: '#E6F7F1',
  amber: '#D9880B',
  amberSoft: '#FEF4E4',
  rose: '#E2445C',
  roseSoft: '#FDECEE',
  violet: '#7C5CFF',
  violetSoft: '#F1EDFF',
};

const lightColors = {
  bg: palette.slate50,
  bgElevated: palette.white,
  surface: palette.white,
  surfaceMuted: palette.slate100,
  surfaceSunken: '#EEF2F8',
  surfaceInverse: palette.navy700,
  text: palette.navy700,
  textSecondary: palette.slate600,
  textMuted: palette.slate500,
  textOnInverse: palette.white,
  textOnBrand: palette.white,
  brand: palette.blue500,
  brandStrong: palette.blue600,
  brandSoft: palette.blue50,
  brandSoftStrong: palette.blue100,
  border: palette.slate200,
  borderStrong: palette.slate300,
  divider: '#EDF1F7',
  success: palette.emerald,
  successSoft: palette.emeraldSoft,
  warning: palette.amber,
  warningSoft: palette.amberSoft,
  danger: palette.rose,
  dangerSoft: palette.roseSoft,
  accent: palette.violet,
  accentSoft: palette.violetSoft,
  overlay: 'rgba(12,18,32,0.45)',
  skeleton: palette.slate200,
  tabBar: 'rgba(255,255,255,0.94)',
};

const darkColors: typeof lightColors = {
  bg: palette.navy900,
  bgElevated: palette.navy800,
  surface: palette.navy800,
  surfaceMuted: palette.navy700,
  surfaceSunken: '#0A0F1A',
  surfaceInverse: palette.white,
  text: '#F2F5FA',
  textSecondary: '#AFBACD',
  textMuted: '#8593AA',
  textOnInverse: palette.navy900,
  textOnBrand: palette.white,
  brand: palette.blue400,
  brandStrong: palette.blue500,
  brandSoft: 'rgba(46,91,255,0.16)',
  brandSoftStrong: 'rgba(46,91,255,0.28)',
  border: '#26314A',
  borderStrong: '#354160',
  divider: '#1E2739',
  success: '#34D3A4',
  successSoft: 'rgba(15,169,124,0.18)',
  warning: '#F0B14A',
  warningSoft: 'rgba(217,136,11,0.18)',
  danger: '#FF7386',
  dangerSoft: 'rgba(226,68,92,0.2)',
  accent: '#9C86FF',
  accentSoft: 'rgba(124,92,255,0.2)',
  overlay: 'rgba(5,8,14,0.66)',
  skeleton: '#26314A',
  tabBar: 'rgba(19,27,43,0.94)',
};

/** 4pt base grid. Use these only — no magic numbers in screens. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

const fontFamily = Platform.select({
  ios: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  android: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    semibold: 'sans-serif-medium',
    bold: 'sans-serif',
  },
  default: {
    regular: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    medium: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    semibold: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    bold: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
})!;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.6, fontFamily: fontFamily.bold },
  title1: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.4, fontFamily: fontFamily.bold },
  title2: { fontSize: 19, lineHeight: 25, fontWeight: '700' as const, letterSpacing: -0.2, fontFamily: fontFamily.semibold },
  title3: { fontSize: 16.5, lineHeight: 22, fontWeight: '600' as const, fontFamily: fontFamily.semibold },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, fontFamily: fontFamily.regular },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const, fontFamily: fontFamily.medium },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, fontFamily: fontFamily.regular },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, fontFamily: fontFamily.medium },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, fontFamily: fontFamily.medium },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const, letterSpacing: 0.3, fontFamily: fontFamily.medium },
} as const;

export const layout = {
  /** Content never stretches past this width — keeps tablets & foldables centred. */
  maxContentWidth: 620,
  gutter: spacing.xl,
  minTouch: 48,
  tabBarHeight: 74,
  headerHeight: 56,
} as const;

const lightShadows: Record<string, any> = {
  none: {},
  xs: {
    shadowColor: palette.navy900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: palette.navy900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  md: {
    shadowColor: palette.navy900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 7,
  },
  brand: {
    shadowColor: palette.blue500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 9,
  },
} as const;

const darkShadows: Record<string, any> = {
  none: {},
  xs: { ...lightShadows.xs, shadowOpacity: 0.3, shadowColor: '#000' },
  sm: { ...lightShadows.sm, shadowOpacity: 0.4, shadowColor: '#000' },
  md: { ...lightShadows.md, shadowOpacity: 0.5, shadowColor: '#000' },
  brand: { ...lightShadows.brand, shadowOpacity: 0.42 },
};

export type ThemeColors = typeof lightColors;
export type Theme = {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  layout: typeof layout;
  shadows: typeof lightShadows;
};

export const themes: Record<'light' | 'dark', Theme> = {
  light: {
    mode: 'light',
    colors: lightColors,
    spacing,
    radius,
    typography,
    layout,
    shadows: lightShadows,
  },
  dark: {
    mode: 'dark',
    colors: darkColors,
    spacing,
    radius,
    typography,
    layout,
    shadows: darkShadows,
  },
};

/** Folder / tag colour choices exposed to users. */
export const swatches = [
  '#2E5BFF', '#0FA97C', '#D9880B', '#E2445C', '#7C5CFF',
  '#0EA5E9', '#DB2777', '#65A30D', '#64748B', '#1B2333',
];

export const sourceMeta: Record<string, { icon: string; label: string; color: keyof ThemeColors }> = {
  recording: { icon: 'mic', label: 'Enregistrement', color: 'brand' },
  audio: { icon: 'musical-notes', label: 'Audio importé', color: 'accent' },
  video: { icon: 'videocam', label: 'Vidéo', color: 'accent' },
  document: { icon: 'document-text', label: 'Document', color: 'warning' },
  text: { icon: 'create', label: 'Texte', color: 'success' },
  url: { icon: 'link', label: 'Lien web', color: 'brand' },
  meeting: { icon: 'people', label: 'Réunion', color: 'brand' },
};
