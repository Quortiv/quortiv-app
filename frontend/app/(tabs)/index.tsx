import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, Note } from '@/src/api';
import { useAuth } from '@/src/auth';
import { CaptureSheet } from '@/src/components/CaptureSheet';
import { NoteCard } from '@/src/components/NoteCard';
import { LogoMark } from '@/src/design/Logo';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { IconButton } from '@/src/ui/Button';
import { Card } from '@/src/ui/Card';
import { EmptyState, NoteSkeleton } from '@/src/ui/Feedback';
import { AppHeader, Container, Screen, SectionHeader } from '@/src/ui/Screen';
import { compactNumber, firstName, formatDuration, greetingKey } from '@/src/utils/format';
import { cacheNotes, flushOutbox, isOffline, readCachedNotes } from '@/src/utils/offline';

type Stats = Awaited<ReturnType<typeof api.stats>>;

const QUICK: { icon: any; labelFr: string; labelEn: string; route: string }[] = [
  { icon: 'mic', labelFr: 'Enregistrer', labelEn: 'Record', route: '/capture/record' },
  { icon: 'create-outline', labelFr: 'Texte', labelEn: 'Text', route: '/capture/text' },
  { icon: 'link-outline', labelFr: 'Lien', labelEn: 'Link', route: '/capture/link' },
  { icon: 'chatbubbles-outline', labelFr: 'Assistant', labelEn: 'Assistant', route: '/assistant' },
];

export default function Home() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [page, s] = await Promise.all([api.listNotes({ limit: 6 }), api.stats()]);
      setNotes(page.items);
      setStats(s);
      setOffline(false);
      cacheNotes(page.items);
      flushOutbox();
    } catch (e) {
      if (isOffline(e)) {
        const cached = await readCachedNotes();
        setNotes(cached?.notes ?? []);
        setOffline(true);
      } else {
        setNotes([]);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const metrics = [
    { label: t('notes_count'), value: compactNumber(stats?.total_notes), icon: 'document-text-outline' as const },
    { label: t('this_week'), value: compactNumber(stats?.notes_this_week), icon: 'trending-up-outline' as const },
    { label: t('note_actions'), value: compactNumber(stats?.open_actions), icon: 'checkbox-outline' as const },
  ];

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={onRefresh}
      testID="home-screen"
      header={
        <AppHeader
          left={<LogoMark size={28} ring={theme.colors.text} slash={theme.colors.brand} />}
          right={
            <View style={styles.headerActions}>
              <IconButton
                icon="search"
                onPress={() => router.push('/search')}
                accessibilityLabel={t('search_title')}
                testID="home-search"
              />
              <IconButton
                icon="notifications-outline"
                onPress={() => router.push('/actions')}
                badge={stats?.open_actions}
                accessibilityLabel={t('actions_title')}
                testID="home-actions"
              />
            </View>
          }
        />
      }
    >
      <View style={styles.hero}>
        <AppText variant="title1" numberOfLines={2}>
          {t(greetingKey())}
          {user?.name && !user.is_guest ? `, ${firstName(user.name)}` : ''}
        </AppText>
        <AppText variant="callout" tone="muted">
          {t('home_prompt')}
        </AppText>
      </View>

      {offline ? (
        <Card variant="flat" style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.warning} />
          <View style={styles.flex}>
            <AppText variant="label">{t('offline_title')}</AppText>
            <AppText variant="caption" tone="muted">
              {t('offline_desc')}
            </AppText>
          </View>
        </Card>
      ) : null}

      <View style={styles.metrics}>
        {metrics.map((m) => (
          <Card key={m.label} variant="flat" style={styles.metric} padded={false}>
            <View style={styles.metricInner}>
              <Ionicons name={m.icon} size={15} color={theme.colors.textMuted} />
              <AppText variant="title2">{m.value}</AppText>
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                {m.label}
              </AppText>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('quick_capture')} />
        <View style={styles.quickGrid}>
          {QUICK.map((q) => (
            <Pressable
              key={q.route}
              onPress={() => router.push(q.route as any)}
              testID={`quick-${q.icon}`}
              accessibilityRole="button"
              accessibilityLabel={lang === 'fr' ? q.labelFr : q.labelEn}
              style={({ pressed }) => [
                styles.quickItem,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  opacity: pressed ? 0.8 : 1,
                },
                theme.shadows.xs,
              ]}
            >
              <View
                style={[
                  styles.quickIcon,
                  { backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.sm },
                ]}
              >
                <Ionicons name={q.icon} size={19} color={theme.colors.brand} />
              </View>
              <AppText variant="caption" numberOfLines={1}>
                {lang === 'fr' ? q.labelFr : q.labelEn}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title={t('recent_notes')}
          action={notes?.length ? t('see_all') : undefined}
          onAction={() => router.push('/notes')}
        />
        {notes === null ? (
          <View style={styles.list}>
            <NoteSkeleton />
            <NoteSkeleton />
          </View>
        ) : notes.length === 0 ? (
          <EmptyState
            icon="sparkles-outline"
            title={t('no_notes_title')}
            description={t('no_notes_desc')}
            actionLabel={t('create_first')}
            onAction={() => setCaptureOpen(true)}
            testID="home-empty"
          />
        ) : (
          <View style={styles.list}>
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onPress={() => router.push(`/note/${note.id}` as any)} />
            ))}
          </View>
        )}
      </View>

      {stats && stats.total_duration_sec > 0 ? (
        <Container padded={false} style={styles.footerNote}>
          <AppText variant="micro" tone="muted" center>
            {formatDuration(stats.total_duration_sec)} · {compactNumber(stats.total_words)} {t('words')}
          </AppText>
        </Container>
      ) : null}

      <CaptureSheet visible={captureOpen} onClose={() => setCaptureOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hero: { gap: 4, marginBottom: 20 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  flex: { flex: 1 },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1 },
  metricInner: { padding: 14, gap: 3, alignItems: 'flex-start' },
  section: { marginTop: 28 },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 84,
  },
  quickIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 },
  footerNote: { marginTop: 24 },
});
