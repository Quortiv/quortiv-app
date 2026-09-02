import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, spacing, radius, shadow } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth, useT } from '@/src/auth';
import { NoteCard, Chip } from '@/src/components/Cards';

const dayjs = require('dayjs');

type Note = {
  id: string;
  title: string;
  created_at: string;
  duration_sec: number;
  status: string;
  template_name?: string;
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'ready' | 'processing'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listNotes();
      setNotes(list);
    } catch (e) {
      console.warn('load notes failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = notes.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'ready') return n.status === 'ready';
    if (filter === 'processing') return n.status === 'processing';
    const now = dayjs();
    const created = dayjs(n.created_at);
    if (filter === 'today') return created.isSame(now, 'day');
    if (filter === 'week') return now.diff(created, 'day') < 7;
    return true;
  });

  const formatDur = (s: number) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('home_greeting')} 👋</Text>
          <Text style={styles.name}>{user?.name || user?.email?.split('@')[0]}</Text>
        </View>
        <View style={styles.avatar} testID="user-avatar">
          <Text style={styles.avatarText}>
            {(user?.name || user?.email || '?').substring(0, 1).toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.subtitle}>{t('home_subtitle')}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        <Chip label={t('filter_all')} active={filter === 'all'} onPress={() => setFilter('all')} testID="chip-all" />
        <Chip label={t('filter_today')} active={filter === 'today'} onPress={() => setFilter('today')} testID="chip-today" />
        <Chip label={t('filter_week')} active={filter === 'week'} onPress={() => setFilter('week')} testID="chip-week" />
        <Chip label={t('filter_ready')} active={filter === 'ready'} onPress={() => setFilter('ready')} testID="chip-ready" />
        <Chip label={t('filter_processing')} active={filter === 'processing'} onPress={() => setFilter('processing')} testID="chip-processing" />
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="mic-outline" size={40} color={colors.brandPrimary} />
          </View>
          <Text style={styles.emptyTitle}>{t('empty_notes_title')}</Text>
          <Text style={styles.emptyDesc}>{t('empty_notes_desc')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => (
            <NoteCard
              testID={`note-card-${item.id}`}
              title={item.title}
              date={dayjs(item.created_at).format('DD MMM')}
              duration={formatDur(item.duration_sec)}
              tag={item.template_name}
              status={item.status}
              onPress={() => router.push(`/note/${item.id}` as any)}
            />
          )}
        />
      )}

      <Pressable
        testID="new-recording-fab"
        style={[styles.fab, shadow.fab, { bottom: insets.bottom + 76 }]}
        onPress={() => router.push('/new-recording' as any)}
      >
        <Ionicons name="mic" size={22} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>{t('new_recording')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { fontSize: 14, color: colors.muted },
  name: { fontSize: 22, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onBrandPrimary, fontWeight: '700' },
  subtitle: { paddingHorizontal: spacing.lg, color: colors.onSurfaceSecondary, marginBottom: spacing.md },
  chipsScroll: { maxHeight: 56, flexGrow: 0, marginBottom: spacing.sm },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center', height: 56 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.brandTertiary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: 6 },
  emptyDesc: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fabText: { color: colors.onBrandPrimary, fontWeight: '700', fontSize: 15 },
});
