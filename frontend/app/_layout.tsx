import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useThemeMode } from '@/src/design/ThemeProvider';
import { AuthProvider } from '@/src/auth';
import { I18nProvider } from '@/src/i18n';
import { FeedbackProvider } from '@/src/ui/Feedback.provider';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigation() {
  const { isDark } = useThemeMode();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="capture/record" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="capture/text" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="capture/link" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="capture/meeting" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <I18nProvider>
              <FeedbackProvider>
                <AuthProvider>
                  <Navigation />
                </AuthProvider>
              </FeedbackProvider>
            </I18nProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
