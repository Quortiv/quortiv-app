import React from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';

import { useTheme } from '../design/ThemeProvider';
import { typography } from '../design/tokens';

type Variant = keyof typeof typography;
type Tone = 'default' | 'secondary' | 'muted' | 'brand' | 'danger' | 'success' | 'warning' | 'inverse' | 'onBrand';

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
  style?: TextStyle | TextStyle[] | any;
};

export function AppText({
  variant = 'body',
  tone = 'default',
  center,
  style,
  children,
  ...rest
}: AppTextProps) {
  const t = useTheme();
  const toneColor: Record<Tone, string> = {
    default: t.colors.text,
    secondary: t.colors.textSecondary,
    muted: t.colors.textMuted,
    brand: t.colors.brand,
    danger: t.colors.danger,
    success: t.colors.success,
    warning: t.colors.warning,
    inverse: t.colors.textOnInverse,
    onBrand: t.colors.textOnBrand,
  };
  return (
    <Text
      allowFontScaling
      {...rest}
      style={[
        t.typography[variant],
        { color: toneColor[tone] },
        center && styles.center,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
