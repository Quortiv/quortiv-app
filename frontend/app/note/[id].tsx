import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { api, Folder, Note, Template } from '@/src/api';
import { ActionsTab } from '@/src/components/note/ActionsTab';
import { ChatPanel } from '@/src/components/note/ChatPanel';
import { SummaryTab } from '@/src/components/note/SummaryTab';
import { TranscriptTab } from '@/src/components/note/TranscriptTab';
import { FolderPickerSheet, TemplatePickerSheet } from '@/src/components/Pickers';
import { useTheme } from '@/src/design/ThemeProvider';
import { sourceMeta } from '@/src/design/tokens';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Card, Chip } from '@/src/ui/Card';
import { ErrorState, LoadingState, ProgressBar, StatusPill } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input, SegmentedControl } from '@/src/ui/Input';
import { AppHeader, Container, Screen } from '@/src/ui/Screen';
import { Sheet, SheetOption } from '@/src/ui/Sheet';
import { formatDateTime, formatDuration } from '@/src/utils/format';
import { cacheNote, isOffline, readCachedNote } from '@/src/utils/offline';
import { copyToClipboard, downloadAndShare, shareText } from '@/src/utils/share';

type Tab = 'summary' | 'transcript' | 'actions' | 'chat';
type SheetKind = 'menu' | 'export' | 'share' | 'level' | 'translate' | null;

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
];

