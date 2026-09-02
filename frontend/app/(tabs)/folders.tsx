import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/src/api';
import { useT } from '@/src/auth';
import { colors, spacing, radius, shadow } from '@/src/theme';

type Folder = { id: string; name: string; color: string; note_count: number };

const COLORS = ['#0066CC', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Folders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const load = useCallback(async () => {
    try {
      const list = await api.listFolders();
      setFolders(list);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.createFolder(name.trim(), color);
      setName('');
      setColor(COLORS[0]);
      setModal(false);
      load();
    } catch {}
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs_folders')}</Text>
        <Pressable style={styles.addBtn} onPress={() => setModal(true)} testID="add-folder-btn">
          <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={folders}
        numColumns={2}
        keyExtractor={(f) => f.id}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
        renderItem={({ item }) => (
          <Pressable
            testID={`folder-card-${item.id}`}
            style={[styles.card, shadow.card]}
            onPress={() => router.push({ pathname: '/(tabs)/search', params: { folder_id: item.id, folder_name: item.name } } as any)}
          >
            <View style={[styles.folderIcon, { backgroundColor: item.color + '22' }]}>
              <Ionicons name="folder" size={26} color={item.color} />
            </View>
            <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.folderCount}>{item.note_count} notes</Text>
          </Pressable>
        )}
      />

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModal(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('folder_new')}</Text>
            <TextInput
              testID="folder-name-input"
              placeholder={t('folder_name')}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                  testID={`color-${c}`}
                />
              ))}
            </View>
            <Pressable style={styles.saveBtn} onPress={create} testID="folder-save-btn">
              <Text style={styles.saveText}>{t('save')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.onSurface, letterSpacing: -0.4 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 120,
  },
  folderIcon: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  folderName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  folderCount: { fontSize: 12, color: colors.muted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl + spacing.md,
    gap: spacing.md,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    fontSize: 15, color: colors.onSurface,
  },
  colorRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: colors.onSurface },
  saveBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14, borderRadius: radius.pill,
    alignItems: 'center', marginTop: spacing.sm,
  },
  saveText: { color: colors.onBrandPrimary, fontWeight: '700', fontSize: 15 },
});
