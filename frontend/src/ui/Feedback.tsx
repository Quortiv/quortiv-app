import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact,
  testID,
}: {
  icon?: any;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[styles.empty, { paddingVertical: compact ? t.spacing.xxl : t.spacing.giant }]}
      testID={testID}
    >
      <View
        style={{
          width: compact ? 52 : 68,
          height: compact ? 52 : 68,
          borderRadius: t.radius.lg,
          backgroundColor: t.colors.brandSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.lg,
        }}
      >
        <Ionicons name={icon} size={compact ? 24 : 30} color={t.colors.brand} />
      </View>
      <AppText variant={compact ? 'title3' : 'title2'} center>
        {title}
      </AppText>
      {description ? (
        <AppText variant="callout" tone="muted" center style={{ marginTop: t.spacing.sm, maxWidth: 340 }}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: t.spacing.xl, width: '100%', maxWidth: 300, gap: t.spacing.sm }}>
          <Button label={actionLabel} onPress={onAction} icon="add" />
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function Skeleton({
  height = 16,
  width = '100%',
  radius,
  style,
}: {
  height?: number;
  width?: number | string;
  radius?: number;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.95, { duration: 850 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          height,
          width: width as any,
          borderRadius: radius ?? t.radius.xs,
          backgroundColor: t.colors.skeleton,
        },
        animated,
        style,
      ]}
    />
  );
}

export function NoteSkeleton() {
  const t = useTheme();
  return (
    <View
      style={{
        gap: t.spacing.md,
        padding: t.spacing.lg,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Skeleton height={36} width={36} radius={t.radius.sm} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton height={14} width="70%" />
          <Skeleton height={10} width="40%" />
        </View>
      </View>
      <Skeleton height={10} width="100%" />
      <Skeleton height={10} width="85%" />
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { paddingVertical: t.spacing.giant, gap: t.spacing.md }]}>
      <ActivityIndicator color={t.colors.brand} />
      {label ? (
        <AppText variant="callout" tone="muted" center>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  testID,
}: {
  message: string;
  onRetry?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { paddingVertical: t.spacing.xxxl }]} testID={testID}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: t.radius.lg,
          backgroundColor: t.colors.dangerSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.lg,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={26} color={t.colors.danger} />
      </View>
      <AppText variant="title3" center>
        Une erreur est survenue
      </AppText>
      <AppText variant="callout" tone="muted" center style={{ marginTop: t.spacing.xs, maxWidth: 320 }}>
        {message}
      </AppText>
      {onRetry ? (
        <View style={{ marginTop: t.spacing.xl, width: 200 }}>
          <Button label="Réessayer" variant="secondary" icon="refresh" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  height = 6,
  indeterminate,
}: {
  value?: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  height?: number;
  indeterminate?: boolean;
}) {
  const t = useTheme();
  const colors = {
    brand: t.colors.brand,
    success: t.colors.success,
    warning: t.colors.warning,
    danger: t.colors.danger,
  };
  const progress = useSharedValue(0);

  useEffect(() => {
    if (indeterminate) {
      progress.value = 0;
      progress.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
    }
  }, [indeterminate, progress]);

  const animated = useAnimatedStyle(() =>
    indeterminate
      ? { width: '35%', left: `${progress.value * 100 - 20}%` as any }
      : { width: `${Math.max(0, Math.min(100, (value ?? 0) * 100))}%` as any, left: 0 }
  );

  return (
    <View
      style={{
        height,
        borderRadius: height,
        backgroundColor: t.colors.surfaceMuted,
        overflow: 'hidden',
      }}
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { now: Math.round((value ?? 0) * 100), min: 0, max: 100 }}
    >
      <Animated.View
        style={[{ height, borderRadius: height, backgroundColor: colors[tone], position: 'absolute' }, animated]}
      />
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const t = useTheme();
  const map: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    processing: {
      label: 'Analyse en cours',
      color: t.colors.warning,
      bg: t.colors.warningSoft,
      icon: 'time-outline',
    },
    ready: { label: 'Prête', color: t.colors.success, bg: t.colors.successSoft, icon: 'checkmark-circle' },
    failed: { label: 'Échec', color: t.colors.danger, bg: t.colors.dangerSoft, icon: 'alert-circle' },
  };
  const s = map[status] || map.ready;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: s.bg,
        borderRadius: t.radius.xs,
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      <Ionicons name={s.icon} size={11} color={s.color} />
      <AppText variant="micro" style={{ color: s.color }}>
        {s.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
