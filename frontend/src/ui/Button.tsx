import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth = true,
  style,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: any;
  iconRight?: any;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const heights: Record<Size, number> = { sm: 38, md: 48, lg: 54 };
  const paddings: Record<Size, number> = { sm: t.spacing.md, md: t.spacing.xl, lg: t.spacing.xxl };
  const textVariant = size === 'sm' ? ('label' as const) : ('bodyMedium' as const);

  const skins: Record<Variant, { bg: string; fg: string; border?: string; shadow?: object }> = {
    primary: { bg: t.colors.brand, fg: t.colors.textOnBrand, shadow: t.shadows.brand },
    secondary: { bg: t.colors.surface, fg: t.colors.text, border: t.colors.borderStrong, shadow: t.shadows.xs },
    tonal: { bg: t.colors.brandSoft, fg: t.colors.brand },
    ghost: { bg: 'transparent', fg: t.colors.textSecondary },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger },
    inverse: { bg: t.colors.surfaceInverse, fg: t.colors.textOnInverse },
  };
  const skin = skins[variant];

  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: paddings[size],
          borderRadius: t.radius.md,
          backgroundColor: skin.bg,
          borderWidth: skin.border ? 1 : 0,
          borderColor: skin.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        variant === 'primary' && !isDisabled ? skin.shadow : null,
        variant === 'secondary' ? skin.shadow : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={skin.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={skin.fg} /> : null}
          <AppText variant={textVariant} numberOfLines={1} style={{ color: skin.fg }}>
            {label}
          </AppText>
          {iconRight ? (
            <Ionicons name={iconRight} size={size === 'sm' ? 16 : 19} color={skin.fg} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  variant = 'ghost',
  badge,
  disabled,
  testID,
  accessibilityLabel,
  style,
}: {
  icon: any;
  onPress?: () => void;
  size?: number;
  color?: string;
  variant?: 'ghost' | 'soft' | 'solid' | 'outline';
  badge?: number;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const skins = {
    ghost: { bg: 'transparent', fg: color || t.colors.textSecondary, border: 'transparent' },
    soft: { bg: t.colors.surfaceMuted, fg: color || t.colors.text, border: 'transparent' },
    solid: { bg: t.colors.brand, fg: color || t.colors.textOnBrand, border: 'transparent' },
    outline: { bg: t.colors.surface, fg: color || t.colors.text, border: t.colors.border },
  } as const;
  const skin = skins[variant];

  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          width: t.layout.minTouch - 4,
          height: t.layout.minTouch - 4,
          borderRadius: t.radius.sm,
          backgroundColor: skin.bg,
          borderWidth: skin.border === 'transparent' ? 0 : 1,
          borderColor: skin.border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={skin.fg} />
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: t.colors.danger }]}>
          <AppText variant="micro" style={{ color: '#fff', fontSize: 10 }}>
            {badge > 9 ? '9+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
});
