import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, Note } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Card, Chip } from '@/src/ui/Card';
import { EmptyState, ProgressBar } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input, SearchField } from '@/src/ui/Input';
import { Sheet } from '@/src/ui/Sheet';
import { formatTimer, formatTimestamp } from '@/src/utils/format';

function AudioPlayerBar({
  uri,
  onSeekPositionChange,
}: {
  uri: string;
  onSeekPositionChange: (seconds: number) => void;
}) {
  const theme = useTheme();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const position = status?.currentTime || 0;
  const duration = status?.duration || 0;

  React.useEffect(() => {
    onSeekPositionChange(position);
  }, [position, onSeekPositionChange]);

  return (
    <Card style={styles.player}>
      <View style={styles.playerRow}>
        <IconButton
          icon={status?.playing ? 'pause' : 'play'}
          variant="solid"
          size={20}
          onPress={() => (status?.playing ? player.pause() : player.play())}
          accessibilityLabel={status?.playing ? 'Pause' : 'Lecture'}
          testID="audio-play"
        />
        <View style={styles.flex}>
          <ProgressBar value={duration ? position / duration : 0} />
          <View style={styles.playerMeta}>
            <AppText variant="micro" tone="muted">
              {formatTimer(position)}
            </AppText>
            <AppText variant="micro" tone="muted">
              {formatTimer(duration)}
            </AppText>
          </View>
        </View>
        <IconButton
          icon="play-back"
          onPress={() => player.seekTo(Math.max(0, position - 10))}
          accessibilityLabel="-10 s"
        />
        <IconButton
          icon="play-forward"
          onPress={() => player.seekTo(Math.min(duration, position + 10))}
          accessibilityLabel="+10 s"
        />
      </View>
    </Card>
  );
}

