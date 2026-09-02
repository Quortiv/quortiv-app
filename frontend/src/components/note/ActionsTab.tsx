import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, ActionItem, Note } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Card, Chip } from '@/src/ui/Card';
import { EmptyState } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input } from '@/src/ui/Input';
import { Sheet } from '@/src/ui/Sheet';

export function ActionsTab({
  note,
  onChange,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => Promise<void>;
}) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const { toast } = useFeedback();

  const [sheet, setSheet] = useState<'add' | 'reminder' | null>(null);
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState('');
  const [target, setTarget] = useState<ActionItem | null>(null);
  const [busy, setBusy] = useState(false);

  const actions = note.actions || [];

  const toggle = async (action: ActionItem) => {
    const next = actions.map((a) => (a.id === action.id ? { ...a, done: !a.done } : a));
    await onChange({ actions: next });
  };

  const remove = async (action: ActionItem) => {
    await onChange({ actions: actions.filter((a) => a.id !== action.id) });
  };

  const addAction = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onChange({
        actions: [
          ...actions,
          {
            id: `local_${Date.now()}`,
            text: text.trim(),
            owner: owner.trim() || null,
            due_date: due.trim() || null,
            done: false,
          },
        ],
      });
      setText('');
      setOwner('');
      setDue('');
      setSheet(null);
    } finally {
      setBusy(false);
    }
  };

  const createReminder = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.createReminder({
        text: target.text,
        note_id: note.id,
        action_id: target.id,
        due_at: due.trim() || target.due_date || undefined,
      });
      toast(lang === 'fr' ? 'Rappel créé' : 'Reminder created', 'success');
      setSheet(null);
      setTarget(null);
      setDue('');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {actions.length === 0 ? (
        <EmptyState
          compact
          icon="checkbox-outline"
          title={t('note_no_actions')}
          actionLabel={t('note_add_action')}
          onAction={() => setSheet('add')}
          testID="actions-empty"
        />
      ) : (
        <>
          <View style={styles.summaryRow}>
            <Chip
              label={`${actions.filter((a) => !a.done).length} ${t('actions_open')}`}
              tone="warning"
              icon="time-outline"
            />
            <Chip
              label={`${actions.filter((a) => a.done).length} ${t('actions_done')}`}
              tone="success"
              icon="checkmark-done"
            />
          </View>

          <Card padded={false} style={styles.list}>
            {actions.map((action) => (
              <View key={action.id} style={styles.row}>
                <Pressable
                  onPress={() => toggle(action)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: action.done }}
                  accessibilityLabel={action.text}
                  hitSlop={8}
                  testID={`action-toggle-${action.id}`}
                  style={[
                    styles.checkbox,
                    {
                      borderColor: action.done ? theme.colors.success : theme.colors.borderStrong,
                      backgroundColor: action.done ? theme.colors.success : 'transparent',
                    },
                  ]}
                >
                  {action.done ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </Pressable>

                <View style={styles.rowText}>
                  <AppText
                    variant="callout"
                    tone={action.done ? 'muted' : 'default'}
                    style={action.done ? styles.done : undefined}
                  >
                    {action.text}
                  </AppText>
                  {action.owner || action.due_date ? (
                    <View style={styles.metaRow}>
                      {action.owner ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="person-outline" size={11} color={theme.colors.textMuted} />
                          <AppText variant="micro" tone="muted">
                            {action.owner}
                          </AppText>
                        </View>
                      ) : null}
                      {action.due_date ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="calendar-outline" size={11} color={theme.colors.textMuted} />
                          <AppText variant="micro" tone="muted">
                            {action.due_date}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                <IconButton
                  icon="alarm-outline"
                  onPress={() => {
                    setTarget(action);
                    setDue(action.due_date || '');
                    setSheet('reminder');
                  }}
                  accessibilityLabel={t('note_reminder')}
                  testID={`action-remind-${action.id}`}
                />
                <IconButton
                  icon="close"
                  onPress={() => remove(action)}
                  accessibilityLabel={t('delete')}
                  testID={`action-delete-${action.id}`}
                />
              </View>
            ))}
          </Card>

          <Button
            label={t('note_add_action')}
            variant="secondary"
            icon="add"
            onPress={() => setSheet('add')}
            testID="actions-add"
          />
        </>
      )}

      <Sheet
        visible={sheet === 'add'}
        onClose={() => setSheet(null)}
        title={t('note_add_action')}
        footer={<Button label={t('save')} onPress={addAction} loading={busy} testID="action-save" />}
      >
        <Input
          label={t('reminder_text')}
          value={text}
          onChangeText={setText}
          autoFocus
          counterMax={200}
          testID="action-text"
        />
        <Input
          label={lang === 'fr' ? 'Responsable' : 'Owner'}
          value={owner}
          onChangeText={setOwner}
          placeholder={t('optional')}
          testID="action-owner"
        />
        <Input
          label={t('reminder_due')}
          value={due}
          onChangeText={setDue}
          placeholder="2026-07-01"
          autoCapitalize="none"
          testID="action-due"
        />
      </Sheet>

      <Sheet
        visible={sheet === 'reminder'}
        onClose={() => setSheet(null)}
        title={t('note_reminder')}
        footer={<Button label={t('save')} onPress={createReminder} loading={busy} testID="reminder-save" />}
      >
        <AppText variant="callout" tone="secondary">
          {target?.text}
        </AppText>
        <Input
          label={t('reminder_due')}
          value={due}
          onChangeText={setDue}
          placeholder="2026-07-01"
          autoCapitalize="none"
          testID="reminder-due"
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  summaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  done: { textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
