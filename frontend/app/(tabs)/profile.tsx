import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth, useT } from '@/src/auth';
import { api } from '@/src/api';
import { colors, spacing, radius, shadow } from '@/src/theme';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut, lang, setLang } = useAuth();
  const t = useT();
  const [stats, setStats] = useState<{ total_notes: number; total_folders: number; total_duration_sec: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await api.stats());
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dur = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={[styles.profileCard, shadow.card]}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || user?.email || '?').substring(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name || 'Utilisateur'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, shadow.card]}>
            <Ionicons name="document-text" size={20} color={colors.brandPrimary} />
            <Text style={styles.statValue}>{stats?.total_notes ?? 0}</Text>
            <Text style={styles.statLabel}>{t('stats_notes')}</Text>
          </View>
          <View style={[styles.statCard, shadow.card]}>
            <Ionicons name="folder" size={20} color={colors.success} />
            <Text style={styles.statValue}>{stats?.total_folders ?? 0}</Text>
            <Text style={styles.statLabel}>{t('stats_folders')}</Text>
          </View>
          <View style={[styles.statCard, shadow.card]}>
            <Ionicons name="time" size={20} color={colors.warning} />
            <Text style={styles.statValue}>{stats ? dur(stats.total_duration_sec) : '0m'}</Text>
            <Text style={styles.statLabel}>{t('stats_time')}</Text>
          </View>
        </View>

        <View style={[styles.section, shadow.card]}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <View style={styles.langRow}>
            <Pressable
              testID="lang-fr-btn"
              onPress={() => setLang('fr')}
              style={[styles.langBtn, lang === 'fr' && styles.langBtnActive]}
            >
              <Text style={[styles.langText, lang === 'fr' && styles.langTextActive]}>Français</Text>
            </Pressable>
            <Pressable
              testID="lang-en-btn"
              onPress={() => setLang('en')}
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
            >
              <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>English</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={[styles.logoutBtn, shadow.card]} onPress={signOut} testID="logout-btn">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.onBrandPrimary, fontSize: 28, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  email: { fontSize: 13, color: colors.muted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
  statLabel: { fontSize: 11, color: colors.muted },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },
  langRow: { flexDirection: 'row', gap: spacing.sm },
  langBtn: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, alignItems: 'center',
  },
  langBtnActive: { backgroundColor: colors.brandPrimary },
  langText: { color: colors.onSurfaceSecondary, fontWeight: '600' },
  langTextActive: { color: colors.onBrandPrimary },
  logoutBtn: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing.sm,
  },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 15 },
});
