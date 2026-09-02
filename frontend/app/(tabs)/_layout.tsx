import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureSheet } from '@/src/components/CaptureSheet';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';

function CaptureButton() {
  const theme = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={styles.captureSlot} pointerEvents="box-none">
        <Pressable
          onPress={() => setOpen(true)}
          testID="tab-bar-capture"
          accessibilityRole="button"
          accessibilityLabel={t('tab_capture')}
          style={({ pressed }) => [
            styles.captureBtn,
            {
              backgroundColor: theme.colors.brand,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
            theme.shadows.brand,
          ]}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      </View>
      <CaptureSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const tabBarHeight = theme.layout.tabBarHeight + insets.bottom;

  const icon = (name: string, focused: boolean, color: string) => (
    <Ionicons name={(focused ? name : `${name}-outline`) as any} size={23} color={color} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom + 12,
          backgroundColor: theme.colors.bgElevated,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'web' ? { position: 'relative' as any } : {}),
        },
        tabBarLabelStyle: { ...theme.typography.micro, marginTop: 2 },
        tabBarItemStyle: { minHeight: 44 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home'),
          tabBarButtonTestID: 'tab-bar-home',
          tabBarIcon: ({ focused, color }) => icon('home', focused, color),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tab_library'),
          tabBarButtonTestID: 'tab-bar-library',
          tabBarIcon: ({ focused, color }) => icon('albums', focused, color),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: '',
          tabBarButton: () => <CaptureButton />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('tab_insights'),
          tabBarButtonTestID: 'tab-bar-insights',
          tabBarIcon: ({ focused, color }) => icon('stats-chart', focused, color),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab_profile'),
          tabBarButtonTestID: 'tab-bar-profile',
          tabBarIcon: ({ focused, color }) => icon('person-circle', focused, color),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  captureSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  captureBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
});
