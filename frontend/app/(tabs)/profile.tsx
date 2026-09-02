import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, Folder, Prefs, Template } from '@/src/api';
import { useAuth } from '@/src/auth';
import { FolderPickerSheet, TemplatePickerSheet } from '@/src/components/Pickers';
import { useTheme, useThemeMode } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { Card, Divider, ListRow } from '@/src/ui/Card';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input, SegmentedControl, Switch } from '@/src/ui/Input';
import { AppHeader, Screen, SectionHeader } from '@/src/ui/Screen';
import { Sheet } from '@/src/ui/Sheet';
import { formatDate, initials } from '@/src/utils/format';
import { clearCaches } from '@/src/utils/offline';
import { shareTextFile } from '@/src/utils/share';

export default function Profile() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const { user, savePrefs, signOut, deleteAccount } = useAuth();
  const { toast, confirm } = useFeedback();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [templateSheet, setTemplateSheet] = useState(false);
  const [folderSheet, setFolderSheet] = useState(false);
  const [nameSheet, setNameSheet] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
    api.listFolders().then(setFolders).catch(() => {});
  }, []);

  const prefs = user?.prefs;

  const update = useCallback(
    async (patch: Partial<Prefs> & { name?: string }) => {
      try {
        await savePrefs(patch);
      } catch (e: any) {
        toast(e?.message || t('error_generic'), 'error');
      }
    },
    [savePrefs, t, toast]
  );

  const defaultTemplate = templates.find((x) => x.id === prefs?.default_template_id);
  const defaultFolder = folders.find((x) => x.id === prefs?.default_folder_id);

  const exportData = async () => {
    setBusy('export');
    try {
      const data = await api.exportAccount();
      await shareTextFile(JSON.stringify(data, null, 2), `quortiv-donnees-${Date.now()}.json`);
      toast(lang === 'fr' ? 'Export généré' : 'Export ready', 'success');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const removeAccount = async () => {
    const ok = await confirm({
      title: t('delete_account_confirm'),
      message: t('delete_account_warning'),
      confirmLabel: t('delete'),
      destructive: true,
    });
    if (!ok) return;
    setBusy('delete');
    try {
      await deleteAccount();
      await clearCaches();
      router.replace('/auth/login');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    const ok = await confirm({ title: t('logout_confirm'), confirmLabel: t('logout') });
    if (!ok) return;
    await signOut();
    await clearCaches();
    router.replace('/auth/login');
  };

  return (
    <Screen scroll testID="profile-screen" header={<AppHeader title={t('profile_title')} />}>
      <Card style={styles.identity}>
        <View
          style={[styles.avatar, { backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.pill }]}
        >
          <AppText variant="title2" tone="brand">
            {initials(user?.name, user?.email)}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title3" numberOfLines={1}>
            {user?.name || t('guest_mode')}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {user?.is_guest ? t('guest_mode') : user?.email}
          </AppText>
          {user?.created_at ? (
            <AppText variant="micro" tone="muted">
              {formatDate(user.created_at, lang)}
            </AppText>
          ) : null}
        </View>
        <Button
          label={t('edit')}
          variant="tonal"
          size="sm"
          fullWidth={false}
          onPress={() => {
            setName(user?.name || '');
            setNameSheet(true);
          }}
          testID="profile-edit-name"
        />
      </Card>

      {user?.is_guest ? (
        <Card variant="brand" style={styles.guestCard}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.brand} />
          <AppText variant="caption" tone="secondary" style={styles.flex}>
            {t('guest_upgrade')}
          </AppText>
        </Card>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={t('preferences')} />
        <Card padded={false}>
          <View style={styles.settingBlock}>
            <AppText variant="label" tone="secondary">
              {t('language')}
            </AppText>
            <SegmentedControl
              value={lang}
              onChange={(v) => {
                setLang(v);
                update({ language: v });
              }}
              testID="pref-language"
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' },
              ]}
            />
          </View>
          <Divider />
          <View style={styles.settingBlock}>
            <AppText variant="label" tone="secondary">
              {t('appearance')}
            </AppText>
            <SegmentedControl
              value={mode}
              onChange={(v) => {
                setMode(v);
                update({ theme: v });
              }}
              testID="pref-theme"
              options={[
                { value: 'system', label: t('theme_system'), icon: 'phone-portrait-outline' },
                { value: 'light', label: t('theme_light'), icon: 'sunny-outline' },
                { value: 'dark', label: t('theme_dark'), icon: 'moon-outline' },
              ]}
            />
          </View>
          <Divider />
          <View style={styles.settingBlock}>
            <AppText variant="label" tone="secondary">
              {t('summary_level')}
            </AppText>
            <SegmentedControl
              value={(prefs?.summary_level || 'standard') as any}
              onChange={(v) => update({ summary_level: v as any })}
              testID="pref-level"
              options={[
                { value: 'brief', label: t('note_level_brief') },
                { value: 'standard', label: t('note_level_standard') },
                { value: 'deep', label: t('note_level_deep') },
              ]}
            />
          </View>
          <Divider />
          <ListRow
            icon="albums-outline"
            title={t('default_template')}
            subtitle={defaultTemplate?.name || t('none')}
            onPress={() => setTemplateSheet(true)}
            testID="pref-default-template"
          />
          <Divider inset={64} />
          <ListRow
            icon="folder-outline"
            title={t('default_folder')}
            subtitle={defaultFolder?.name || t('unsorted')}
            onPress={() => setFolderSheet(true)}
            testID="pref-default-folder"
          />
          <Divider inset={64} />
          <ListRow
            icon="people-outline"
            title={t('speaker_detection')}
            subtitle={t('speaker_detection_desc')}
            right={
              <Switch
                value={!!prefs?.diarization}
                onValueChange={(v) => update({ diarization: v })}
                accessibilityLabel={t('speaker_detection')}
                testID="pref-diarization"
              />
            }
          />
          <Divider inset={64} />
          <ListRow
            icon="accessibility-outline"
            title={t('reduce_motion')}
            subtitle={t('reduce_motion_desc')}
            right={
              <Switch
                value={!!prefs?.reduce_motion}
                onValueChange={(v) => update({ reduce_motion: v })}
                accessibilityLabel={t('reduce_motion')}
                testID="pref-reduce-motion"
              />
            }
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('library_title')} />
        <Card padded={false}>
          <ListRow
            icon="pricetags-outline"
            title={t('templates')}
            onPress={() => router.push('/templates')}
            testID="profile-templates"
          />
          <Divider inset={64} />
          <ListRow
            icon="checkbox-outline"
            title={t('actions_title')}
            onPress={() => router.push('/actions')}
            testID="profile-actions"
          />
          <Divider inset={64} />
          <ListRow
            icon="chatbubbles-outline"
            title={t('assistant_title')}
            onPress={() => router.push('/assistant')}
            testID="profile-assistant"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('data_privacy')} />
        <Card padded={false}>
          <ListRow
            icon="download-outline"
            title={t('export_data')}
            subtitle={t('export_data_desc')}
            onPress={exportData}
            disabled={busy === 'export'}
            testID="profile-export"
          />
          <Divider inset={64} />
          <ListRow
            icon="trash-outline"
            title={t('delete_account')}
            subtitle={t('delete_account_desc')}
            danger
            onPress={removeAccount}
            disabled={busy === 'delete'}
            testID="profile-delete-account"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Card padded={false}>
          <ListRow icon="log-out-outline" title={t('logout')} onPress={logout} testID="profile-logout" />
        </Card>
        <AppText variant="micro" tone="muted" center style={styles.version}>
          {t('app_name')} · {t('version')} 2.0.0
        </AppText>
      </View>

      <TemplatePickerSheet
        visible={templateSheet}
        onClose={() => setTemplateSheet(false)}
        templates={templates}
        selectedId={prefs?.default_template_id}
        onSelect={(tpl) => update({ default_template_id: tpl.id })}
      />
      <FolderPickerSheet
        visible={folderSheet}
        onClose={() => setFolderSheet(false)}
        folders={folders}
        selectedId={prefs?.default_folder_id}
        onSelect={(id) => update({ default_folder_id: id })}
      />

      <Sheet
        visible={nameSheet}
        onClose={() => setNameSheet(false)}
        title={t('edit_name')}
        footer={
          <Button
            label={t('save')}
            onPress={async () => {
              await update({ name });
              setNameSheet(false);
              toast(t('note_saved'), 'success');
            }}
            testID="profile-name-save"
          />
        }
      >
        <Input
          label={t('your_name')}
          value={name}
          onChangeText={setName}
          counterMax={80}
          autoFocus
          testID="profile-name-input"
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  guestCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  section: { marginTop: 28 },
  settingBlock: { padding: 16, gap: 10 },
  version: { marginTop: 20 },
});
