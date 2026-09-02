import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Note } from '../api';
import { useTheme } from '../design/ThemeProvider';
import { sourceMeta } from '../design/tokens';
import { useI18n } from '../i18n';
import { AppText } from '../ui/AppText';
import { Badge, Card } from '../ui/Card';
import { StatusPill } from '../ui/Feedback';
import { excerpt, formatDuration, formatRelative } from '../utils/format';

export function SourceIcon({ type, size = 36 }: { type: string; size?: number }) {
  const t = useTheme();
  const meta = sourceMeta[type] || sourceMeta.text;
  const color = (t.colors as any)[meta.color] as string;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: t.radius.sm,
        backgroundColor: `${color}1A`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={meta.icon as any} size={size * 0.48} color={color} />
    </View>
  );
}

export function NoteCard({
  note,
  onPress,
  onLongPress,
  selected,
  selectable,
}: {
  note: Note;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectable?: boolean;
}) {
  const t = useTheme();
  const { lang } = useI18n();
  const preview = excerpt(note.summary || note.transcription, 120);

  return (
    <Card
      onPress={onPress}
      testID={`note-card-${note.id}`}
      accessibilityLabel={note.title}
      style={
        selected
          ? { borderColor: t.colors.brand, borderWidth: 1.5, backgroundColor: t.colors.brandSoft }
          : undefined
      }
    >
      <View style={styles.row}>
        {selectable ? (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: selected ? t.colors.brand : t.colors.borderStrong,
              backgroundColor: selected ? t.colors.brand : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 6,
            }}
          >
            {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
        ) : (
          <SourceIcon type={note.source_type} />
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText variant="title3" numberOfLines={2} style={styles.title}>
              {note.title}
            </AppText>
            {note.favorite ? <Ionicons name="star" size={14} color={t.colors.warning} /> : null}
          </View>

          {preview ? (
            <AppText variant="callout" tone="muted" numberOfLines={2}>
              {preview}
            </AppText>
          ) : note.status === 'processing' ? (
            <AppText variant="callout" tone="muted" numberOfLines={1}>
              {note.transcription ? excerpt(note.transcription, 90) : '…'}
            </AppText>
          ) : null}

          <View style={styles.metaRow}>
            <AppText variant="micro" tone="muted">
              {formatRelative(note.created_at, lang)}
            </AppText>
            {note.duration_sec > 0 ? (
              <>
                <View style={[styles.sep, { backgroundColor: t.colors.borderStrong }]} />
                <AppText variant="micro" tone="muted">
                  {formatDuration(note.duration_sec)}
                </AppText>
              </>
            ) : null}
            {note.template_name ? (
              <>
                <View style={[styles.sep, { backgroundColor: t.colors.borderStrong }]} />
                <AppText variant="micro" tone="muted" numberOfLines={1} style={styles.template}>
                  {note.template_name}
                </AppText>
              </>
            ) : null}
          </View>

          {note.status !== 'ready' || note.tags?.length || note.actions?.length ? (
            <View style={styles.badges}>
              {note.status !== 'ready' ? <StatusPill status={note.status} /> : null}
              {note.actions?.length ? (
                <Badge
                  label={`${note.actions.filter((a) => !a.done).length}/${note.actions.length}`}
                  tone="brand"
                  icon="checkbox-outline"
                />
              ) : null}
              {(note.tags || []).slice(0, 2).map((tag) => (
                <Badge key={tag} label={tag} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  body: { flex: 1, gap: 6, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  title: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  sep: { width: 3, height: 3, borderRadius: 2 },
  template: { maxWidth: 150 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
});
