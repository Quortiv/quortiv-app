import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ChatPanel } from '@/src/components/note/ChatPanel';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { AppHeader, Screen } from '@/src/ui/Screen';

export default function Assistant() {
  const { t, lang } = useI18n();
  return (
    <Screen
      testID="assistant-screen"
      header={
        <AppHeader
          onBack
          title={t('assistant_title')}
          subtitle={lang === 'fr' ? 'Répond depuis vos notes récentes' : 'Answers from your recent notes'}
        />
      }
    >
      <View style={styles.flex}>
        <ChatPanel workspace />
      </View>
      <AppText variant="micro" tone="muted" center style={styles.footer}>
        {t('assistant_empty_desc')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { paddingBottom: 8 },
});
