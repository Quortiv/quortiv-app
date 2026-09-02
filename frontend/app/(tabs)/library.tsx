import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, Folder } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { swatches } from '@/src/design/tokens';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Card, Chip, Divider, ListRow } from '@/src/ui/Card';
import { EmptyState, Skeleton } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input } from '@/src/ui/Input';
import { AppHeader, Screen, SectionHeader } from '@/src/ui/Screen';
import { Sheet } from '@/src/ui/Sheet';

export default function Library() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { toast, confirm } = useFeedback();

  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState<{ folder?: Folder } | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(swatches[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, tg] = await Promise.all([api.listFolders(), api.listTags()]);
      setFolders(f);
      setTags(tg);
    } catch {
      setFolders([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openEditor = (folder?: Folder) => {
    setEditor({ folder });
    setName(folder?.name || '');
    setColor(folder?.color || swatches[0]);
    setError(null);
  };

  const save = async () => {
    if (!name.trim()) {
      setError(t('folder_name'));
      return;
    }
    setSaving(true);
    try {
      if (editor?.folder) await api.updateFolder(editor.folder.id, { name: name.trim(), color });
      else await api.createFolder({ name: name.trim(), color });
      setEditor(null);
      await load();
      toast(t('note_saved'), 'success');
    } catch (e: any) {
      setError(e?.message || t('error_generic'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (folder: Folder) => {
    const ok = await confirm({
      title: t('folder_delete_title'),
      message: t('folder_delete_desc'),
      confirmLabel: t('delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteFolder(folder.id);
      setEditor(null);
      await load();
      toast(t('note_saved'), 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      testID="library-screen"
      header={
        <AppHeader
          title={t('library_title')}
          right={
            <IconButton
              icon="search"
              onPress={() => router.push('/search')}
              accessibilityLabel={t('search_title')}
            />
          }
        />
      }
    >
      <Card padded={false}>
        <ListRow
          icon="documents-outline"
          title={t('all_notes')}
          onPress={() => router.push('/notes')}
          testID="library-all"
        />
        <Divider inset={64} />
        <ListRow
          icon="star-outline"
          iconColor={theme.colors.warning}
          title={t('favorites')}
          onPress={() => router.push('/notes?favorite=1')}
          testID="library-favorites"
        />
        <Divider inset={64} />
        <ListRow
          icon="pricetags-outline"
          title={t('templates')}
          onPress={() => router.push('/templates')}
          testID="library-templates"
        />
        <Divider inset={64} />
        <ListRow
          icon="git-network-outline"
          title={t('insights_graph')}
          onPress={() => router.push('/graph')}
          testID="library-graph"
        />
        <Divider inset={64} />
        <ListRow
          icon="archive-outline"
          title={t('archived')}
          onPress={() => router.push('/notes?archived=1')}
          testID="library-archived"
        />
      </Card>

      <View style={styles.section}>
        <SectionHeader title={t('folders')} action={t('folder_new')} onAction={() => openEditor()} />
        {folders === null ? (
          <View style={styles.list}>
            <Skeleton height={62} radius={theme.radius.md} />
            <Skeleton height={62} radius={theme.radius.md} />
          </View>
        ) : folders.length === 0 ? (
          <EmptyState
            compact
            icon="folder-open-outline"
            title={t('folders')}
            description={t('folder_delete_desc')}
            actionLabel={t('folder_new')}
            onAction={() => openEditor()}
          />
        ) : (
          <View style={styles.list}>
            {folders.map((folder) => (
              <Card key={folder.id} padded={false}>
                <View style={styles.folderRow}>
                  <Pressable
                    style={styles.folderMain}
                    onPress={() => router.push(`/notes?folder_id=${folder.id}&title=${encodeURIComponent(folder.name)}`)}
                    accessibilityRole="button"
                    accessibilityLabel={folder.name}
                    testID={`folder-${folder.id}`}
                  >
                    <View
                      style={[
                        styles.folderIcon,
                        { backgroundColor: `${folder.color}1F`, borderRadius: theme.radius.sm },
                      ]}
                    >
                      <Ionicons name={(folder.icon as any) || 'folder'} size={18} color={folder.color} />
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="bodyMedium" numberOfLines={1}>
                        {folder.name}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {folder.note_count} {t('notes_count')}
                      </AppText>
                    </View>
                  </Pressable>
                  <IconButton
                    icon="ellipsis-horizontal"
                    onPress={() => openEditor(folder)}
                    accessibilityLabel={`${t('edit')} ${folder.name}`}
                    testID={`folder-edit-${folder.id}`}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {tags.length ? (
        <View style={styles.section}>
          <SectionHeader title={t('tags')} />
          <View style={styles.tagWrap}>
            {tags.map((item) => (
              <Chip
                key={item.tag}
                label={item.tag}
                count={item.count}
                onPress={() => router.push(`/notes?tag=${encodeURIComponent(item.tag)}&title=${encodeURIComponent(`#${item.tag}`)}`)}
                testID={`tag-${item.tag}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Sheet
        visible={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.folder ? t('folder_rename') : t('folder_new')}
        footer={
          <>
            <Button label={t('save')} onPress={save} loading={saving} testID="folder-save" />
            {editor?.folder ? (
              <Button
                label={t('delete')}
                variant="danger"
                onPress={() => remove(editor.folder!)}
                testID="folder-delete"
              />
            ) : null}
          </>
        }
      >
        <Input
          label={t('folder_name')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder={t('folder_name')}
          error={error}
          counterMax={60}
          autoFocus
          testID="folder-name-input"
        />
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" tone="secondary">
            {t('folder_color')}
          </AppText>
          <View style={styles.swatches}>
            {swatches.map((s) => (
              <Pressable
                key={s}
                onPress={() => setColor(s)}
                accessibilityRole="button"
                accessibilityLabel={s}
                accessibilityState={{ selected: color === s }}
                testID={`swatch-${s}`}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: s,
                    borderWidth: color === s ? 3 : 0,
                    borderColor: theme.colors.bg,
                    ...(color === s ? theme.shadows.sm : {}),
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  list: { gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  folderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  folderIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 38, height: 38, borderRadius: 19 },
});
