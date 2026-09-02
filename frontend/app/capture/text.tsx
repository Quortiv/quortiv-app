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
import { Chip } from '@/src/ui/Card';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input, Switch } from '@/src/ui/Input';
import { AppHeader, Container, Screen } from '@/src/ui/Screen';
import { isOffline, queueCapture } from '@/src/utils/offline';

export default function TextCapture() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useFeedback();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [analyze, setAnalyze] = useState(true);
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

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip) setText((prev) => (prev ? `${prev}\n${clip}` : clip));
    else toast(lang === 'fr' ? 'Presse-papiers vide' : 'Clipboard is empty', 'info');
  };

  const submit = async () => {
    if (text.trim().length < 5) {
      setError(lang === 'fr' ? 'Ajoutez un peu plus de contenu.' : 'Add a little more content.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      text: text.trim(),
      title: title.trim() || undefined,
      folder_id: folderId || undefined,
      template_id: template?.id,
      language: lang,
      analyze,
    };
    try {
      const note = await api.fromText(payload);
      router.replace(`/note/${note.id}` as any);
    } catch (e: any) {
      if (isOffline(e)) {
        await queueCapture(payload);
        toast(
          lang === 'fr'
            ? 'Hors ligne : la note partira à la reconnexion.'
            : 'Offline: the note will sync when you reconnect.',
          'warning'
        );
        router.back();
      } else {
        setError(e?.message || t('error_generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <Screen
      padded={false}
      testID="text-capture-screen"
      header={<AppHeader onBack title={t('capture_text')} />}
      footer={
        <Button
          label={analyze ? t('analyze') : t('save')}
          icon={analyze ? 'sparkles' : 'save-outline'}
          onPress={submit}
          loading={busy}
          testID="text-submit"
        />
      }
    >
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container style={styles.form}>
          <Input
            label={t('title_placeholder')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('title_placeholder')}
            counterMax={120}
            testID="text-title"
          />
          <Input
            label={`${t('capture_text')} · ${words} ${t('words')}`}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            placeholder={t('text_placeholder')}
            multiline
            error={error}
            style={styles.textarea}
            testID="text-body"
            rightSlot={
              <Ionicons
                name="clipboard-outline"
                size={18}
                color={theme.colors.brand}
                onPress={paste}
                accessibilityRole="button"
                accessibilityLabel={t('copy')}
              />
            }
          />

          <View style={styles.chipsRow}>
            <Chip
              label={template?.name || t('template')}
              icon="albums-outline"
              tone="brand"
              onPress={() => setTemplateSheet(true)}
              testID="text-template"
            />
            <Chip
              label={folders.find((f) => f.id === folderId)?.name || t('unsorted')}
              icon="folder-outline"
              onPress={() => setFolderSheet(true)}
              testID="text-folder"
            />
          </View>

          <View style={[styles.analyzeRow, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.brand} />
            <View style={styles.flex}>
              <AppText variant="label">{t('analyze')}</AppText>
              <AppText variant="micro" tone="muted">
                {lang === 'fr'
                  ? 'Génère une synthèse, des points clés et des actions.'
                  : 'Generates a brief, key points and action items.'}
              </AppText>
            </View>
            <Switch
              value={analyze}
              onValueChange={setAnalyze}
              accessibilityLabel={t('analyze')}
              testID="text-analyze-toggle"
            />
          </View>
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
  textarea: { minHeight: 200 },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  analyzeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
