import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { api, Folder, Template } from '@/src/api';
import { useAuth } from '@/src/auth';
import { FolderPickerSheet, TemplatePickerSheet } from '@/src/components/Pickers';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { Card, Chip } from '@/src/ui/Card';
import { Input } from '@/src/ui/Input';
import { AppHeader, Container, Screen } from '@/src/ui/Screen';

export default function LinkCapture() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user } = useAuth();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [folderId, setFolderId] = useState<string | null>(user?.prefs?.default_folder_id || null);
  const [templateSheet, setTemplateSheet] = useState(false);
  const [folderSheet, setFolderSheet] = useState(false);

  useEffect(() => {
    api
      .listTemplates()
      .then((list) => {
        setTemplates(list);
        setTemplate(
          list.find((x) => x.id === user?.prefs?.default_template_id) ||
            list.find((x) => !x.is_specialized) ||
            list[0] ||
            null
        );
      })
      .catch(() => {});
    api.listFolders().then(setFolders).catch(() => {});
  }, [user?.prefs?.default_template_id]);

  const submit = async () => {
    const value = url.trim();
    if (!/^https?:\/\/.+\..+/.test(value)) {
      setError(lang === 'fr' ? 'Saisissez une URL valide (https://…).' : 'Enter a valid URL (https://…).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const note = await api.fromUrl({
        url: value,
        title: title.trim() || undefined,
        folder_id: folderId || undefined,
        template_id: template?.id,
        language: lang,
      });
      router.replace(`/note/${note.id}` as any);
    } catch (e: any) {
      setError(e?.message || t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      padded={false}
      testID="link-capture-screen"
      header={<AppHeader onBack title={t('capture_link')} />}
      footer={<Button label={t('import')} icon="cloud-download-outline" onPress={submit} loading={busy} testID="link-submit" />}
    >
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container style={styles.form}>
          <Input
            label="URL"
            value={url}
            onChangeText={(v) => {
              setUrl(v);
              setError(null);
            }}
            placeholder={t('url_placeholder')}
            icon="link-outline"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={error}
            autoFocus
            testID="link-url"
            rightSlot={
              <Ionicons
                name="clipboard-outline"
                size={18}
                color={theme.colors.brand}
                onPress={async () => {
                  const clip = await Clipboard.getStringAsync();
                  if (clip) setUrl(clip.trim());
                }}
                accessibilityRole="button"
                accessibilityLabel={t('copy')}
              />
            }
          />
          <Input
            label={t('title_placeholder')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('title_placeholder')}
            counterMax={120}
            testID="link-title"
          />

          <View style={styles.chipsRow}>
            <Chip
              label={template?.name || t('template')}
              icon="albums-outline"
              tone="brand"
              onPress={() => setTemplateSheet(true)}
              testID="link-template"
            />
            <Chip
              label={folders.find((f) => f.id === folderId)?.name || t('unsorted')}
              icon="folder-outline"
              onPress={() => setFolderSheet(true)}
              testID="link-folder"
            />
          </View>

          <Card variant="flat" style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
            <AppText variant="caption" tone="muted" style={styles.flex}>
              {lang === 'fr'
                ? 'Fonctionne avec les articles et pages publiques, ainsi que les fichiers .vtt, .srt, .pdf et .txt accessibles directement. Les plateformes vidéo protègent leurs transcriptions : exportez le sous-titre ou l’audio, puis importez le fichier.'
                : 'Works with public articles and pages, plus directly accessible .vtt, .srt, .pdf and .txt files. Video platforms protect their transcripts: export the subtitle or audio file and import it instead.'}
            </AppText>
          </Card>
        </Container>
      </KeyboardAwareScrollView>

      <TemplatePickerSheet
        visible={templateSheet}
        onClose={() => setTemplateSheet(false)}
        templates={templates}
        selectedId={template?.id}
        onSelect={setTemplate}
      />
      <FolderPickerSheet
        visible={folderSheet}
        onClose={() => setFolderSheet(false)}
        folders={folders}
        selectedId={folderId}
        onSelect={setFolderId}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 16 },
  form: { gap: 16 },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
});
