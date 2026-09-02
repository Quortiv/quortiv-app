import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import { api } from '@/src/api';
import { useAuth, useT } from '@/src/auth';
import { colors, spacing, radius, shadow } from '@/src/theme';

const BAR_COUNT = 24;

function Waveform({ recording }: { recording: boolean }) {
  return (
    <View style={styles.waveWrap}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <Bar key={i} index={i} active={recording} />
      ))}
    </View>
  );
}

function Bar({ index, active }: { index: number; active: boolean }) {
  const h = useSharedValue(8);
  useEffect(() => {
    if (active) {
      const min = 8;
      const max = 20 + Math.random() * 40;
      h.value = withRepeat(
        withSequence(
          withTiming(max, { duration: 400 + index * 25 }),
          withTiming(min, { duration: 400 + index * 25 })
        ),
        -1,
        true
      );
    } else {
      h.value = withTiming(8, { duration: 200 });
    }
  }, [active, index, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, style]} />;
}

export default function NewRecording() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang } = useAuth();
  const t = useT();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const timerRef = useRef<any>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listTemplates();
        setTemplates(list);
        const def = list.find((x: any) => x.is_default) || list[0];
        setSelectedTemplate(def || null);
      } catch (e) {
        console.warn(e);
      }
      try {
        await AudioModule.requestRecordingPermissionsAsync();
      } catch {}
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setStatus(t('permission_denied'));
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      startTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } catch (e: any) {
      console.warn('start error', e);
      setStatus(String(e?.message || e));
    }
  };

  const stopAndProcess = async () => {
    try {
      stopTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await recorder.stop();
      setIsRecording(false);
      const uri = recorder.uri;
      if (!uri) {
        setStatus('Aucun enregistrement');
        return;
      }
      setProcessing(true);
      setStatus(t('processing'));
      const note = await api.uploadAudio(uri, {
        name: `rec-${Date.now()}.m4a`,
        duration_sec: elapsed,
        template_id: selectedTemplate?.id,
        language: lang,
        mime: 'audio/mp4',
      });
      router.replace(`/note/${note.id}` as any);
    } catch (e: any) {
      console.warn('process error', e);
      setStatus(t('error_upload') + ': ' + (e?.message || ''));
      setProcessing(false);
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      setProcessing(true);
      setStatus(t('processing'));
      const note = await api.uploadAudio(asset.uri, {
        name: asset.name || `import-${Date.now()}.m4a`,
        duration_sec: 0,
        template_id: selectedTemplate?.id,
        language: lang,
        mime: asset.mimeType || 'audio/mp4',
      });
      router.replace(`/note/${note.id}` as any);
    } catch (e: any) {
      setStatus(t('error_upload') + ': ' + (e?.message || ''));
      setProcessing(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} testID="close-recording-btn" disabled={processing}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('new_recording')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        {processing ? (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.processingText}>{status || t('processing')}</Text>
            <Text style={styles.processingHint}>Transcription Whisper + résumé IA en cours…</Text>
          </View>
        ) : (
          <>
            <Text style={styles.timer} testID="recording-timer">{fmt(elapsed)}</Text>
            <Waveform recording={isRecording} />

            <Pressable style={styles.templatePill} onPress={() => router.push('/template-picker' as any)} testID="pick-template-btn">
              <Ionicons name={(selectedTemplate?.icon || 'document-text-outline') as any} size={16} color={colors.brandPrimary} />
              <Text style={styles.templateText}>{selectedTemplate?.name || t('select_template')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.muted} />
            </Pressable>

            <TemplateSelector templates={templates} selected={selectedTemplate} onSelect={setSelectedTemplate} />

            {status ? <Text style={styles.status}>{status}</Text> : null}
          </>
        )}
      </View>

      {!processing && (
        <View style={styles.bottomActions}>
          {!isRecording ? (
            <>
              <Pressable style={styles.secondaryBtn} onPress={pickFile} testID="import-audio-btn">
                <Ionicons name="cloud-upload-outline" size={20} color={colors.brandPrimary} />
                <Text style={styles.secondaryText}>{t('upload_file')}</Text>
              </Pressable>
              <Pressable style={[styles.recordBtn, shadow.fab]} onPress={start} testID="start-recording-btn">
                <View style={styles.recordCore} />
              </Pressable>
              <Text style={styles.hint}>{t('tap_to_record')}</Text>
            </>
          ) : (
            <>
              <Pressable style={[styles.stopBtn, shadow.fab]} onPress={stopAndProcess} testID="stop-recording-btn">
                <Ionicons name="stop" size={28} color={colors.onError} />
              </Pressable>
              <Text style={styles.hint}>{t('stop_save')}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function TemplateSelector({ templates, selected, onSelect }: any) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tplRow}>
      {templates.map((tpl: any) => {
        const active = selected?.id === tpl.id;
        return (
          <Pressable
            key={tpl.id}
            onPress={() => onSelect(tpl)}
            style={[styles.tplChip, active && styles.tplChipActive]}
            testID={`tpl-chip-${tpl.id}`}
          >
            <Ionicons name={tpl.icon as any} size={14} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
            <Text style={[styles.tplChipText, active && { color: colors.onBrandPrimary }]}>{tpl.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  timer: { fontSize: 56, fontWeight: '300', color: colors.onSurface, fontVariant: ['tabular-nums'], marginBottom: spacing.xl },
  waveWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 80, marginBottom: spacing.xxl },
  bar: { width: 4, backgroundColor: colors.brandPrimary, borderRadius: 2 },
  templatePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.pill, marginBottom: spacing.md,
  },
  templateText: { color: colors.onBrandTertiary, fontWeight: '600', fontSize: 13 },
  tplRow: { gap: spacing.sm, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  tplChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill,
    flexShrink: 0,
  },
  tplChipActive: { backgroundColor: colors.brandPrimary },
  tplChipText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: '600' },
  status: { color: colors.muted, marginTop: spacing.md, textAlign: 'center' },
  bottomActions: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderRadius: radius.pill, backgroundColor: colors.brandTertiary,
  },
  secondaryText: { color: colors.onBrandTertiary, fontWeight: '600' },
  recordBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFF',
  },
  recordCore: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#FFF' },
  stopBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { color: colors.muted, fontSize: 13 },
  processingBox: { alignItems: 'center', gap: spacing.md },
  processingText: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  processingHint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
