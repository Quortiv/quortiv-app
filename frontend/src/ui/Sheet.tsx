import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';
import { IconButton } from './Button';

/**
 * Bottom sheet built on the platform Modal so it works identically on iOS,
 * Android and the web preview. Content is width-capped and centred.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  maxHeightRatio = 0.88,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  maxHeightRatio?: number;
  testID?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const translate = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translate.value = withSpring(0, { damping: 20, stiffness: 220 });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      translate.value = 40;
      opacity.value = 0;
    }
  }, [visible, translate, opacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translate.value }],
    opacity: opacity.value,
  }));

  const body = (
    <View style={{ gap: t.spacing.lg }}>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
    >
      <View style={[styles.backdrop, { backgroundColor: t.colors.overlay }]}>
        <Pressable
          style={styles.backdropPress}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.kav}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: t.colors.bgElevated,
                borderTopLeftRadius: t.radius.xl,
                borderTopRightRadius: t.radius.xl,
                maxWidth: t.layout.maxContentWidth,
                paddingBottom: insets.bottom + t.spacing.lg,
                maxHeight: `${maxHeightRatio * 100}%` as any,
              },
              t.shadows.md,
              sheetStyle,
            ]}
          >
            <View style={styles.grabberWrap}>
              <View style={[styles.grabber, { backgroundColor: t.colors.borderStrong }]} />
            </View>

            {title ? (
              <View style={[styles.header, { paddingHorizontal: t.spacing.xl }]}>
                <View style={styles.headerText}>
                  <AppText variant="title2" numberOfLines={2}>
                    {title}
                  </AppText>
                  {subtitle ? (
                    <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
                <IconButton
                  icon="close"
                  variant="soft"
                  onPress={onClose}
                  accessibilityLabel="Fermer"
                  testID="sheet-close"
                />
              </View>
            ) : null}

            {scroll ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={{
                  paddingHorizontal: t.spacing.xl,
                  paddingBottom: t.spacing.lg,
                  paddingTop: title ? 0 : t.spacing.sm,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {body}
              </ScrollView>
            ) : (
              <View style={{ paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.lg }}>{body}</View>
            )}

            {footer ? (
              <View
                style={{
                  paddingHorizontal: t.spacing.xl,
                  paddingTop: t.spacing.md,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: t.colors.border,
                  gap: t.spacing.sm,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function SheetOption({
  icon,
  title,
  description,
  onPress,
  tone = 'default',
  badge,
  testID,
  disabled,
}: {
  icon: any;
  title: string;
  description?: string;
  onPress: () => void;
  tone?: 'default' | 'brand' | 'danger';
  badge?: string;
  testID?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const colors = {
    default: { fg: t.colors.text, iconBg: t.colors.surfaceMuted, iconFg: t.colors.textSecondary },
    brand: { fg: t.colors.text, iconBg: t.colors.brandSoft, iconFg: t.colors.brand },
    danger: { fg: t.colors.danger, iconBg: t.colors.dangerSoft, iconFg: t.colors.danger },
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.option,
        {
          minHeight: t.layout.minTouch + 8,
          borderRadius: t.radius.md,
          backgroundColor: pressed ? t.colors.surfaceMuted : 'transparent',
          opacity: disabled ? 0.45 : 1,
          paddingVertical: t.spacing.md,
          paddingHorizontal: t.spacing.md,
        },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: colors.iconBg, borderRadius: t.radius.sm }]}>
        <Ionicons name={icon} size={19} color={colors.iconFg} />
      </View>
      <View style={styles.optionText}>
        <View style={styles.optionTitleRow}>
          <AppText variant="bodyMedium" numberOfLines={1} style={{ color: colors.fg, flexShrink: 1 }}>
            {title}
          </AppText>
          {badge ? (
            <View style={[styles.optionBadge, { backgroundColor: t.colors.brandSoft, borderRadius: t.radius.xs }]}>
              <AppText variant="micro" tone="brand">
                {badge}
              </AppText>
            </View>
          ) : null}
        </View>
        {description ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={t.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropPress: { ...StyleSheet.absoluteFillObject },
  kav: { width: '100%', alignItems: 'center' },
  sheet: { width: '100%', overflow: 'hidden' },
  grabberWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  grabber: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerText: { flex: 1, minWidth: 0 },
  scroll: { flexGrow: 0 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  optionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 2, minWidth: 0 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionBadge: { paddingHorizontal: 6, paddingVertical: 2 },
});
