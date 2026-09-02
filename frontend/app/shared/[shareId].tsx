import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, apiBase } from '@/src/api';
import { LogoMark } from '@/src/design/Logo';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { Card, Chip, Divider } from '@/src/ui/Card';
import { ErrorState, LoadingState } from '@/src/ui/Feedback';
import { Markdown } from '@/src/ui/Markdown';
import { AppHeader, Screen, SectionHeader } from '@/src/ui/Screen';
import { formatDateTime, formatTimestamp } from '@/src/utils/format';
import { downloadAndShare } from '@/src/utils/share';

/** Public read-only view of a shared note. No authentication required. */
export default function SharedNote() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const { shareId } = useLocalSearchParams<{ shareId: string }>();

  const [data, setData] = useState<{ note: any; shared_by: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .publicNote(shareId!)
      .then(setData)
      .catch((e) => setError(e?.message || t('error_generic')));
  }, [shareId, t]);

  if (error) {
    return (
      <Screen header={<AppHeader title={t('app_name')} />} testID="shared-error">
        <ErrorState message={error} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen header={<AppHeader title={t('app_name')} />} testID="shared-loading">
        <LoadingState />
      </Screen>
    );
  }

  const note = data.note;

  return (
    <Screen
      scroll
      testID="shared-screen"
      header={
        <AppHeader
          left={<LogoMark size={26} ring={theme.colors.text} slash={theme.colors.brand} />}
          title={t('app_name')}
          subtitle={`${lang === 'fr' ? 'Partagé par' : 'Shared by'} ${data.shared_by}`}
        />
      }
    >
      <AppText variant="title1">{note.title}</AppText>
      <View style={styles.metaRow}>
        <AppText variant="caption" tone="muted">
          {formatDateTime(note.created_at, lang)}
        </AppText>
        {note.template_name ? <Chip label={note.template_name} tone="brand" /> : null}
      </View>

      {note.summary ? (
        <Card style={styles.card}>
          <Markdown content={note.summary} />
        </Card>
      ) : null}

      {note.key_points?.length ? (
        <View style={styles.section}>
          <SectionHeader title={t('note_key_points')} />
          <Card style={styles.listCard}>
            {note.key_points.map((point: string, i: number) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bullet, { backgroundColor: theme.colors.brand }]} />
                <AppText variant="callout" tone="secondary" style={styles.flex}>
                  {point}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {note.actions?.length ? (
        <View style={styles.section}>
          <SectionHeader title={t('note_actions')} />
          <Card style={styles.listCard}>
            {note.actions.map((action: any) => (
              <View key={action.id} style={styles.bulletRow}>
                <Ionicons
                  name={action.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={action.done ? theme.colors.success : theme.colors.textMuted}
                />
                <AppText variant="callout" tone="secondary" style={styles.flex}>
                  {action.text}
                  {action.owner ? ` — ${action.owner}` : ''}
                  {action.due_date ? ` (${action.due_date})` : ''}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {note.segments?.length ? (
        <View style={styles.section}>
          <SectionHeader title={t('note_transcript')} />
          <Card padded={false}>
            {note.segments.slice(0, 200).map((segment: any, i: number) => (
              <View key={i} style={styles.segment}>
                {segment.start ? (
                  <AppText variant="micro" tone="brand">
                    {formatTimestamp(segment.start)}
                  </AppText>
                ) : null}
                <AppText variant="body" tone="secondary">
                  {segment.text}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <Divider />
      <Button
        label={`${t('note_export')} PDF`}
        variant="secondary"
        icon="download-outline"
        onPress={() =>
          downloadAndShare(`${apiBase}/public/notes/${shareId}/export?format=pdf`, `${note.title}.pdf`)
        }
        style={styles.section}
        testID="shared-export"
      />
      <AppText variant="micro" tone="muted" center style={styles.footer}>
        {t('note_ai_disclaimer')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  card: { marginTop: 18 },
  section: { marginTop: 22 },
  listCard: { gap: 10 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  flex: { flex: 1, minWidth: 0 },
  segment: { paddingVertical: 9, paddingHorizontal: 14, gap: 3 },
  footer: { marginTop: 24 },
});
