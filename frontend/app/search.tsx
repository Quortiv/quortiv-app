import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, Note } from '@/src/api';
import { NoteCard, SourceIcon } from '@/src/components/NoteCard';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Card, Chip } from '@/src/ui/Card';
import { EmptyState, LoadingState, NoteSkeleton } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { SearchField, Switch } from '@/src/ui/Input';
import { AppHeader, Container, Screen, SectionHeader } from '@/src/ui/Screen';
import { excerpt, formatRelative } from '@/src/utils/format';

export default function Search() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { toast } = useFeedback();

  const [query, setQuery] = useState('');
  const [smart, setSmart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [recent, setRecent] = useState<Note[]>([]);

  useEffect(() => {
    api.listTags().then(setTags).catch(() => {});
    api.listNotes({ limit: 4 }).then((p) => setRecent(p.items)).catch(() => {});
  }, []);

  /* Debounced keyword search; smart search runs on submit only (it calls the model). */
  useEffect(() => {
    if (smart) return;
    if (query.trim().length < 2) {
      setResults(null);
      setExpanded([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await api.listNotes({ q: query.trim(), limit: 30 });
        setResults(page.items);
      } catch (e: any) {
        toast(e?.message || t('error_generic'), 'error');
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => clearTimeout(handle);
  }, [query, smart, t, toast]);

  const runSmart = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await api.smartSearch(query.trim());
      setResults(res.items);
      setExpanded(res.expanded_terms || []);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      scroll
      testID="search-screen"
      header={<AppHeader onBack title={t('search_title')} />}
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('search_placeholder')}
        onSubmit={smart ? runSmart : undefined}
        autoFocus
        testID="search-input"
      />

      <Card variant="flat" style={styles.smartRow}>
        <Ionicons name="sparkles-outline" size={18} color={theme.colors.brand} />
        <View style={styles.flex}>
          <AppText variant="label">{t('search_smart')}</AppText>
          <AppText variant="micro" tone="muted">
            {t('search_smart_hint')}
          </AppText>
        </View>
        <Switch
          value={smart}
          onValueChange={(v) => {
            setSmart(v);
            setResults(null);
            setExpanded([]);
          }}
          accessibilityLabel={t('search_smart')}
          testID="search-smart-toggle"
        />
      </Card>

      {smart && query.trim().length >= 2 ? (
        <Chip
          label={t('search_smart')}
          icon="search"
          tone="brand"
          onPress={runSmart}
          testID="search-smart-run"
        />
      ) : null}

      {expanded.length ? (
        <View style={styles.termsRow}>
          {expanded.slice(0, 6).map((term) => (
            <Chip key={term} label={term} tone="accent" />
          ))}
        </View>
      ) : null}

      {loading ? (
        <LoadingState label={smart ? t('assistant_thinking') : t('loading')} />
      ) : results === null ? (
        <>
          {tags.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('tags')} />
              <View style={styles.termsRow}>
                {tags.slice(0, 12).map((item) => (
                  <Chip
                    key={item.tag}
                    label={item.tag}
                    count={item.count}
                    onPress={() => setQuery(item.tag)}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {recent.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('recent_notes')} />
              <View style={styles.list}>
                {recent.map((note) => (
                  <NoteCard key={note.id} note={note} onPress={() => router.push(`/note/${note.id}` as any)} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={t('search_no_results')}
          description={t('search_no_results_desc')}
          testID="search-empty"
        />
      ) : (
        <View style={styles.section}>
          <SectionHeader title={`${results.length} ${t('notes_count')}`} />
          <View style={styles.list}>
            {results.map((item) => (
              <Card
                key={item.id}
                onPress={() => router.push(`/note/${item.id}` as any)}
                testID={`result-${item.id}`}
                accessibilityLabel={item.title}
              >
                <View style={styles.resultRow}>
                  <SourceIcon type={item.source_type} size={32} />
                  <View style={styles.flex}>
                    <AppText variant="title3" numberOfLines={2}>
                      {item.title}
                    </AppText>
                    {item.snippet || item.summary ? (
                      <AppText variant="callout" tone="muted" numberOfLines={2}>
                        {item.snippet || excerpt(item.summary, 120)}
                      </AppText>
                    ) : null}
                    <View style={styles.resultMeta}>
                      <AppText variant="micro" tone="muted">
                        {formatRelative(item.created_at, lang)}
                      </AppText>
                      {item.matched_terms?.length ? (
                        <AppText variant="micro" tone="brand" numberOfLines={1}>
                          {item.matched_terms.slice(0, 3).join(' · ')}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  smartRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  section: { marginTop: 24 },
  list: { gap: 10 },
  resultRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
});
