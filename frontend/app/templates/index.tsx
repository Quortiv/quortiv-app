import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, Template } from '@/src/api';
import { useAuth } from '@/src/auth';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button, IconButton } from '@/src/ui/Button';
import { Badge, Card } from '@/src/ui/Card';
import { LoadingState } from '@/src/ui/Feedback';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { AppHeader, Screen, SectionHeader } from '@/src/ui/Screen';
import { Sheet, SheetOption } from '@/src/ui/Sheet';

export default function Templates() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user, savePrefs } = useAuth();
  const { toast, confirm } = useFeedback();

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [menu, setMenu] = useState<Template | null>(null);

  const load = useCallback(async () => {
    try {
      setTemplates(await api.listTemplates());
    } catch {
      setTemplates([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const setDefault = async (tpl: Template) => {
    setMenu(null);
    await savePrefs({ default_template_id: tpl.id });
    await load();
    toast(t('template_default'), 'success');
  };

  const duplicate = async (tpl: Template) => {
    setMenu(null);
    const copy = await api.duplicateTemplate(tpl.id);
    await load();
    router.push(`/templates/${copy.id}` as any);
  };

  const remove = async (tpl: Template) => {
    setMenu(null);
    const ok = await confirm({
      title: t('delete'),
      message: tpl.name,
      confirmLabel: t('delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteTemplate(tpl.id);
      await load();
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    }
  };

  const groups = [
    { label: t('template_custom'), items: (templates || []).filter((x) => !x.is_builtin) },
    {
      label: t('template_builtin'),
      items: (templates || []).filter((x) => x.is_builtin && !x.is_specialized),
    },
    {
      label: lang === 'fr' ? 'Contextes spécialisés' : 'Specialised contexts',
      items: (templates || []).filter((x) => x.is_specialized),
    },
  ];

  return (
    <Screen
      scroll
      testID="templates-screen"
      header={
        <AppHeader
          onBack
          title={t('templates')}
          right={
            <IconButton
              icon="add"
              variant="soft"
              onPress={() => router.push('/templates/new')}
              accessibilityLabel={t('template_new')}
              testID="template-new"
            />
          }
        />
      }
    >
      {templates === null ? (
        <LoadingState />
      ) : (
        groups.map((group) =>
          group.items.length ? (
            <View key={group.label} style={styles.section}>
              <SectionHeader title={group.label} />
              <View style={styles.list}>
                {group.items.map((tpl) => (
                  <Card key={tpl.id} padded={false}>
                    <View style={styles.row}>
                      <View
                        style={[
                          styles.icon,
                          { backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.sm },
                        ]}
                      >
                        <Ionicons name={(tpl.icon as any) || 'document-text-outline'} size={18} color={theme.colors.brand} />
                      </View>
                      <View style={styles.flex}>
                        <View style={styles.titleRow}>
                          <AppText variant="bodyMedium" numberOfLines={1} style={styles.flex}>
                            {tpl.name}
                          </AppText>
                          {tpl.id === user?.prefs?.default_template_id ? (
                            <Badge label={t('template_default')} tone="brand" />
                          ) : null}
                        </View>
                        {tpl.description ? (
                          <AppText variant="caption" tone="muted" numberOfLines={2}>
                            {tpl.description}
                          </AppText>
                        ) : null}
                        {tpl.sections?.length ? (
                          <AppText variant="micro" tone="muted" numberOfLines={1}>
                            {tpl.sections.join(' · ')}
                          </AppText>
                        ) : null}
                      </View>
                      <IconButton
                        icon="ellipsis-horizontal"
                        onPress={() => setMenu(tpl)}
                        accessibilityLabel={`${t('edit')} ${tpl.name}`}
                        testID={`template-menu-${tpl.id}`}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ) : null
        )
      )}

      <Button
        label={t('template_new')}
        variant="secondary"
        icon="add"
        onPress={() => router.push('/templates/new')}
        style={styles.newBtn}
      />

      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        <SheetOption
          icon="star-outline"
          tone="brand"
          title={t('template_set_default')}
          onPress={() => menu && setDefault(menu)}
          testID="template-set-default"
        />
        <SheetOption
          icon="copy-outline"
          title={t('template_duplicate')}
          onPress={() => menu && duplicate(menu)}
          testID="template-duplicate"
        />
        {menu && !menu.is_builtin ? (
          <>
            <SheetOption
              icon="pencil-outline"
              title={t('edit')}
              onPress={() => {
                const id = menu.id;
                setMenu(null);
                router.push(`/templates/${id}` as any);
              }}
              testID="template-edit"
            />
            <SheetOption
              icon="trash-outline"
              tone="danger"
              title={t('delete')}
              onPress={() => remove(menu)}
              testID="template-delete"
            />
          </>
        ) : (
          <AppText variant="caption" tone="muted">
            {lang === 'fr'
              ? 'Les modèles intégrés ne sont pas modifiables : dupliquez-les pour les adapter.'
              : 'Built-in templates are read-only: duplicate them to adapt them.'}
          </AppText>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newBtn: { marginTop: 24 },
});
