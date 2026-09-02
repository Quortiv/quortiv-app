import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, Note } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { Card, Chip, Divider } from '@/src/ui/Card';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input } from '@/src/ui/Input';
import { Markdown } from '@/src/ui/Markdown';
import { SectionHeader } from '@/src/ui/Screen';
import { formatRelative } from '@/src/utils/format';

export function SummaryTab({
  note,
  onChange,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => Promise<void>;
}) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { toast } = useFeedback();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.summary);
  const [saving, setSaving] = useState(false);
  const [related, setRelated] = useState<any[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    api.relatedNotes(note.id).then(setRelated).catch(() => {});
  }, [note.id]);

  const translationLang = Object.keys(note.translations || {})[0];
  const translation = translationLang ? note.translations?.[translationLang] : undefined;
  const body = showTranslation && translation?.summary ? translation.summary : note.summary;
  const keyPoints =
    showTranslation && translation?.key_points?.length ? translation.key_points : note.key_points;

  const save = async () => {
    setSaving(true);
    try {
      await onChange({ summary: draft });
      setEditing(false);
      toast(t('note_saved'), 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addTag = async () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    if ((note.tags || []).includes(tag)) {
      setTagInput('');
      return;
    }
    await onChange({ tags: [...(note.tags || []), tag] });
    setTagInput('');
  };

  return (
    <View style={styles.wrap}>
      {translation?.summary ? (
        <Chip
          label={showTranslation ? t('note_show_original') : `${t('note_translated')} (${translationLang})`}
          icon="language-outline"
          tone="accent"
          onPress={() => setShowTranslation((v) => !v)}
          testID="note-toggle-translation"
        />
      ) : null}

      {editing ? (
        <Card>
          <Input
            label={t('note_summary')}
            value={draft}
            onChangeText={setDraft}
            multiline
            style={styles.editor}
            testID="summary-editor"
          />
          <View style={styles.editActions}>
            <Button
              label={t('cancel')}
              variant="ghost"
              onPress={() => {
                setDraft(note.summary);
                setEditing(false);
              }}
              style={styles.flex}
            />
            <Button label={t('save')} onPress={save} loading={saving} style={styles.flex} testID="summary-save" />
          </View>
        </Card>
      ) : (
        <Card>
          <Markdown content={body || ''} />
          <Divider />
          <View style={styles.disclaimerRow}>
            <Ionicons name="sparkles-outline" size={13} color={theme.colors.textMuted} />
            <AppText variant="micro" tone="muted" style={styles.flex}>
              {t('note_ai_disclaimer')}
            </AppText>
            <Chip label={t('edit')} icon="pencil" onPress={() => setEditing(true)} testID="summary-edit" />
          </View>
        </Card>
      )}

      {keyPoints?.length ? (
        <View>
          <SectionHeader title={t('note_key_points')} icon="key-outline" />
          <Card style={styles.listCard}>
            {keyPoints.map((point, i) => (
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

      {note.decisions?.length ? (
        <View>
          <SectionHeader title={t('note_decisions')} icon="checkmark-done-outline" />
          <Card style={styles.listCard}>
            {note.decisions.map((decision, i) => (
              <View key={i} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <AppText variant="callout" tone="secondary" style={styles.flex}>
                  {decision}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {note.plan?.length ? (
        <View>
          <SectionHeader title={t('note_plan')} icon="list-outline" />
          <Card style={styles.listCard}>
            {note.plan.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <AppText variant="caption" tone="brand" style={styles.index}>
                  {String(i + 1).padStart(2, '0')}
                </AppText>
                <AppText variant="callout" tone="secondary" style={styles.flex}>
                  {item}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {note.insights ? (
        <View>
          <SectionHeader title={t('note_insights')} icon="bulb-outline" />
          <Card variant="brand">
            <Markdown content={note.insights} compact />
          </Card>
        </View>
      ) : null}

      <View>
        <SectionHeader title={t('note_tags')} icon="pricetag-outline" />
        <View style={styles.tagRow}>
          {(note.tags || []).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              icon="close"
              onPress={() => onChange({ tags: note.tags.filter((x) => x !== tag) })}
              testID={`note-tag-${tag}`}
            />
          ))}
        </View>
        <View style={styles.tagInput}>
          <Input
            value={tagInput}
            onChangeText={setTagInput}
            placeholder={lang === 'fr' ? 'Ajouter un tag' : 'Add a tag'}
            onSubmitEditing={addTag}
            returnKeyType="done"
            containerStyle={styles.flex}
            testID="note-tag-input"
          />
          <Button
            label="+"
            variant="secondary"
            fullWidth={false}
            onPress={addTag}
            style={styles.addTagBtn}
            testID="note-tag-add"
          />
        </View>
      </View>

      {related.length ? (
        <View>
          <SectionHeader title={t('note_related')} icon="git-network-outline" />
          <Card padded={false}>
            {related.map((item, i) => (
              <View key={item.id}>
                {i > 0 ? <Divider inset={16} /> : null}
                <View style={styles.relatedRow}>
                  <View style={styles.flex}>
                    <AppText
                      variant="callout"
                      numberOfLines={1}
                      onPress={() => router.push(`/note/${item.id}` as any)}
                      suppressHighlighting
                      accessibilityRole="button"
                    >
                      {item.title}
                    </AppText>
                    <AppText variant="micro" tone="muted">
                      {item.shared_tags?.join(' · ') || formatRelative(item.created_at, lang)}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  listCard: { gap: 10 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  index: { minWidth: 22 },
  flex: { flex: 1, minWidth: 0 },
  editor: { minHeight: 240 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagInput: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10 },
  addTagBtn: { width: 52 },
  relatedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
});
