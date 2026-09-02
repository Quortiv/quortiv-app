import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';
import { IconButton } from './Button';

/** Centres content and caps its width so tablets/foldables never look stretched. */
export function Container({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: t.layout.maxContentWidth,
          alignSelf: 'center',
          paddingHorizontal: padded ? t.layout.gutter : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  left,
  variant = 'default',
  testID,
}: {
  title?: string;
  subtitle?: string;
  onBack?: (() => void) | boolean;
  right?: React.ReactNode;
  left?: React.ReactNode;
  variant?: 'default' | 'large';
  testID?: string;
}) {
  const t = useTheme();
  const router = useRouter();
  const handleBack = () => {
    if (typeof onBack === 'function') onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View
      style={{
        borderBottomWidth: variant === 'default' ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: t.colors.border,
        backgroundColor: t.colors.bg,
      }}
      testID={testID}
    >
      <Container>
        <View style={[styles.headerRow, { minHeight: t.layout.headerHeight }]}>
          <View style={styles.headerSide}>
            {onBack ? (
              <IconButton
                icon="chevron-back"
                onPress={handleBack}
                accessibilityLabel="Retour"
                testID="header-back"
                variant="ghost"
              />
            ) : (
              left
            )}
          </View>
          <View style={styles.headerCenter}>
            {!!title && (
              <AppText variant="title3" numberOfLines={1} center>
                {title}
              </AppText>
            )}
            {!!subtitle && (
              <AppText variant="caption" tone="muted" numberOfLines={1} center>
                {subtitle}
              </AppText>
            )}
          </View>
          <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
        </View>
      </Container>
    </View>
  );
}

export function Screen({
  children,
  header,
  footer,
  scroll = false,
  refreshing,
  onRefresh,
  padded = true,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
  bottomInset = true,
  testID,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  contentStyle?: ViewStyle | ViewStyle[];
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  bottomInset?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        {
          paddingBottom: (bottomInset ? insets.bottom : 0) + t.spacing.xxxl,
          paddingTop: t.spacing.lg,
        },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={t.colors.brand}
            colors={[t.colors.brand]}
          />
        ) : undefined
      }
    >
      {padded ? <Container>{children}</Container> : children}
    </ScrollView>
  ) : padded ? (
    <Container style={[styles.flex, contentStyle as any]}>{children}</Container>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.bg, paddingTop: insets.top }]} testID={testID}>
      {header}
      {body}
      {footer ? (
        <View
          style={{
            paddingBottom: insets.bottom + t.spacing.md,
            paddingTop: t.spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.bgElevated,
          }}
        >
          <Container>{footer}</Container>
        </View>
      ) : null}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  icon,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  icon?: any;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View style={[styles.sectionHeader, { marginBottom: t.spacing.md }, style]}>
      <View style={styles.sectionTitle}>
        {icon ? <Ionicons name={icon} size={16} color={t.colors.textMuted} /> : null}
        <AppText variant="micro" tone="muted" style={styles.upper} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      {action && onAction ? (
        <AppText
          variant="label"
          tone="brand"
          onPress={onAction}
          suppressHighlighting
          accessibilityRole="button"
        >
          {action}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerSide: { minWidth: 44, flexDirection: 'row', alignItems: 'center' },
  headerRight: { justifyContent: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.7 },
});
