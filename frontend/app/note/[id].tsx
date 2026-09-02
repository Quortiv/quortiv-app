import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/api';
import { useT } from '@/src/auth';
import { colors, spacing, radius } from '@/src/theme';

const dayjs = require('dayjs');

type Tab = 'summary' | 'transcript' | 'actions' | 'plan';

export default function NoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const [note, setNote] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const n = await api.getNote(String(id));
      setNote(n);
      // Poll if still processing
      if (n.status === 'processing') {
        setTimeout(load, 3000);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onDelete = () => {
    setConfirmDelete(true);
  };

  const doDelete = async () => {
    try {
      await api.deleteNote(String(id));
      setConfirmDelete(false);
      router.back();
    } catch {
      setConfirmDelete(false);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        title: note.title,
        message: `${note.title}\n\n${note.summary || note.transcription}`,
      });
    } catch {}
  };

  if (loading || !note) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="back-btn">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={onShare} testID="share-btn" style={styles.iconBtn}>
            <Ionicons name="share-outline" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable onPress={onDelete} testID="delete-note-btn" style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title} testID="note-title">{note.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.muted} />
          <Text style={styles.meta}>{dayjs(note.created_at).format('DD MMM YYYY · HH:mm')}</Text>
          {note.template_name ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{note.template_name}</Text>
            </View>
          ) : null}
        </View>
        {note.tags && note.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {note.tags.map((tg: string, i: number) => (
              <View key={i} style={styles.chipTag}><Text style={styles.chipTagText}>#{tg}</Text></View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.tabsBar}>
        {(['summary', 'transcript', 'actions', 'plan'] as Tab[]).map((k) => (
          <Pressable
            key={k}
            testID={`tab-${k}`}
            style={[styles.tabBtn, tab === k && styles.tabBtnActive]}
            onPress={() => setTab(k)}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {k === 'summary' ? t('tab_summary') : k === 'transcript' ? t('tab_transcript') : k === 'actions' ? t('tab_actions') : t('tab_plan')}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32 }}>
        {note.status === 'processing' ? (
          <View style={styles.processingCard}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.processingText}>{t('processing')}</Text>
          </View>
        ) : tab === 'summary' ? (
          <Text style={styles.body} testID="summary-content">{note.summary || '—'}</Text>
        ) : tab === 'transcript' ? (
          <Text style={styles.body} testID="transcript-content">{note.transcription || '—'}</Text>
        ) : tab === 'actions' ? (
          <View style={{ gap: spacing.sm }} testID="actions-content">
            {(note.actions || []).length === 0 ? <Text style={styles.body}>—</Text> :
              note.actions.map((a: string, i: number) => (
                <View key={i} style={styles.actionRow}>
                  <View style={styles.checkBox}><Ionicons name="checkmark" size={14} color={colors.brandPrimary} /></View>
                  <Text style={styles.actionText}>{a}</Text>
                </View>
              ))}
          </View>
        ) : (
          <View style={{ gap: spacing.sm }} testID="plan-content">
            {(note.plan || []).length === 0 ? <Text style={styles.body}>—</Text> :
              note.plan.map((p: string, i: number) => (
                <View key={i} style={styles.planRow}>
                  <View style={styles.planDot}><Text style={styles.planDotText}>{i + 1}</Text></View>
                  <Text style={styles.planText}>{p}</Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmDelete(false)}>
          <Pressable style={styles.confirmSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash" size={22} color={colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Supprimer cette note ?</Text>
            <Text style={styles.confirmDesc}>Cette action est irréversible.</Text>
            <View style={styles.confirmRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirmDelete(false)} testID="cancel-delete-btn">
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={doDelete} testID="confirm-delete-btn">
                <Text style={styles.deleteText}>{t('delete')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { padding: 6 },
  titleBlock: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.onSurface, letterSpacing: -0.4, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 12, color: colors.muted },
  tag: { backgroundColor: colors.brandSecondary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, marginLeft: spacing.sm },
  tagText: { fontSize: 11, color: colors.onBrandSecondary, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chipTag: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  chipTagText: { fontSize: 11, color: colors.onSurfaceSecondary, fontWeight: '600' },
  tabsBar: {
    flexDirection: 'row', backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill,
    marginHorizontal: spacing.lg, padding: 4, marginBottom: spacing.sm,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.pill },
  tabBtnActive: { backgroundColor: colors.surface },
  tabText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.brandPrimary },
  body: { fontSize: 15, lineHeight: 24, color: colors.onSurface },
  actionRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkBox: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: colors.brandTertiary,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  actionText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.onSurface },
  planRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  planDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  planDotText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: '700' },
  planText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.onSurface },
  processingCard: {
    padding: spacing.xl, backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg, alignItems: 'center', gap: spacing.md,
  },
  processingText: { color: colors.onBrandTertiary, fontWeight: '600' },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  confirmSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, width: '100%', maxWidth: 360 },
  confirmIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  confirmDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: 'center' },
  cancelText: { color: colors.onSurface, fontWeight: '600' },
  deleteBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.error, alignItems: 'center' },
  deleteText: { color: '#FFF', fontWeight: '700' },
});
