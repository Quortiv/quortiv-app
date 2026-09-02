import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { api, Folder, Note, NoteFilters } from '@/src/api';
import { NoteCard } from '@/src/components/NoteCard';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Chip } from '@/src/ui/Card';
import { EmptyState, ErrorState, NoteSkeleton } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { AppHeader, Container, Screen } from '@/src/ui/Screen';
import { Sheet } from '@/src/ui/Sheet';

const PAGE = 20;

export default function NotesList() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{
    folder_id?: string;
    tag?: string;
    favorite?: string;
    archived?: string;
    title?: string;
  }>();
  const { toast, confirm } = useFeedback();

  const [notes, setNotes] = useState<Note[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filterSheet, setFilterSheet] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);

  const [filters, setFilters] = useState<NoteFilters>({
    folder_id: params.folder_id,
    tag: params.tag,
    favorite: params.favorite === '1' || undefined,
    archived: params.archived === '1' || undefined,
    status: 'all',
    source_type: 'all',
    period: undefined,
    sort: 'recent',
  });

  useEffect(() => {
    api.listFolders().then(setFolders).catch(() => {});
  }, []);

  const load = useCallback(
    async (skip = 0) => {
      try {
        const page = await api.listNotes({ ...filters, limit: PAGE, skip });
        setNotes((prev) => (skip === 0 ? page.items : [...(prev || []), ...page.items]));
        setTotal(page.total);
        setHasMore(page.has_more);
        setError(null);
      } catch (e: any) {
        setError(e?.message || t('error_generic'));
        if (skip === 0) setNotes([]);
      }
    },
    [filters, t]
  );

  useEffect(() => {
    setNotes(null);
    load(0);
  }, [load]);

  const activeFilterCount = useMemo(
    () =>
      [
        filters.status && filters.status !== 'all',
        filters.source_type && filters.source_type !== 'all',
        filters.period,
        filters.folder_id,
        filters.tag,
        filters.favorite,
        filters.sort && filters.sort !== 'recent',
      ].filter(Boolean).length,
    [filters]
  );

  const toggleSelect = (id: string) =>
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const runBulk = async (action: string) => {
    if (action === 'delete') {
      const ok = await confirm({
        title: t('note_delete_title'),
        message: t('note_delete_desc'),
        confirmLabel: t('delete'),
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      const res = await api.bulkNotes(selection, action);
      toast(`${res.affected} ${t('notes_count')}`, 'success');
      setSelection([]);
      setNotes(null);
      load(0);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const title =
    params.title ||
    (filters.archived ? t('archived') : filters.favorite ? t('favorites') : t('all_notes'));

  return (
    <Screen
      padded={false}
      testID="notes-screen"
      header={
        <AppHeader
          onBack
          title={selection.length ? `${selection.length} ${t('select')}` : title}
          subtitle={selection.length ? undefined : `${total} ${t('notes_count')}`}
          right={
            selection.length ? (
              <View style={styles.headerActions}>
                <IconButton
                  icon="star-outline"
                  onPress={() => runBulk('favorite')}
                  accessibilityLabel={t('note_favorite')}
                />
                <IconButton
                  icon="archive-outline"
                  onPress={() => runBulk(filters.archived ? 'unarchive' : 'archive')}
                  accessibilityLabel={t('note_archive')}
                />
                <IconButton
                  icon="trash-outline"
                  color={theme.colors.danger}
                  onPress={() => runBulk('delete')}
                  accessibilityLabel={t('delete')}
                  testID="bulk-delete"
                />
                <IconButton
                  icon="close"
                  onPress={() => setSelection([])}
                  accessibilityLabel={t('cancel')}
                />
              </View>
            ) : (
              <View style={styles.headerActions}>
                <IconButton
                  icon="search"
                  onPress={() => router.push('/search')}
                  accessibilityLabel={t('search_title')}
                />
                <IconButton
                  icon="options-outline"
                  onPress={() => setFilterSheet(true)}
                  badge={activeFilterCount}
                  accessibilityLabel={t('filters')}
                  testID="notes-filters"
                />
              </View>
            )
          }
        />
      }
    >
      {notes === null ? (
        <Container style={styles.loading}>
          <NoteSkeleton />
          <NoteSkeleton />
          <NoteSkeleton />
        </Container>
      ) : error && notes.length === 0 ? (
        <Container>
          <ErrorState message={error} onRetry={() => load(0)} testID="notes-error" />
        </Container>
      ) : notes.length === 0 ? (
        <Container>
          <EmptyState
            icon="documents-outline"
            title={t('search_no_results')}
            description={activeFilterCount ? t('search_no_results_desc') : t('no_notes_desc')}
            actionLabel={activeFilterCount ? t('filter_reset') : undefined}
            onAction={
              activeFilterCount
                ? () =>
                    setFilters({ status: 'all', source_type: 'all', sort: 'recent', archived: filters.archived })
                : undefined
            }
            testID="notes-empty"
          />
        </Container>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { maxWidth: theme.layout.maxContentWidth, paddingHorizontal: theme.layout.gutter },
          ]}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              selectable={selection.length > 0}
              selected={selection.includes(item.id)}
              onPress={() =>
                selection.length > 0 ? toggleSelect(item.id) : router.push(`/note/${item.id}` as any)
              }
              onLongPress={() => toggleSelect(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(0);
            setRefreshing(false);
          }}
          onEndReachedThreshold={0.4}
          onEndReached={async () => {
            if (!hasMore || loadingMore) return;
            setLoadingMore(true);
            await load(notes.length);
            setLoadingMore(false);
          }}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footer}>
                <Button
                  label={loadingMore ? t('loading') : t('see_all')}
                  variant="ghost"
                  loading={loadingMore}
                  onPress={async () => {
                    setLoadingMore(true);
                    await load(notes.length);
                    setLoadingMore(false);
                  }}
                />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <FiltersSheet
        visible={filterSheet}
        onClose={() => setFilterSheet(false)}
        filters={filters}
        folders={folders}
        onApply={(next) => {
          setFilters(next);
          setFilterSheet(false);
        }}
      />
    </Screen>
  );
}

function FiltersSheet({
  visible,
  onClose,
  filters,
  folders,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  filters: NoteFilters;
  folders: Folder[];
  onApply: (f: NoteFilters) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const group = (
    label: string,
    options: { value: any; label: string; icon?: any }[],
    key: keyof NoteFilters
  ) => (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="micro" tone="muted" style={styles.upper}>
        {label}
      </AppText>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip
            key={String(o.value)}
            label={o.label}
            icon={o.icon}
            selected={(draft[key] ?? (key === 'sort' ? 'recent' : 'all')) === o.value}
            onPress={() => setDraft({ ...draft, [key]: o.value })}
            testID={`filter-${String(key)}-${String(o.value)}`}
          />
        ))}
      </View>
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('filters')}
      testID="filters-sheet"
      footer={
        <>
          <Button label={t('filter_apply')} onPress={() => onApply(draft)} testID="filters-apply" />
          <Button
            label={t('filter_reset')}
            variant="ghost"
            onPress={() =>
              onApply({ status: 'all', source_type: 'all', sort: 'recent', archived: filters.archived })
            }
            testID="filters-reset"
          />
        </>
      }
    >
      {group(
        t('filter_sort'),
        [
          { value: 'recent', label: t('sort_recent') },
          { value: 'oldest', label: t('sort_oldest') },
          { value: 'title', label: t('sort_title') },
          { value: 'duration', label: t('sort_duration') },
        ],
        'sort'
      )}
      {group(
        t('filter_status'),
        [
          { value: 'all', label: t('status_all') },
          { value: 'ready', label: t('status_ready') },
          { value: 'processing', label: t('status_processing') },
          { value: 'failed', label: t('status_failed') },
        ],
        'status'
      )}
      {group(
        t('filter_source'),
        [
          { value: 'all', label: t('status_all') },
          { value: 'recording', label: t('capture_record'), icon: 'mic' },
          { value: 'audio', label: 'Audio', icon: 'musical-notes' },
          { value: 'video', label: 'Vidéo', icon: 'videocam' },
          { value: 'document', label: 'Document', icon: 'document-text' },
          { value: 'text', label: 'Texte', icon: 'create' },
          { value: 'url', label: 'Lien', icon: 'link' },
        ],
        'source_type'
      )}
      {group(
        t('filter_period'),
        [
          { value: undefined, label: t('period_all') },
          { value: 'today', label: t('period_today') },
          { value: 'week', label: t('period_week') },
          { value: 'month', label: t('period_month') },
        ],
        'period'
      )}
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="micro" tone="muted" style={styles.upper}>
          {t('filter_folder')}
        </AppText>
        <View style={styles.chips}>
          <Chip
            label={t('status_all')}
            selected={!draft.folder_id}
            onPress={() => setDraft({ ...draft, folder_id: undefined })}
          />
          <Chip
            label={t('unsorted')}
            selected={draft.folder_id === 'unsorted'}
            onPress={() => setDraft({ ...draft, folder_id: 'unsorted' })}
          />
          {folders.map((f) => (
            <Chip
              key={f.id}
              label={f.name}
              count={f.note_count}
              selected={draft.folder_id === f.id}
              onPress={() => setDraft({ ...draft, folder_id: f.id })}
            />
          ))}
        </View>
      </View>
      <View style={styles.chips}>
        <Chip
          label={t('favorites')}
          icon="star"
          tone="warning"
          selected={!!draft.favorite}
          onPress={() => setDraft({ ...draft, favorite: draft.favorite ? undefined : true })}
        />
        <Chip
          label={t('archived')}
          icon="archive"
          selected={!!draft.archived}
          onPress={() => setDraft({ ...draft, archived: draft.archived ? undefined : true })}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  loading: { gap: 10, paddingTop: 16 },
  listContent: { paddingVertical: 16, alignSelf: 'center', width: '100%' },
  footer: { paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.7 },
});
