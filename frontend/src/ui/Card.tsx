import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';

export function Card({
  children,
  onPress,
  style,
  padded = true,
  variant = 'default',
  testID,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  variant?: 'default' | 'flat' | 'outlined' | 'brand';
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const skin = {
    default: { bg: t.colors.surface, border: t.colors.border, shadow: t.shadows.xs },
    flat: { bg: t.colors.surfaceMuted, border: 'transparent', shadow: t.shadows.none },
    outlined: { bg: 'transparent', border: t.colors.border, shadow: t.shadows.none },
    brand: { bg: t.colors.brandSoft, border: t.colors.brandSoftStrong, shadow: t.shadows.none },
  }[variant];

  const content = (
    <View
      style={[
        {
          backgroundColor: skin.bg,
          borderRadius: t.radius.md,
          borderWidth: skin.border === 'transparent' ? 0 : StyleSheet.hairlineWidth,
          borderColor: skin.border,
          padding: padded ? t.spacing.lg : 0,
          overflow: 'hidden',
        },
        skin.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1, transform: [{ scale: pressed ? 0.993 : 1 }] })}
    >
      {content}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  count,
  tone = 'neutral',
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: any;
  count?: number;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'accent';
  testID?: string;
}) {
  const t = useTheme();
  const tones = {
    neutral: { bg: t.colors.surfaceMuted, fg: t.colors.textSecondary },
    brand: { bg: t.colors.brandSoft, fg: t.colors.brand },
    success: { bg: t.colors.successSoft, fg: t.colors.success },
    warning: { bg: t.colors.warningSoft, fg: t.colors.warning },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger },
    accent: { bg: t.colors.accentSoft, fg: t.colors.accent },
  }[tone];

  const bg = selected ? t.colors.brand : tones.bg;
  const fg = selected ? t.colors.textOnBrand : tones.fg;

  const inner = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderRadius: t.radius.pill,
          paddingHorizontal: t.spacing.md,
          minHeight: 34,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <AppText variant="caption" numberOfLines={1} style={{ color: fg }}>
        {label}
      </AppText>
      {typeof count === 'number' ? (
        <AppText variant="micro" style={{ color: fg, opacity: 0.75 }}>
          {count}
        </AppText>
      ) : null}
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {inner}
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'accent';
  icon?: any;
}) {
  const t = useTheme();
  const tones = {
    neutral: { bg: t.colors.surfaceMuted, fg: t.colors.textMuted },
    brand: { bg: t.colors.brandSoft, fg: t.colors.brand },
    success: { bg: t.colors.successSoft, fg: t.colors.success },
    warning: { bg: t.colors.warningSoft, fg: t.colors.warning },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger },
    accent: { bg: t.colors.accentSoft, fg: t.colors.accent },
  }[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tones.bg, borderRadius: t.radius.xs, paddingHorizontal: t.spacing.sm },
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={tones.fg} /> : null}
      <AppText variant="micro" numberOfLines={1} style={{ color: tones.fg }}>
        {label}
      </AppText>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  right,
  onPress,
  danger,
  testID,
  disabled,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  iconColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const color = danger ? t.colors.danger : iconColor || t.colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: t.layout.minTouch + 6,
          paddingVertical: t.spacing.md,
          paddingHorizontal: t.spacing.lg,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: danger ? t.colors.dangerSoft : t.colors.surfaceMuted, borderRadius: t.radius.sm },
          ]}
        >
          <Ionicons name={icon} size={18} color={color} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AppText variant="bodyMedium" numberOfLines={1} tone={danger ? 'danger' : 'default'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right !== undefined ? (
        right
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: t.colors.divider,
        marginLeft: inset,
      }}
    />
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
});
