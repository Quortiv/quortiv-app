import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/src/auth';
import { LogoMark } from '@/src/design/Logo';
import { useTheme } from '@/src/design/ThemeProvider';

export default function Gate() {
  const { user, loading } = useAuth();
  const t = useTheme();
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('qv_onboarded').then((v) => setSeenOnboarding(v === '1'));
  }, []);

  if (loading || seenOnboarding === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          backgroundColor: t.colors.bg,
        }}
      >
        <LogoMark size={56} ring={t.colors.text} slash={t.colors.brand} />
        <ActivityIndicator color={t.colors.brand} />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)" />;
  if (!seenOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/auth/login" />;
}