export function TranscriptTab({
  note,
  onChange,
}: {
  note: Note;
  onChange: (patch: Partial<Note>) => Promise<void>;
}) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const { toast } = useFeedback();

  const [query, setQuery] = useState('');
  const [position, setPosition] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.transcription);
  const [saving, setSaving] = useState(false);
  const [speakerSheet, setSpeakerSheet] = useState<string | null>(null);
  const [speakerName, setSpeakerName] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);

  const audioUri = note.audio_path ? api.audioUrl(note.id) : null;
  const speakers = note.speakers || {};
  const speakerKeys = Object.keys(speakers);

  const segments = useMemo(() => {
    const list = note.segments || [];
    if (!query.trim()) return list;
    const needle = query.trim().toLowerCase();
    return list.filter((s) => s.text.toLowerCase().includes(needle));
  }, [note.segments, query]);

  const translationLang = Object.keys(note.translations || {})[0];
  const translated = translationLang ? note.translations?.[translationLang]?.transcription : undefined;

  const save = async () => {
    setSaving(true);
    try {
      await onChange({ transcription: draft });
      setEditing(false);
      toast(t('note_saved'), 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const renameSpeaker = async () => {
    if (!speakerSheet) return;
    await onChange({ speakers: { ...speakers, [speakerSheet]: speakerName.trim() || speakerSheet } });
    setSpeakerSheet(null);
  };

  if (!note.transcription && !(note.segments || []).length) {
    return <EmptyState compact icon="document-outline" title={t('note_empty_transcript')} />;
  }

  return (
    <View style={styles.wrap}>
      {audioUri ? (
        <AudioPlayerBar uri={audioUri} onSeekPositionChange={setPosition} />
      ) : null}

      {speakerKeys.length ? (
        <View>
          <AppText variant="micro" tone="muted" style={styles.upper}>
            {t('note_speakers')}
          </AppText>
          <View style={styles.speakerRow}>
            {speakerKeys.map((key) => (
              <Chip
                key={key}
                label={speakers[key] || key}
                icon="person-outline"
                tone="accent"
                onPress={() => {
                  setSpeakerSheet(key);
                  setSpeakerName(speakers[key] || '');
                }}
                testID={`speaker-${key}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {translated ? (
        <Chip
          label={showTranslation ? t('note_show_original') : `${t('note_translated')} (${translationLang})`}
          icon="language-outline"
          tone="accent"
          onPress={() => setShowTranslation((v) => !v)}
          testID="transcript-toggle-translation"
        />
      ) : null}

      {editing ? (
        <Card>
          <Input
            label={t('note_transcript')}
            value={draft}
            onChangeText={setDraft}
            multiline
            style={styles.editor}
            testID="transcript-editor"
          />
          <View style={styles.editActions}>
            <Button
              label={t('cancel')}
              variant="ghost"
              onPress={() => {
                setDraft(note.transcription);
                setEditing(false);
              }}
              style={styles.flex}
            />
            <Button
              label={t('save')}
              onPress={save}
              loading={saving}
              style={styles.flex}
              testID="transcript-save"
            />
          </View>
        </Card>
      ) : showTranslation && translated ? (
        <Card>
          <AppText variant="body" tone="secondary">
            {translated}
          </AppText>
        </Card>
      ) : (
        <>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={lang === 'fr' ? 'Rechercher dans la transcription' : 'Search the transcript'}
            testID="transcript-search"
            right={
              <IconButton
                icon="pencil"
                variant="soft"
                onPress={() => {
                  setDraft(note.transcription);
                  setEditing(true);
                }}
                accessibilityLabel={t('edit')}
                testID="transcript-edit"
              />
            }
          />

          {segments.length === 0 ? (
            <EmptyState compact icon="search-outline" title={t('search_no_results')} />
          ) : (
            <Card padded={false} style={styles.segmentsCard}>
              {segments.map((segment, i) => {
                const active =
                  !!audioUri && position >= segment.start && position < (segment.end || segment.start + 5);
                const speakerLabel = segment.speaker ? speakers[segment.speaker] || segment.speaker : null;
                return (
                  <Pressable
                    key={`${segment.start}-${i}`}
                    onPress={() => {}}
                    accessibilityRole="text"
                    style={[
                      styles.segment,
                      {
                        backgroundColor: active ? theme.colors.brandSoft : 'transparent',
                        borderLeftColor: active ? theme.colors.brand : 'transparent',
                      },
                    ]}
                    testID={`segment-${i}`}
                  >
                    <View style={styles.segmentHead}>
                      {segment.end || segment.start ? (
                        <AppText variant="micro" tone="brand" style={styles.time}>
                          {formatTimestamp(segment.start)}
                        </AppText>
                      ) : null}
                      {speakerLabel ? (
                        <AppText variant="micro" tone="secondary" numberOfLines={1}>
                          {speakerLabel}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText variant="body" tone="secondary">
                      {segment.text}
                    </AppText>
                  </Pressable>
                );
              })}
            </Card>
          )}
        </>
      )}

      <Sheet
        visible={!!speakerSheet}
        onClose={() => setSpeakerSheet(null)}
        title={t('note_rename_speaker')}
        footer={<Button label={t('save')} onPress={renameSpeaker} testID="speaker-save" />}
      >
        <Input
          label={t('note_speakers')}
          value={speakerName}
          onChangeText={setSpeakerName}
          autoFocus
          counterMax={40}
          testID="speaker-input"
        />
        <AppText variant="caption" tone="muted">
          {lang === 'fr'
            ? 'Les intervenants sont estimés par IA à partir du contenu : corrigez-les librement.'
            : 'Speakers are AI-estimated from the content: correct them freely.'}
        </AppText>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  player: { paddingVertical: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playerMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  flex: { flex: 1, minWidth: 0 },
  speakerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.7 },
  segmentsCard: { paddingVertical: 6 },
  segment: { paddingVertical: 10, paddingHorizontal: 14, gap: 4, borderLeftWidth: 3 },
  segmentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontVariant: ['tabular-nums'] },
  editor: { minHeight: 260 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
