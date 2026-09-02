import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { api, Folder, Template } from '@/src/api';
import { useAuth } from '@/src/auth';
import { FolderPickerSheet, TemplatePickerSheet } from '@/src/components/Pickers';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Card, Chip } from '@/src/ui/Card';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Switch } from '@/src/ui/Input';
import { AppHeader, Screen } from '@/src/ui/Screen';
import { formatTimer } from '@/src/utils/format';

const CHUNK_SECONDS = 22;
const BARS = 28;

type Phase = 'idle' | 'recording' | 'paused' | 'finalizing';

export default function RecordScreen() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'blocked'>('unknown');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [liveMode, setLiveMode] = useState(true);
  const [consent, setConsent] = useState(!!user?.prefs?.recording_consent_ack);
  const [transcript, setTranscript] = useState('');
  const [chunkBusy, setChunkBusy] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [folderId, setFolderId] = useState<string | null>(user?.prefs?.default_folder_id || null);
  const [templateSheet, setTemplateSheet] = useState(false);
  const [folderSheet, setFolderSheet] = useState(false);

  const timerRef = useRef<any>(null);
  const chunkOffset = useRef(0);
  const stopping = useRef(false);
  const pulse = useSharedValue(1);

  useEffect(() => {
    api.listTemplates().then((list) => {
      setTemplates(list);
      const preferred =
        list.find((x) => x.id === user?.prefs?.default_template_id) || list.find((x) => !x.is_specialized);
      setTemplate(preferred || list[0] || null);
    }).catch(() => {});
    api.listFolders().then(setFolders).catch(() => {});
  }, [user?.prefs?.default_template_id]);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.getRecordingPermissionsAsync();
      if (status.granted) setPermission('granted');
      else setPermission(status.canAskAgain ? 'unknown' : 'blocked');
    })();
  }, []);

  useEffect(() => {
    if (phase === 'recording') {
      pulse.value = withRepeat(withTiming(1.12, { duration: 900 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [phase, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const requestPermission = async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (status.granted) {
      setPermission('granted');
      return true;
    }
    setPermission(status.canAskAgain ? 'denied' : 'blocked');
    return false;
  };

  const uploadChunk = useCallback(
    async (uri: string, offset: number, targetNote: string) => {
      setChunkBusy(true);
      try {
        const res = await api.uploadChunk(targetNote, uri, offset, lang);
        if (res.transcription) setTranscript(res.transcription);
      } catch {
        /* a failed slice must not break the session; the full audio is analysed at the end */
      } finally {
        setChunkBusy(false);
      }
    },
    [lang]
  );

  /** Segmented capture: stop → upload → restart, so text appears while speaking. */
  const rotateChunk = useCallback(async () => {
    if (!noteId || stopping.current) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const offset = chunkOffset.current;
      chunkOffset.current += CHUNK_SECONDS;
      if (uri) uploadChunk(uri, offset, noteId);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      /* recorder busy — next tick retries */
    }
  }, [noteId, recorder, uploadChunk]);

  const start = async () => {
    if (permission !== 'granted') {
      const ok = await requestPermission();
      if (!ok) return;
    }
    if (!consent) {
      toast(t('rec_consent_desc'), 'warning');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      const draft = await api.createDraft({
        template_id: template?.id,
        folder_id: folderId || undefined,
        language: lang,
      });
      setNoteId(draft.id);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
      setElapsed(0);
      chunkOffset.current = 0;
      stopping.current = false;

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (liveMode && next > 0 && next % CHUNK_SECONDS === 0) rotateChunk();
          return next;
        });
      }, 1000);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const pause = async () => {
    try {
      recorder.pause();
      setPhase('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const resume = async () => {
    try {
      recorder.record();
      setPhase('recording');
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (liveMode && next > 0 && next % CHUNK_SECONDS === 0) rotateChunk();
          return next;
        });
      }, 1000);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const finish = async () => {
    if (!noteId) return;
    stopping.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('finalizing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      /* Live mode: the trailing slice completes the transcript. Continuous mode: the
         single file is stored for playback and transcribed with timestamps server-side. */
      if (liveMode && uri) await api.uploadChunk(noteId, uri, chunkOffset.current, lang).catch(() => {});
      await api.finalizeRecording(noteId, {
        uri: liveMode ? null : uri,
        duration_sec: elapsed,
        template_id: template?.id,
        folder_id: folderId || undefined,
        language: lang,
      });
      router.replace(`/note/${noteId}` as any);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
      setPhase('paused');
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: t('rec_discard_title'),
      message: t('rec_discard_desc'),
      confirmLabel: t('delete'),
      destructive: true,
    });
    if (!ok) return;
    stopping.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (phase !== 'idle') await recorder.stop();
    } catch {
      /* already stopped */
    }
    if (noteId) api.discardDraft(noteId).catch(() => {});
    router.back();
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  const metering = recorderState.metering ?? -60;
  const level = Math.max(0, Math.min(1, (metering + 60) / 60));

  if (permission === 'blocked' || permission === 'denied') {
    return (
      <Screen testID="record-permission" header={<AppHeader onBack title={t('capture_record')} />}>
        <View style={styles.permissionWrap}>
          <View
            style={[
              styles.permissionIcon,
              { backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.lg },
            ]}
          >
            <Ionicons name="mic-off-outline" size={30} color={theme.colors.danger} />
          </View>
          <AppText variant="title2" center>
            {t('rec_permission_title')}
          </AppText>
          <AppText variant="callout" tone="muted" center>
            {permission === 'blocked' ? t('rec_permission_blocked') : t('rec_permission_desc')}
          </AppText>
          <View style={styles.permissionActions}>
            {permission === 'denied' ? (
              <Button
                label={t('rec_permission_allow')}
                icon="mic"
                onPress={requestPermission}
                testID="record-request-permission"
              />
            ) : null}
            <Button
              label={t('rec_open_settings')}
              variant="secondary"
              icon="settings-outline"
              onPress={() => Linking.openSettings()}
              testID="record-open-settings"
            />
            <Button
              label={t('capture_text')}
              variant="ghost"
              onPress={() => router.replace('/capture/text')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID="record-screen"
      header={
        <AppHeader
          onBack={phase === 'idle' ? undefined : discard}
          title={
            phase === 'recording'
              ? t('rec_recording')
              : phase === 'paused'
                ? t('rec_paused')
                : t('rec_ready')
          }
          left={
            phase === 'idle' ? (
              <IconButton
                icon="close"
                onPress={() => router.back()}
                accessibilityLabel={t('close')}
                testID="record-close"
              />
            ) : undefined
          }
        />
      }
      footer={
        phase === 'idle' ? (
          <Button label={t('rec_start')} icon="mic" onPress={start} testID="record-start" />
        ) : phase === 'finalizing' ? (
          <Button label={t('rec_stop')} loading testID="record-finalizing" />
        ) : (
          <View style={styles.footerRow}>
            <Button
              label={phase === 'recording' ? t('rec_pause') : t('rec_resume')}
              variant="secondary"
              icon={phase === 'recording' ? 'pause' : 'play'}
              onPress={phase === 'recording' ? pause : resume}
              style={styles.flex}
              testID="record-pause"
            />
            <Button
              label={t('rec_stop')}
              icon="checkmark"
              onPress={finish}
              style={styles.flex}
              testID="record-stop"
            />
          </View>
        )
      }
    >
      <View style={styles.timerBlock}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: phase === 'recording' ? theme.colors.dangerSoft : theme.colors.brandSoft,
              borderRadius: theme.radius.pill,
            },
            pulseStyle,
          ]}
        >
          <Ionicons
            name={phase === 'recording' ? 'mic' : phase === 'paused' ? 'pause' : 'mic-outline'}
            size={34}
            color={phase === 'recording' ? theme.colors.danger : theme.colors.brand}
          />
        </Animated.View>
        <AppText variant="display" style={styles.timer} testID="record-timer">
          {formatTimer(elapsed)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {phase === 'idle'
            ? t('rec_ready')
            : chunkBusy
              ? t('assistant_thinking')
              : phase === 'recording'
                ? t('rec_recording')
                : t('rec_paused')}
        </AppText>
      </View>

      <View style={styles.waveRow} accessibilityLabel="Niveau audio">
        {Array.from({ length: BARS }).map((_, i) => {
          const center = Math.abs(i - BARS / 2) / (BARS / 2);
          const height =
            phase === 'recording' ? 6 + level * 46 * (1 - center * 0.75) * (0.55 + Math.random() * 0.65) : 5;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: Math.max(4, height),
                borderRadius: 3,
                backgroundColor: phase === 'recording' ? theme.colors.brand : theme.colors.border,
                opacity: phase === 'recording' ? 0.5 + level * 0.5 : 1,
              }}
            />
          );
        })}
      </View>

      {phase === 'idle' ? (
        <View style={styles.setup}>
          <Card variant="flat" style={styles.settingRow}>
            <Ionicons name="flash-outline" size={18} color={theme.colors.brand} />
            <View style={styles.flexCol}>
              <AppText variant="label">{t('rec_live_transcript')}</AppText>
              <AppText variant="micro" tone="muted">
                {liveMode
                  ? t('rec_live_hint')
                  : lang === 'fr'
                    ? 'Audio conservé pour la lecture synchronisée, transcription à la fin.'
                    : 'Audio kept for synced playback, transcript generated at the end.'}
              </AppText>
            </View>
            <Switch
              value={liveMode}
              onValueChange={setLiveMode}
              accessibilityLabel={t('rec_live_transcript')}
              testID="record-live-toggle"
            />
          </Card>

          <Card variant="flat" style={styles.settingRow}>
            <Ionicons
              name={consent ? 'shield-checkmark' : 'shield-outline'}
              size={18}
              color={consent ? theme.colors.success : theme.colors.warning}
            />
            <View style={styles.flexCol}>
              <AppText variant="label">{t('rec_consent_title')}</AppText>
              <AppText variant="micro" tone="muted">
                {t('rec_consent_desc')}
              </AppText>
            </View>
            <Switch
              value={consent}
              onValueChange={setConsent}
              accessibilityLabel={t('rec_consent_ack')}
              testID="record-consent-toggle"
            />
          </Card>

          <View style={styles.chipsRow}>
            <Chip
              label={template?.name || t('template')}
              icon="albums-outline"
              tone="brand"
              onPress={() => setTemplateSheet(true)}
              testID="record-template"
            />
            <Chip
              label={folders.find((f) => f.id === folderId)?.name || t('unsorted')}
              icon="folder-outline"
              onPress={() => setFolderSheet(true)}
              testID="record-folder"
            />
          </View>
        </View>
      ) : (
        <Card style={styles.transcriptCard}>
          <View style={styles.transcriptHeader}>
            <AppText variant="micro" tone="muted" style={styles.upper}>
              {liveMode ? t('rec_live_transcript') : t('note_transcript')}
            </AppText>
            {chunkBusy ? <Ionicons name="sync" size={13} color={theme.colors.brand} /> : null}
          </View>
          <ScrollView style={styles.transcriptScroll} showsVerticalScrollIndicator={false}>
            <AppText variant="body" tone={transcript ? 'secondary' : 'muted'} testID="record-transcript">
              {transcript ||
                (liveMode
                  ? t('rec_waiting')
                  : lang === 'fr'
                    ? 'La transcription sera générée à la fin de l’enregistrement.'
                    : 'The transcript will be generated once you finish.')}
            </AppText>
          </ScrollView>
        </Card>
      )}

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
  timerBlock: { alignItems: 'center', gap: 10, paddingTop: 28 },
  pulseRing: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  timer: { fontVariant: ['tabular-nums'], letterSpacing: -1 },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 56,
    marginTop: 20,
  },
  setup: { gap: 12, marginTop: 24 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flexCol: { flex: 1, minWidth: 0, gap: 2 },
  flex: { flex: 1 },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  transcriptCard: { flex: 1, marginTop: 20, marginBottom: 12 },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  transcriptScroll: { flex: 1 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.7 },
  footerRow: { flexDirection: 'row', gap: 10 },
  permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  permissionIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  permissionActions: { marginTop: 20, gap: 10, width: '100%', maxWidth: 320 },
});
