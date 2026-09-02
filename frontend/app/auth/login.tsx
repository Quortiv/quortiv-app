import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ImageBackground, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useT } from '@/src/auth';
import { colors, spacing, radius } from '@/src/theme';

const SCENES = [
  {
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwxfHxkb2N0b3IlMjBsb29raW5nJTIwYXQlMjBtb2JpbGUlMjBwaG9uZSUyMGNsZWFufGVufDB8fHx8MTc4ODM1NTgzMXww&ixlib=rb-4.1.0&q=85',
    titleKey: 'onboarding_1_title',
    descKey: 'onboarding_1_desc',
  },
  {
    image: 'https://images.unsplash.com/photo-1652787542567-f86c0b4c0269?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBtaW5pbWFsJTIwZG9jdG9yJTIwc3RldGhvc2NvcGUlMjBub3RlYm9va3xlbnwwfHx8fDE3ODgzNTU4MjV8MA&ixlib=rb-4.1.0&q=85',
    titleKey: 'onboarding_2_title',
    descKey: 'onboarding_2_desc',
  },
  {
    image: 'https://images.unsplash.com/photo-1724405143873-cdaa5cac918e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG1lZGljYWwlMjB0ZWNobm9sb2d5JTIwYmx1ZSUyMGNsZWFufGVufDB8fHx8MTc4ODM1NTgyNXww&ixlib=rb-4.1.0&q=85',
    titleKey: 'onboarding_3_title',
    descKey: 'onboarding_3_desc',
  },
] as const;

export default function Login() {
  const { signInWithGoogle, signInAsGuest, lang, setLang } = useAuth();
  const t = useT();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const scene = SCENES[step];

  const next = () => {
    if (step < SCENES.length - 1) setStep(step + 1);
  };

  const onGuest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInAsGuest();
      router.replace('/(tabs)');
    } catch (e) {
      console.warn('guest login failed', e);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (e) {
      console.warn('google login failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={{ uri: scene.image }} style={styles.hero} resizeMode="cover">
        <LinearGradient
          colors={['transparent', 'rgba(15,23,42,0.35)', colors.surfaceInverse]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.logo} testID="app-logo">
            <Ionicons name="pulse" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.logoText}>{t('app_name')}</Text>
          </View>
          <Pressable
            style={styles.langPill}
            onPress={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            testID="lang-toggle-btn"
          >
            <Text style={styles.langText}>{lang.toUpperCase()}</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {SCENES.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.title} testID="onboarding-title">
          {t(scene.titleKey as any)}
        </Text>
        <Text style={styles.desc}>{t(scene.descKey as any)}</Text>

        {step < SCENES.length - 1 ? (
          <Pressable style={styles.primaryBtn} onPress={next} testID="onboarding-next-btn">
            <Text style={styles.primaryBtnText}>{'Suivant'}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.googleBtn} onPress={onGoogle} testID="google-signin-btn" disabled={busy}>
              {busy ? <ActivityIndicator color={colors.onSurface} /> : <Ionicons name="logo-google" size={20} color={colors.onSurface} />}
              <Text style={styles.googleText}>{t('continue_google')}</Text>
            </Pressable>
            <Pressable style={styles.guestBtn} onPress={onGuest} testID="guest-signin-btn" disabled={busy}>
              <Text style={styles.guestText}>{t('continue_guest')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  hero: { flex: 1, justifyContent: 'flex-start' },
  topBar: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  logoText: { color: colors.onBrandPrimary, fontWeight: '700', fontSize: 14 },
  langPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  langText: { color: '#FFF', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  sheet: {
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  dot: { width: 20, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: colors.brandPrimary, width: 28 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '700', marginBottom: spacing.sm, letterSpacing: -0.4 },
  desc: { color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 22, marginBottom: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontWeight: '700', fontSize: 16 },
  googleBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    borderRadius: radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  googleText: { color: colors.onSurface, fontWeight: '700', fontSize: 16 },
  guestBtn: { paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  guestText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textDecorationLine: 'underline' },
});