export default function NoteDetail() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast, confirm } = useFeedback();

  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [templateSheet, setTemplateSheet] = useState(false);
  const [folderSheet, setFolderSheet] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [titleSheet, setTitleSheet] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const poll = useRef<any>(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        const fresh = await api.getNote(id!);
        setNote(fresh);
        setError(null);
        cacheNote(fresh);
      } catch (e: any) {
        if (isOffline(e)) {
          const cached = await readCachedNote(id!);
          if (cached) {
            setNote(cached);
            if (!silent) toast(t('offline_desc'), 'warning');
            return;
          }
        }
        if (!silent) setError(e?.message || t('error_generic'));
      }
    },
    [id, t, toast]
  );

  useEffect(() => {
    load();
    api.listTemplates().then(setTemplates).catch(() => {});
    api.listFolders().then(setFolders).catch(() => {});
  }, [load]);

  /* Poll while the AI pipeline is running or a translation is queued. */
  useEffect(() => {
    const pending = note?.status === 'processing' || note?.translation_status === 'processing';
    if (pending && !poll.current) {
      poll.current = setInterval(() => load(true), 4000);
    }
    if (!pending && poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
    return () => {
      if (poll.current && !pending) {
        clearInterval(poll.current);
        poll.current = null;
      }
    };
  }, [note?.status, note?.translation_status, load]);

  useEffect(
    () => () => {
      if (poll.current) clearInterval(poll.current);
    },
    []
  );

  const patch = useCallback(
    async (body: Partial<Note>) => {
      const updated = await api.updateNote(id!, body);
      setNote(updated);
      cacheNote(updated);
    },
    [id]
  );

  const doExport = async (format: 'pdf' | 'md' | 'txt') => {
    setBusy('export');
    setSheet(null);
    try {
      const result = await downloadAndShare(api.exportUrl(id!, format), `${note?.title || 'note'}.${format}`);
      toast(result === 'shared' ? t('note_share') : lang === 'fr' ? 'Fichier téléchargé' : 'File downloaded', 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const doCopy = async () => {
    setSheet(null);
    try {
      const { content } = await api.plainText(id!, 'md');
      await copyToClipboard(content);
      toast(t('note_copied'), 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const doShareText = async () => {
    setSheet(null);
    try {
      const { content, title } = await api.plainText(id!, 'txt');
      const ok = await shareText(content.slice(0, 8000), title);
      if (!ok) toast(t('note_copied'), 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const createLink = async () => {
    setBusy('share');
    try {
      const res = await api.createShare(id!);
      const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/shared/${res.share_id}`;
      await copyToClipboard(url);
      await load(true);
      toast(lang === 'fr' ? 'Lien copié dans le presse-papiers' : 'Link copied to clipboard', 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const revokeLink = async () => {
    try {
      await api.revokeShare(id!);
      await load(true);
      toast(lang === 'fr' ? 'Lien révoqué' : 'Link revoked', 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const reprocess = async (body: { template_id?: string; summary_level?: string }) => {
    setSheet(null);
    try {
      await api.reprocess(id!, body);
      setNote((prev) => (prev ? { ...prev, status: 'processing' } : prev));
      toast(t('note_processing'), 'info');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const translate = async (code: string) => {
    setSheet(null);
    try {
      await api.translate(id!, code, 'both');
      setNote((prev) => (prev ? { ...prev, translation_status: 'processing' } : prev));
      toast(t('note_translate'), 'info');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const remove = async () => {
    setSheet(null);
    const ok = await confirm({
      title: t('note_delete_title'),
      message: t('note_delete_desc'),
      confirmLabel: t('delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteNote(id!);
      router.back();
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  if (error && !note) {
    return (
      <Screen header={<AppHeader onBack title={t('note_summary')} />} testID="note-error-screen">
        <ErrorState message={error} onRetry={() => load()} />
      </Screen>
    );
  }
  if (!note) {
    return (
      <Screen header={<AppHeader onBack />} testID="note-loading">
        <LoadingState label={t('loading')} />
      </Screen>
    );
  }

  const meta = sourceMeta[note.source_type] || sourceMeta.text;
  const folderName = folders.find((f) => f.id === note.folder_id)?.name;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'summary', label: t('note_summary') },
    { value: 'transcript', label: t('note_transcript') },
    { value: 'actions', label: t('note_actions') },
    { value: 'chat', label: t('note_assistant') },
  ];

  const processing = note.status === 'processing';

  return (
    <Screen
      padded={false}
      testID="note-screen"
      header={
        <AppHeader
          onBack
          title={note.title}
          subtitle={`${meta.label} · ${formatDateTime(note.created_at, lang)}`}
          right={
            <View style={styles.headerActions}>
              <IconButton
                icon={note.favorite ? 'star' : 'star-outline'}
                color={note.favorite ? theme.colors.warning : undefined}
                onPress={() => patch({ favorite: !note.favorite })}
                accessibilityLabel={t('note_favorite')}
                testID="note-favorite"
              />
              <IconButton
                icon="ellipsis-horizontal"
                onPress={() => setSheet('menu')}
                accessibilityLabel={t('note_edit')}
                testID="note-menu"
              />
            </View>
          }
        />
      }
    >
      <Container style={styles.metaBar} padded>
        <View style={styles.metaChips}>
          {note.status !== 'ready' ? <StatusPill status={note.status} /> : null}
          {note.duration_sec > 0 ? (
            <Chip label={formatDuration(note.duration_sec)} icon="time-outline" />
          ) : null}
          {note.template_name ? (
            <Chip
              label={note.template_name}
              icon="albums-outline"
              tone="brand"
              onPress={() => setTemplateSheet(true)}
              testID="note-template-chip"
            />
          ) : null}
          <Chip
            label={folderName || t('unsorted')}
            icon="folder-outline"
            onPress={() => setFolderSheet(true)}
            testID="note-folder-chip"
          />
          {note.share_id ? <Chip label={t('note_share_link')} icon="link" tone="success" /> : null}
        </View>
      </Container>

      {processing ? (
        <Container>
          <Card variant="brand" style={styles.processingCard}>
            <View style={styles.processingHead}>
              <Ionicons name="sparkles" size={18} color={theme.colors.brand} />
              <AppText variant="bodyMedium" style={styles.flex}>
                {t('note_processing')}
              </AppText>
            </View>
            <AppText variant="caption" tone="muted">
              {t('note_processing_desc')}
            </AppText>
            <ProgressBar indeterminate />
          </Card>
        </Container>
      ) : null}

      {note.status === 'failed' ? (
        <Container>
          <Card style={[styles.failedCard, { borderColor: theme.colors.danger }]}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
            <AppText variant="callout" tone="secondary" style={styles.flex}>
              {note.error || t('error_generic')}
            </AppText>
            <Button
              label={t('note_failed_retry')}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => reprocess({})}
              testID="note-retry"
            />
          </Card>
        </Container>
      ) : null}

      <Container style={styles.tabs}>
        <SegmentedControl<Tab> value={tab} onChange={setTab} options={tabs} testID="note-tabs" />
      </Container>

      {tab === 'chat' ? (
        <Container style={styles.flex}>
          <ChatPanel noteId={note.id} disabled={processing} />
        </Container>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Container>
            {tab === 'summary' ? (
              note.summary ? (
                <SummaryTab note={note} onChange={patch} />
              ) : (
                <AppText variant="callout" tone="muted" center style={styles.pending}>
                  {processing ? t('note_processing_desc') : t('note_empty_transcript')}
                </AppText>
              )
            ) : null}
            {tab === 'transcript' ? <TranscriptTab note={note} onChange={patch} /> : null}
            {tab === 'actions' ? <ActionsTab note={note} onChange={patch} /> : null}
          </Container>
        </ScrollView>
      )}

      {/* ---------------------------------------------------------------- menu */}
      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={note.title} testID="note-menu-sheet">
        <SheetOption
          icon="pencil-outline"
          title={lang === 'fr' ? 'Renommer' : 'Rename'}
          onPress={() => {
            setTitleDraft(note.title);
            setSheet(null);
            setTitleSheet(true);
          }}
          testID="menu-rename"
        />
        <SheetOption
          icon="download-outline"
          tone="brand"
          title={t('note_export')}
          description="PDF, Markdown, TXT"
          onPress={() => setSheet('export')}
          testID="menu-export"
        />
        <SheetOption
          icon="share-social-outline"
          title={t('note_share')}
          description={note.share_id ? t('note_share_revoke') : t('note_share_create')}
          onPress={() => setSheet('share')}
          testID="menu-share"
        />
        <SheetOption
          icon="language-outline"
          title={t('note_translate')}
          onPress={() => setSheet('translate')}
          disabled={processing || !note.summary}
          testID="menu-translate"
        />
        <SheetOption
          icon="options-outline"
          title={t('note_level')}
          description={t(`note_level_${(note.summary_level || 'standard') as 'brief'}` as any)}
          onPress={() => setSheet('level')}
          disabled={processing || !note.transcription}
          testID="menu-level"
        />
        <SheetOption
          icon="albums-outline"
          title={t('note_change_template')}
          onPress={() => {
            setSheet(null);
            setTemplateSheet(true);
          }}
          disabled={processing || !note.transcription}
          testID="menu-template"
        />
        <SheetOption
          icon="folder-outline"
          title={t('note_move')}
          onPress={() => {
            setSheet(null);
            setFolderSheet(true);
          }}
          testID="menu-move"
        />
        <SheetOption
          icon="archive-outline"
          title={note.archived ? t('note_unarchive') : t('note_archive')}
          onPress={() => {
            patch({ archived: !note.archived });
            setSheet(null);
          }}
          testID="menu-archive"
        />
        <SheetOption icon="copy-outline" title={t('note_copy')} onPress={doCopy} testID="menu-copy" />
        <SheetOption icon="trash-outline" tone="danger" title={t('delete')} onPress={remove} testID="menu-delete" />
      </Sheet>

      {/* -------------------------------------------------------------- export */}
      <Sheet visible={sheet === 'export'} onClose={() => setSheet(null)} title={t('note_export')}>
        <SheetOption
          icon="document-outline"
          tone="brand"
          title="PDF"
          description={lang === 'fr' ? 'Document prêt à diffuser' : 'Ready-to-share document'}
          onPress={() => doExport('pdf')}
          disabled={busy === 'export'}
          testID="export-pdf"
        />
        <SheetOption icon="logo-markdown" title="Markdown" onPress={() => doExport('md')} testID="export-md" />
        <SheetOption icon="text-outline" title="Texte brut" onPress={() => doExport('txt')} testID="export-txt" />
        <SheetOption
          icon="share-outline"
          title={lang === 'fr' ? 'Partager le texte' : 'Share text'}
          onPress={doShareText}
          testID="export-share-text"
        />
      </Sheet>

      {/* --------------------------------------------------------------- share */}
      <Sheet visible={sheet === 'share'} onClose={() => setSheet(null)} title={t('note_share_link')}>
        {note.share_id ? (
          <>
            <Card variant="flat">
              <AppText variant="caption" tone="muted">
                {lang === 'fr' ? 'Lien actif' : 'Active link'}
              </AppText>
              <AppText variant="callout" numberOfLines={2} selectable>
                {`${process.env.EXPO_PUBLIC_BACKEND_URL}/shared/${note.share_id}`}
              </AppText>
            </Card>
            <Button
              label={t('copy')}
              variant="secondary"
              icon="copy-outline"
              onPress={async () => {
                await copyToClipboard(`${process.env.EXPO_PUBLIC_BACKEND_URL}/shared/${note.share_id}`);
                toast(t('note_copied'), 'success');
              }}
              testID="share-copy"
            />
            <Button label={t('note_share_revoke')} variant="danger" onPress={revokeLink} testID="share-revoke" />
          </>
        ) : (
          <>
            <AppText variant="callout" tone="muted">
              {lang === 'fr'
                ? 'Un lien public en lecture seule sera généré. Vous pouvez le révoquer à tout moment.'
                : 'A read-only public link will be generated. You can revoke it at any time.'}
            </AppText>
            <Button
              label={t('note_share_create')}
              icon="link-outline"
              onPress={createLink}
              loading={busy === 'share'}
              testID="share-create"
            />
          </>
        )}
      </Sheet>

      {/* --------------------------------------------------------------- level */}
      <Sheet visible={sheet === 'level'} onClose={() => setSheet(null)} title={t('note_level')}>
        {(['brief', 'standard', 'deep'] as const).map((level) => (
          <SheetOption
            key={level}
            icon={level === 'brief' ? 'flash-outline' : level === 'standard' ? 'reader-outline' : 'library-outline'}
            title={t(`note_level_${level}` as any)}
            badge={note.summary_level === level ? '✓' : undefined}
            onPress={() => reprocess({ summary_level: level })}
            testID={`level-${level}`}
          />
        ))}
      </Sheet>

      {/* ----------------------------------------------------------- translate */}
      <Sheet visible={sheet === 'translate'} onClose={() => setSheet(null)} title={t('note_translate')}>
        {LANGS.filter((l) => l.code !== note.language).map((l) => (
          <SheetOption
            key={l.code}
            icon="language-outline"
            title={l.label}
            badge={note.translations?.[l.code] ? '✓' : undefined}
            onPress={() => translate(l.code)}
            testID={`translate-${l.code}`}
          />
        ))}
      </Sheet>

      <Sheet
        visible={titleSheet}
        onClose={() => setTitleSheet(false)}
        title={lang === 'fr' ? 'Renommer' : 'Rename'}
        footer={
          <Button
            label={t('save')}
            onPress={async () => {
              await patch({ title: titleDraft });
              setTitleSheet(false);
              toast(t('note_saved'), 'success');
            }}
            testID="title-save"
          />
        }
      >
        <Input value={titleDraft} onChangeText={setTitleDraft} autoFocus counterMax={120} testID="title-input" />
      </Sheet>

      <TemplatePickerSheet
        visible={templateSheet}
        onClose={() => setTemplateSheet(false)}
        templates={templates}
        selectedId={note.template_id}
        onSelect={(tpl) => reprocess({ template_id: tpl.id })}
      />
      <FolderPickerSheet
        visible={folderSheet}
        onClose={() => setFolderSheet(false)}
        folders={folders}
        selectedId={note.folder_id}
        onSelect={(folderId) => patch({ folder_id: folderId as any })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  metaBar: { paddingTop: 12 },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  processingCard: { gap: 10, marginTop: 12 },
  processingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  failedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, borderWidth: 1 },
  flex: { flex: 1, minWidth: 0 },
  tabs: { paddingVertical: 14 },
  scrollContent: { paddingBottom: 40 },
  pending: { paddingVertical: 40 },
});
