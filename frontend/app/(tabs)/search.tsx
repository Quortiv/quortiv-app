import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/api';
import { useT } from '@/src/auth';
import { NoteCard } from '@/src/components/Cards';
import { colors, spacing, radius } from '@/src/theme';

const dayjs = require('dayjs');

export default function Search() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ folder_id?: string; folder_name?: string }>();
  const router = useRouter();
  const t = useT();
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listNotes({ folder_id: params.folder_id, q: q || undefined });
      setNotes(list);
    } catch {}
    setLoading(false);
  }, [q, params.folder_id]);

  useEffect(() => {
    const h = setTimeout(load, 300);
    return () => clearTimeout(h);
  }, [q, load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        {params.folder_id && (
          <Pressable onPress={() => router.setParams({ folder_id: undefined, folder_name: undefined } as any)} testID="clear-folder-btn">
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
        )}
        <Text style={styles.title}>
          {params.folder_name ? params.folder_name : t('tabs_search')}
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="search-input"
          placeholder={t('search_placeholder')}
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          style={styles.input}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} testID="clear-search-btn">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.brandPrimary} />
      ) : notes.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>{t('no_results')}</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <NoteCard
              testID={`search-note-${item.id}`}
              title={item.title}
              date={dayjs(item.created_at).format('DD MMM')}
              tag={item.template_name}
              status={item.status}
              onPress={() => router.push(`/note/${item.id}` as any)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  headerRow: { paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.onSurface, letterSpacing: -0.4 },
  searchBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  input: { flex: 1, fontSize: 15, color: colors.onSurface, paddingVertical: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: 100 },
  emptyText: { fontSize: 15, color: colors.muted },
});
