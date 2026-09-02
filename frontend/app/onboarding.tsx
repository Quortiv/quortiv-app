import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/src/design/Logo';
import { useTheme } from '@/src/design/ThemeProvider';
import { StringKey, useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Button } from '@/src/ui/Button';
import { Container } from '@/src/ui/Screen';

const SLIDES: {
  icon: any;
  titleKey: StringKey;
  descKey: StringKey;
  accent: 'brand' | 'success' | 'accent';
}[] = [
  { icon: 'mic-outline', titleKey: 'ob1_title', descKey: 'ob1_desc', accent: 'brand' },
  { icon: 'checkmark-done-outline', titleKey: 'ob2_title', descKey: 'ob2_desc', accent: 'success' },
  { icon: 'chatbubbles-outline', titleKey: 'ob3_title', descKey: 'ob3_desc', accent: 'accent' },
];

export default function Onboarding() {
  const theme = useTheme();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;

  const finish = async () => {
    await AsyncStorage.setItem('qv_onboarded', '1').catch(() => {});
    router.replace('/auth/login');
  };

  const next = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    const target = index + 1;
    setIndex(target);
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <Container style={styles.topBar}>
        <LogoMark size={30} ring={theme.colors.text} slash={theme.colors.brand} />
        <View style={styles.topActions}>
          <AppText
            variant="label"
            tone="muted"
            onPress={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            suppressHighlighting
            accessibilityRole="button"
            testID="onboarding-lang"
          >
            {lang === 'fr' ? 'EN' : 'FR'}
          </AppText>
          <AppText
            variant="label"
            tone="muted"
            onPress={finish}
            suppressHighlighting
            accessibilityRole="button"
            testID="onboarding-skip"
          >
            {t('ob_skip')}
          </AppText>
        </View>
      </Container>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
        }
        style={styles.flex}
      >
        {SLIDES.map((slide) => {
          const accent = theme.colors[slide.accent];
          return (
            <View key={slide.titleKey} style={[styles.slide, { width }]}>
              <Container style={styles.slideInner}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: `${accent}1F`, borderRadius: theme.radius.xl },
                  ]}
                >
                  <Ionicons name={slide.icon} size={44} color={accent} />
                </View>
                <AppText variant="display" center style={styles.title}>
                  {t(slide.titleKey)}
                </AppText>
                <AppText variant="body" tone="secondary" center style={styles.desc}>
                  {t(slide.descKey)}
                </AppText>
              </Container>
            </View>
          );
        })}
      </ScrollView>

      <Container style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.titleKey}
              style={{
                width: i === index ? 22 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === index ? theme.colors.brand : theme.colors.borderStrong,
              }}
            />
          ))}
        </View>
        <Button
          label={index === SLIDES.length - 1 ? t('ob_start') : t('ob_next')}
          onPress={next}
          iconRight="arrow-forward"
          testID="onboarding-next"
        />
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  slide: { flex: 1, justifyContent: 'center' },
  slideInner: { alignItems: 'center', gap: 20 },
  iconWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  title: { maxWidth: 400 },
  desc: { maxWidth: 380 },
  footer: { gap: 24, paddingTop: 12 },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center' },
});
