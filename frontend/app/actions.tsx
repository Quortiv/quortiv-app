import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Card } from '@/src/ui/Card';
import { EmptyState, LoadingState } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input, SegmentedControl } from '@/src/ui/Input';
import { AppHeader, Screen, SectionHeader } from '@/src/ui/Screen';
import { Sheet } from '@/src/ui/Sheet';

type Mode = 'open' | 'reminders';

export default function ActionsInbox() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { toast } = useFeedback();

  const [mode, setMode] = useState<Mode>('open');
  const [actions, setActions] = useState<any[] | null>(null);
  const [reminders, setReminders] = useState<any[] | null>(null);
  const [sheet, setSheet] = useState(false);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.listActions(true), api.listReminders(true)]);
      setActions(a);
      setReminders(r);
    } catch {
      setActions([]);
      setReminders([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleAction = async (item: any) => {
    try {
      const note = await api.getNote(item.note_id);
      const next = (note.actions || []).map((a) => (a.id === item.id ? { ...a, done: !a.done } : a));
      await api.updateNote(item.note_id, { actions: next });
      await load();
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const toggleReminder = async (item: any) => {
    try {
      await api.updateReminder(item.id, { done: !item.done });
      await load();
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const createReminder = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.createReminder({ text: text.trim(), due_at: due.trim() || undefined });
      setText('');
      setDue('');
      setSheet(false);
      await load();
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const items = mode === 'open' ? actions : reminders;

  return (
    <Screen
      scroll
      testID="actions-screen"
      header={
        <AppHeader
          onBack
          title={t('actions_title')}
          right={
            <IconButton
              icon="add"
              variant="soft"
              onPress={() => setSheet(true)}
              accessibilityLabel={t('reminder_new')}
              testID="reminder-new"
            />
          }
        />
      }
    >
      <SegmentedControl<Mode>
        value={mode}
        onChange={setMode}
        testID="actions-mode"
        options={[
          { value: 'open', label: t('actions_open'), icon: 'checkbox-outline' },
          { value: 'reminders', label: t('insights_reminders'), icon: 'alarm-outline' },
        ]}
      />

      {items === null ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          icon={mode === 'open' ? 'checkmark-done-outline' : 'alarm-outline'}
          title={t('actions_empty')}
          description={t('actions_empty_desc')}
          testID="actions-empty"
        />
      ) : (
        <View style={styles.section}>
          <SectionHeader title={`${items.length} ${mode === 'open' ? t('actions_open') : t('insights_reminders')}`} />
          <Card padded={false} style={styles.list}>
            {items.map((item: any) => (
              <View key={item.id} style={styles.row}>
                <Pressable
                  onPress={() => (mode === 'open' ? toggleAction(item) : toggleReminder(item))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!item.done }}
                  accessibilityLabel={item.text}
                  hitSlop={8}
                  testID={`inbox-toggle-${item.id}`}
                  style={[
                    styles.checkbox,
                    {
                      borderColor: item.done ? theme.colors.success : theme.colors.borderStrong,
                      backgroundColor: item.done ? theme.colors.success : 'transparent',
                    },
                  ]}
                >
                  {item.done ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </Pressable>
                <View style={styles.rowText}>
                  <AppText variant="callout" tone={item.done ? 'muted' : 'default'}>
                    {item.text}
                  </AppText>
                  <View style={styles.metaRow}>
                    {item.note_title ? (
                      <AppText
                        variant="micro"
                        tone="brand"
                        numberOfLines={1}
                        onPress={() => router.push(`/note/${item.note_id}` as any)}
                        suppressHighlighting
                        accessibilityRole="button"
                      >
                        {item.note_title}
                      </AppText>
                    ) : null}
                    {item.owner ? (
                      <AppText variant="micro" tone="muted">
                        {item.owner}
                      </AppText>
                    ) : null}
                    {item.due_date || item.due_at ? (
                      <AppText variant="micro" tone="warning">
                        {item.due_date || item.due_at}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                {mode === 'reminders' ? (
                  <IconButton
                    icon="trash-outline"
                    onPress={async () => {
                      await api.deleteReminder(item.id);
                      await load();
                    }}
                    accessibilityLabel={t('delete')}
                    testID={`reminder-delete-${item.id}`}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </View>
      )}

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={t('reminder_new')}
        footer={<Button label={t('save')} onPress={createReminder} loading={busy} testID="inbox-reminder-save" />}
      >
        <Input
          label={t('reminder_text')}
          value={text}
          onChangeText={setText}
          autoFocus
          counterMax={200}
          testID="inbox-reminder-text"
        />
        <Input
          label={t('reminder_due')}
          value={due}
          onChangeText={setDue}
          placeholder="2026-07-01"
          autoCapitalize="none"
          testID="inbox-reminder-due"
        />
        <AppText variant="caption" tone="muted">
          {lang === 'fr'
            ? 'Les rappels sont conservés dans votre espace. Aucune notification n’est envoyée pour l’instant.'
            : 'Reminders live in your workspace. No notification is sent for now.'}
        </AppText>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  metaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
