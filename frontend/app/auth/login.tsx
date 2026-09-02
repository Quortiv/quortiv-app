import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth';
import { LogoMark } from '@/src/design/Logo';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Container } from '@/src/ui/Screen';

const HIGHLIGHTS: { icon: any; fr: string; en: string }[] = [
  { icon: 'flash-outline', fr: 'Synthèse en quelques secondes', en: 'A brief in seconds' },
  { icon: 'shield-checkmark-outline', fr: 'Vos contenus restent les vôtres', en: 'Your content stays yours' },
  { icon: 'layers-outline', fr: 'Modèles pour chaque contexte', en: 'Templates for every context' },
];

export default function Login() {
  const theme = useTheme();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInAsGuest } = useAuth();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<'google' | 'guest' | null>(null);

  const run = async (kind: 'google' | 'guest') => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === 'google') await signInWithGoogle();
      else await signInAsGuest();
      router.replace('/(tabs)');
    } catch (e: any) {
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <Container style={styles.topBar}>
        <View style={styles.langSlot} />
        <AppText
          variant="label"
          tone="muted"
          onPress={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          suppressHighlighting
          accessibilityRole="button"
          testID="login-lang"
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </AppText>
      </Container>

      <Container style={styles.hero}>
        <LogoMark size={64} ring={theme.colors.text} slash={theme.colors.brand} />
        <AppText variant="display" center style={styles.brand}>
          {t('app_name')}
        </AppText>
        <AppText variant="body" tone="secondary" center>
          {t('tagline')}
        </AppText>

        <View style={styles.highlights}>
          {HIGHLIGHTS.map((h) => (
            <View key={h.icon} style={styles.highlight}>
              <View
                style={[
                  styles.hIcon,
                  { backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.sm },
                ]}
              >
                <Ionicons name={h.icon} size={16} color={theme.colors.brand} />
              </View>
              <AppText variant="callout" tone="secondary" style={styles.flex} numberOfLines={2}>
                {lang === 'fr' ? h.fr : h.en}
              </AppText>
            </View>
          ))}
        </View>
      </Container>

      <Container style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.xl }]}>
        <AppText variant="title2" center>
          {t('signin_title')}
        </AppText>
        <AppText variant="callout" tone="muted" center>
          {t('signin_subtitle')}
        </AppText>

        <Button
          label={t('continue_google')}
          icon="logo-google"
          onPress={() => run('google')}
          loading={busy === 'google'}
          disabled={busy === 'guest'}
          testID="google-signin-btn"
        />
        <Button
          label={t('continue_guest')}
          variant="secondary"
          icon="person-outline"
          onPress={() => run('guest')}
          loading={busy === 'guest'}
          disabled={busy === 'google'}
          testID="guest-signin-btn"
        />
        <AppText variant="micro" tone="muted" center>
          {t('guest_note')}
        </AppText>
        <AppText variant="micro" tone="muted" center style={styles.legal}>
          {t('legal_notice')}
        </AppText>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  langSlot: { width: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  brand: { letterSpacing: -1 },
  highlights: { marginTop: 28, gap: 12, width: '100%', maxWidth: 340 },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  footer: { gap: 12, paddingTop: 8 },
  legal: { maxWidth: 380, alignSelf: 'center' },
});
