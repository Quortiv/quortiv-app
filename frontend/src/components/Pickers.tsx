import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Folder, Template } from '../api';
import { useTheme } from '../design/ThemeProvider';
import { useI18n } from '../i18n';
import { AppText } from '../ui/AppText';
import { Badge } from '../ui/Card';
import { Sheet } from '../ui/Sheet';

export function TemplatePickerSheet({
  visible,
  onClose,
  templates,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  templates: Template[];
  selectedId?: string | null;
  onSelect: (t: Template) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const general = templates.filter((x) => !x.is_specialized && x.is_builtin);
  const custom = templates.filter((x) => !x.is_builtin);
  const specialized = templates.filter((x) => x.is_specialized);

  const renderGroup = (label: string, items: Template[]) =>
    items.length ? (
      <View style={{ gap: theme.spacing.sm }} key={label}>
        <AppText variant="micro" tone="muted" style={styles.groupLabel}>
          {label}
        </AppText>
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              testID={`template-option-${item.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.name}
              style={({ pressed }) => [
                styles.option,
                {
                  borderRadius: theme.radius.md,
                  borderColor: active ? theme.colors.brand : theme.colors.border,
                  borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                  backgroundColor: active ? theme.colors.brandSoft : theme.colors.surface,
                  opacity: pressed ? 0.85 : 1,
                  padding: theme.spacing.lg,
                },
              ]}
            >
              <View
                style={[
                  styles.icon,
                  {
                    backgroundColor: active ? theme.colors.brand : theme.colors.surfaceMuted,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              >
                <Ionicons
                  name={(item.icon as any) || 'document-text-outline'}
                  size={18}
                  color={active ? '#fff' : theme.colors.textSecondary}
                />
              </View>
              <View style={styles.optionText}>
                <View style={styles.titleRow}>
                  <AppText variant="bodyMedium" numberOfLines={1} style={styles.flex}>
                    {item.name}
                  </AppText>
                  {item.is_default ? <Badge label={t('template_default')} tone="brand" /> : null}
                </View>
                {item.description ? (
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {item.description}
                  </AppText>
                ) : null}
              </View>
              {active ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.brand} /> : null}
            </Pressable>
          );
        })}
      </View>
    ) : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('templates')} testID="template-sheet">
      {renderGroup(t('template_builtin'), general)}
      {renderGroup(t('template_custom'), custom)}
      {renderGroup('Contextes spécialisés', specialized)}
    </Sheet>
  );
}

export function FolderPickerSheet({
  visible,
  onClose,
  folders,
  selectedId,
  onSelect,
  allowNone = true,
}: {
  visible: boolean;
  onClose: () => void;
  folders: Folder[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  allowNone?: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const row = (id: string | null, name: string, color: string, count?: number) => {
    const active = id === selectedId || (!id && !selectedId);
    return (
      <Pressable
        key={id || 'none'}
        onPress={() => {
          onSelect(id);
          onClose();
        }}
        testID={`folder-option-${id || 'none'}`}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={name}
        style={({ pressed }) => [
          styles.option,
          {
            borderRadius: theme.radius.md,
            borderColor: active ? theme.colors.brand : theme.colors.border,
            borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
            backgroundColor: active ? theme.colors.brandSoft : theme.colors.surface,
            opacity: pressed ? 0.85 : 1,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText variant="bodyMedium" numberOfLines={1} style={styles.flex}>
          {name}
        </AppText>
        {typeof count === 'number' ? (
          <AppText variant="caption" tone="muted">
            {count}
          </AppText>
        ) : null}
        {active ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.brand} /> : null}
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('folder')} testID="folder-sheet">
      {allowNone ? row(null, t('unsorted'), theme.colors.borderStrong) : null}
      {folders.map((f) => row(f.id, f.name, f.color, f.note_count))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 3, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  groupLabel: { textTransform: 'uppercase', letterSpacing: 0.7 },
});
