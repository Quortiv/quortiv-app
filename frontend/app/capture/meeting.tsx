import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { api } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { Card, Divider, ListRow } from '@/src/ui/Card';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input } from '@/src/ui/Input';
import { AppHeader, Container, Screen, SectionHeader } from '@/src/ui/Screen';

/**
 * Online meeting capture. Quortiv does not send a bot into third-party meeting
 * rooms — instead it prepares the note, opens the meeting, records the device
 * audio, or ingests the recording/transcript the platform produces.
 */
export default function MeetingCapture() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { toast } = useFeedback();

  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const openMeeting = async () => {
    const value = link.trim();
    if (!/^https?:\/\/.+\..+/.test(value)) {
      toast(lang === 'fr' ? 'Saisissez un lien de réunion valide.' : 'Enter a valid meeting link.', 'error');
      return;
    }
    const supported = await Linking.canOpenURL(value);
    if (!supported) {
      toast(lang === 'fr' ? 'Lien non pris en charge par l’appareil.' : 'Link not supported by the device.', 'error');
      return;
    }
    await Linking.openURL(value);
  };

  const prepareNote = async () => {
    const value = link.trim();
    if (!value && !title.trim()) {
      toast(lang === 'fr' ? 'Ajoutez un titre ou un lien.' : 'Add a title or a link.', 'error');
      return;
    }
    setBusy(true);
    try {
      const body =
        (lang === 'fr' ? 'Réunion en ligne planifiée.' : 'Scheduled online meeting.') +
        (value ? `\n${lang === 'fr' ? 'Lien' : 'Link'} : ${value}` : '') +
        `\n${lang === 'fr' ? 'Ordre du jour à compléter.' : 'Agenda to be completed.'}`;
      const note = await api.fromText({
        text: body,
        title: title.trim() || (lang === 'fr' ? 'Réunion en ligne' : 'Online meeting'),
        analyze: false,
        source_type: 'meeting',
        language: lang,
      } as any);
      router.replace(`/note/${note.id}` as any);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const importRecording = async () => {
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*', 'text/vtt', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const isText = /\.(vtt|srt|txt)$/i.test(asset.name || '');
      toast(lang === 'fr' ? 'Traitement en cours…' : 'Processing…', 'info');
      const note = isText
        ? await api.uploadDocument(asset.uri, { name: asset.name!, mime: asset.mimeType || undefined })
        : await api.uploadMedia(asset.uri, {
            name: asset.name || 'reunion.m4a',
            mime: asset.mimeType || undefined,
            title: title.trim() || undefined,
          });
      router.replace(`/note/${note.id}` as any);
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      padded={false}
      testID="meeting-capture-screen"
      header={<AppHeader onBack title={t('capture_meeting')} />}
    >
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container style={styles.form}>
          <Input
            label={lang === 'fr' ? 'Lien de la réunion' : 'Meeting link'}
            value={link}
            onChangeText={setLink}
            placeholder="https://…"
            icon="videocam-outline"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="meeting-link"
          />
          <Input
            label={lang === 'fr' ? 'Titre de la réunion' : 'Meeting title'}
            value={title}
            onChangeText={setTitle}
            placeholder={t('title_placeholder')}
            counterMax={120}
            testID="meeting-title"
          />

          <View style={styles.actions}>
            <Button
              label={lang === 'fr' ? 'Ouvrir la réunion' : 'Open meeting'}
              variant="secondary"
              icon="open-outline"
              onPress={openMeeting}
              testID="meeting-open"
            />
            <Button
              label={lang === 'fr' ? 'Préparer la note' : 'Prepare the note'}
              icon="document-outline"
              onPress={prepareNote}
              loading={busy}
              testID="meeting-prepare"
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title={lang === 'fr' ? 'Capturer le contenu' : 'Capture the content'} />
            <Card padded={false}>
              <ListRow
                icon="mic-outline"
                title={t('capture_record')}
                subtitle={
                  lang === 'fr'
                    ? 'Enregistre le son de votre appareil pendant la réunion'
                    : 'Records your device audio during the meeting'
                }
                onPress={() => router.replace('/capture/record')}
                testID="meeting-record"
              />
              <Divider inset={64} />
              <ListRow
                icon="cloud-upload-outline"
                title={lang === 'fr' ? 'Importer l’enregistrement' : 'Import the recording'}
                subtitle={
                  lang === 'fr'
                    ? 'Audio, vidéo ou transcription exportée par la plateforme'
                    : 'Audio, video or transcript exported by the platform'
                }
                onPress={importRecording}
                disabled={busy}
                testID="meeting-import"
              />
            </Card>
          </View>

          <Card variant="flat" style={styles.notice}>
            <Ionicons name="shield-outline" size={18} color={theme.colors.textMuted} />
            <AppText variant="caption" tone="muted" style={styles.flex}>
              {lang === 'fr'
                ? 'Quortiv n’envoie aucun robot dans vos réunions : vous gardez le contrôle. Enregistrez depuis votre appareil ou importez le fichier fourni par la plateforme, après avoir informé les participants.'
                : 'Quortiv never sends a bot into your meetings: you stay in control. Record from your device or import the file the platform provides, after informing participants.'}
            </AppText>
          </Card>
        </Container>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 16 },
  form: { gap: 16 },
  actions: { gap: 10 },
  section: { marginTop: 12 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
});
