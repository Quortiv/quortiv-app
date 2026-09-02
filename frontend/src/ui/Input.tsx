import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';

export type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: any;
  rightSlot?: React.ReactNode;
  containerStyle?: ViewStyle;
  counterMax?: number;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, hint, error, icon, rightSlot, containerStyle, counterMax, style, multiline, ...rest },
  ref
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const length = typeof rest.value === 'string' ? rest.value.length : 0;

  return (
    <View style={[{ gap: t.spacing.sm }, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="label" tone="secondary">
            {label}
          </AppText>
          {counterMax ? (
            <AppText variant="micro" tone={length > counterMax ? 'danger' : 'muted'}>
              {length}/{counterMax}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: t.colors.surface,
            borderColor: error ? t.colors.danger : focused ? t.colors.brand : t.colors.border,
            borderRadius: t.radius.md,
            paddingHorizontal: t.spacing.lg,
            minHeight: multiline ? 120 : t.layout.minTouch,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingVertical: multiline ? t.spacing.md : 0,
          },
          focused && !error ? { borderWidth: 1.6 } : null,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? t.colors.brand : t.colors.textMuted}
            style={{ marginTop: multiline ? 3 : 0 }}
          />
        ) : null}
        <TextInput
          ref={ref}
          multiline={multiline}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={t.colors.textMuted}
          accessibilityLabel={rest.accessibilityLabel || label}
          style={[
            t.typography.body,
            styles.input,
            {
              color: t.colors.text,
              textAlignVertical: multiline ? 'top' : 'center',
              minHeight: multiline ? 100 : undefined,
              ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
            },
            style,
          ]}
        />
        {rightSlot}
      </View>
      {error ? (
        <View style={styles.hintRow}>
          <Ionicons name="alert-circle" size={13} color={t.colors.danger} />
          <AppText variant="caption" tone="danger" style={styles.flexText}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  autoFocus,
  testID,
  right,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  testID?: string;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.searchWrap}>
      <View
        style={[
          styles.field,
          {
            flex: 1,
            backgroundColor: t.colors.surfaceMuted,
            borderColor: 'transparent',
            borderRadius: t.radius.pill,
            paddingHorizontal: t.spacing.lg,
            height: t.layout.minTouch,
            alignItems: 'center',
          },
        ]}
      >
        <Ionicons name="search" size={18} color={t.colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          autoFocus={autoFocus}
          autoCorrect={false}
          testID={testID}
          accessibilityLabel={placeholder || 'Recherche'}
          style={[
            t.typography.body,
            styles.input,
            { color: t.colors.text, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
          ]}
        />
        {value.length > 0 ? (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
          >
            <Ionicons name="close-circle" size={18} color={t.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  testID,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: 48,
        height: 29,
        borderRadius: t.radius.pill,
        backgroundColor: value ? t.colors.brand : t.colors.borderStrong,
        justifyContent: 'center',
        paddingHorizontal: 3,
      }}
    >
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: t.radius.pill,
          backgroundColor: '#fff',
          alignSelf: value ? 'flex-end' : 'flex-start',
          ...t.shadows.xs,
        }}
      />
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string; icon?: any }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.surfaceMuted,
        borderRadius: t.radius.sm,
        padding: 3,
      }}
      testID={testID}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            testID={`${testID || 'seg'}-${o.value}`}
            style={{
              flex: 1,
              minHeight: 38,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              borderRadius: t.radius.xs,
              backgroundColor: active ? t.colors.surface : 'transparent',
              ...(active ? t.shadows.xs : {}),
            }}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={14} color={active ? t.colors.brand : t.colors.textMuted} />
            ) : null}
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: active ? t.colors.text : t.colors.textMuted }}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', gap: 10, borderWidth: 1 },
  input: { flex: 1, paddingVertical: Platform.OS === 'web' ? 12 : 10, minWidth: 0 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flexText: { flex: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
