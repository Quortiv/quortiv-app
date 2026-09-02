import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { api, Template } from '@/src/api';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { Card } from '@/src/ui/Card';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input } from '@/src/ui/Input';
import { AppHeader, Container, Screen } from '@/src/ui/Screen';

export default function TemplateEditor() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useFeedback();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [focus, setFocus] = useState('');
  const [sections, setSections] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    api
      .listTemplates()
      .then((list) => {
        const tpl = list.find((x: Template) => x.id === id);
        if (!tpl) return;
        setName(tpl.name);
        setDescription(tpl.description || '');
        setFocus(tpl.focus || '');
        setSections((tpl.sections || []).join('\n'));
      })
      .catch(() => {});
  }, [id, isNew]);

  const save = async () => {
    if (!name.trim() || focus.trim().length < 10) {
      setError(
        lang === 'fr'
          ? 'Un nom et des instructions détaillées sont requis.'
          : 'A name and detailed instructions are required.'
      );
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      description: description.trim(),
      focus: focus.trim(),
      sections: sections
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (isNew) await api.createTemplate(body);
      else await api.updateTemplate(id!, body);
      toast(t('note_saved'), 'success');
      router.back();
    } catch (e: any) {
      setError(e?.message || t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      padded={false}
      testID="template-editor-screen"
      header={<AppHeader onBack title={isNew ? t('template_new') : t('edit')} />}
      footer={<Button label={t('save')} onPress={save} loading={busy} testID="template-save" />}
    >
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Container style={styles.form}>
          <Input
            label={t('template_name')}
            value={name}
            onChangeText={setName}
            counterMax={60}
            autoFocus={isNew}
            testID="template-name"
          />
          <Input
            label={lang === 'fr' ? 'Description courte' : 'Short description'}
            value={description}
            onChangeText={setDescription}
            counterMax={140}
            testID="template-description"
          />
          <Input
            label={t('template_focus')}
            hint={t('template_focus_hint')}
            value={focus}
            onChangeText={(v) => {
              setFocus(v);
              setError(null);
            }}
            multiline
            style={styles.textarea}
            error={error}
            testID="template-focus"
          />
          <Input
            label={t('template_sections')}
            value={sections}
            onChangeText={setSections}
            multiline
            style={styles.sections}
            placeholder={lang === 'fr' ? 'Contexte\nPoints clés\nActions' : 'Context\nKey points\nActions'}
            testID="template-sections"
          />
          <Card variant="flat">
            <AppText variant="caption" tone="muted">
              {lang === 'fr'
                ? 'Les instructions sont transmises au moteur de restitution. Plus elles sont précises, plus la synthèse sera adaptée à votre contexte.'
                : 'Instructions are passed to the restitution engine. The more precise they are, the better the brief fits your context.'}
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
  textarea: { minHeight: 160 },
  sections: { minHeight: 110 },
});
