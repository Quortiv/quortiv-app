import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '@/src/theme';

export function NoteCard({
  title,
  date,
  duration,
  tag,
  status,
  onPress,
  testID,
}: {
  title: string;
  date: string;
  duration?: string;
  tag?: string;
  status?: string;
  onPress?: () => void;
  testID?: string;
}) {
  const processing = status === 'processing';
  return (
    <Pressable style={[styles.card, shadow.card]} onPress={onPress} testID={testID}>
      <View style={styles.iconBox}>
        {processing ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : (
          <Ionicons name="document-text" size={20} color={colors.brandPrimary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>
          {title || 'Sans titre'}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{date}</Text>
          {duration ? <Text style={styles.meta}>· {duration}</Text> : null}
          {tag ? (
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.onSurface, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: colors.muted },
  tagPill: {
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginLeft: 4,
  },
  tagText: { fontSize: 11, color: colors.onBrandSecondary, fontWeight: '600' },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipLabel: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: colors.onBrandPrimary },
});
