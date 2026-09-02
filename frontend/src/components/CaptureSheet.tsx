import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { api } from '../api';
import { useI18n } from '../i18n';
import { useFeedback } from '../ui/Feedback.provider';
import { Sheet, SheetOption } from '../ui/Sheet';

const AUDIO_TYPES = ['audio/*'];
const VIDEO_TYPES = ['video/*'];
const DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/vtt',
];

export function CaptureSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const pickAndUpload = async (kind: 'audio' | 'video' | 'document') => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: kind === 'audio' ? AUDIO_TYPES : kind === 'video' ? VIDEO_TYPES : DOC_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      onClose();
      toast(
        kind === 'document' ? 'Extraction du document…' : 'Envoi et transcription en cours…',
        'info'
      );
      const note =
        kind === 'document'
          ? await api.uploadDocument(asset.uri, {
              name: asset.name || 'document.pdf',
              mime: asset.mimeType || undefined,
            })
          : await api.uploadMedia(asset.uri, {
              name: asset.name || (kind === 'video' ? 'video.mp4' : 'audio.m4a'),
              mime: asset.mimeType || undefined,
            });
      router.push(`/note/${note.id}` as any);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('capture_title')}
      subtitle={t('capture_subtitle')}
      testID="capture-sheet"
    >
      <SheetOption
        icon="mic"
        tone="brand"
        title={t('capture_record')}
        description={t('capture_record_desc')}
        onPress={() => go('/capture/record')}
        testID="capture-record"
      />
      <SheetOption
        icon="create-outline"
        title={t('capture_text')}
        description={t('capture_text_desc')}
        onPress={() => go('/capture/text')}
        testID="capture-text"
      />
      <SheetOption
        icon="musical-notes-outline"
        title={t('capture_audio')}
        description={t('capture_audio_desc')}
        onPress={() => pickAndUpload('audio')}
        disabled={busy}
        testID="capture-audio"
      />
      <SheetOption
        icon="videocam-outline"
        title={t('capture_video')}
        description={t('capture_video_desc')}
        onPress={() => pickAndUpload('video')}
        disabled={busy}
        testID="capture-video"
      />
      <SheetOption
        icon="document-text-outline"
        title={t('capture_document')}
        description={t('capture_document_desc')}
        onPress={() => pickAndUpload('document')}
        disabled={busy}
        testID="capture-document"
      />
      <SheetOption
        icon="link-outline"
        title={t('capture_link')}
        description={t('capture_link_desc')}
        onPress={() => go('/capture/link')}
        testID="capture-link"
      />
      <SheetOption
        icon="people-outline"
        title={t('capture_meeting')}
        description={t('capture_meeting_desc')}
        onPress={() => go('/capture/meeting')}
        testID="capture-meeting"
      />
    </Sheet>
  );
}
