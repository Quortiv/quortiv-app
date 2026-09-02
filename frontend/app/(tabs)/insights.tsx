import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { sourceMeta } from '@/src/design/tokens';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { IconButton } from '@/src/ui/Button';
import { Card, Chip, Divider } from '@/src/ui/Card';
import { EmptyState, ProgressBar, Skeleton } from '@/src/ui/Feedback';
import { SegmentedControl } from '@/src/ui/Input';
import { AppHeader, Screen, SectionHeader } from '@/src/ui/Screen';
import { compactNumber, formatDuration } from '@/src/utils/format';

type Range = '7' | '30' | '90';

export default function Insights() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const [range, setRange] = useState<Range>('30');
  const [data, setData] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (days: Range) => {
    try {
      setData(await api.analytics(Number(days)));
    } catch {
      setData({ notes_in_range: 0, series: [], by_source: [], top_tags: [], actions: { total: 0 } });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(range);
    }, [load, range])
  );

  const series: { date: string; count: number }[] = data?.series || [];
  const visible = series.slice(-Math.min(series.length, 30));
  const max = Math.max(1, ...visible.map((d) => d.count));
  const totalSources = (data?.by_source || []).reduce((acc: number, s: any) => acc + s.count, 0) || 1;

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load(range);
        setRefreshing(false);
      }}
      testID="insights-screen"
      header={
        <AppHeader
          title={t('insights_title')}
          right={
            <IconButton
              icon="git-network-outline"
              onPress={() => router.push('/graph')}
              accessibilityLabel={t('insights_graph')}
              testID="insights-graph-btn"
            />
          }
        />
      }
    >
      <SegmentedControl<Range>
        value={range}
        onChange={(v) => {
          setRange(v);
          setData(null);
        }}
        testID="insights-range"
        options={[
          { value: '7', label: '7 j' },
          { value: '30', label: '30 j' },
          { value: '90', label: '90 j' },
        ]}
      />

      {data === null ? (
        <View style={styles.section}>
          <Skeleton height={140} radius={theme.radius.md} />
          <View style={{ height: 12 }} />
          <Skeleton height={100} radius={theme.radius.md} />
        </View>
      ) : data.notes_in_range === 0 ? (
        <EmptyState
          icon="stats-chart-outline"
          title={t('insights_no_data')}
          description={t('insights_no_data_desc')}
          testID="insights-empty"
        />
      ) : (
        <>
          <View style={styles.kpis}>
            {[
              { label: t('notes_count'), value: compactNumber(data.notes_in_range), icon: 'documents-outline' },
              { label: t('insights_duration'), value: formatDuration(data.duration_sec), icon: 'time-outline' },
              { label: t('insights_words'), value: compactNumber(data.words), icon: 'text-outline' },
              { label: t('insights_avg_week'), value: String(data.avg_per_week), icon: 'pulse-outline' },
            ].map((kpi) => (
              <Card key={kpi.label} variant="flat" style={styles.kpi} padded={false}>
                <View style={styles.kpiInner}>
                  <Ionicons name={kpi.icon as any} size={15} color={theme.colors.textMuted} />
                  <AppText variant="title3" numberOfLines={1}>
                    {kpi.value}
                  </AppText>
                  <AppText variant="micro" tone="muted" numberOfLines={1}>
                    {kpi.label}
                  </AppText>
                </View>
              </Card>
            ))}
          </View>

          <View style={styles.section}>
            <SectionHeader title={t('insights_activity')} />
            <Card>
              <View style={styles.chart} accessibilityLabel={t('insights_activity')}>
                {visible.map((day) => (
                  <View key={day.date} style={styles.barSlot}>
                    <View
                      style={{
                        width: '100%',
                        height: Math.max(3, (day.count / max) * 96),
                        borderRadius: 3,
                        backgroundColor: day.count ? theme.colors.brand : theme.colors.surfaceMuted,
                        opacity: day.count ? 0.35 + (day.count / max) * 0.65 : 1,
                      }}
                    />
                  </View>
                ))}
              </View>
              <Divider />
              <View style={styles.chartFooter}>
                <AppText variant="micro" tone="muted">
                  {visible[0]?.date}
                </AppText>
                <AppText variant="micro" tone="muted">
                  {t('insights_busiest')} : {data.busiest_day?.count || 0}
                </AppText>
                <AppText variant="micro" tone="muted">
                  {visible[visible.length - 1]?.date}
                </AppText>
              </View>
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHeader title={t('insights_actions')} />
            <Card style={{ gap: theme.spacing.md }}>
              <View style={styles.rowBetween}>
                <AppText variant="bodyMedium">{t('insights_completion')}</AppText>
                <AppText variant="bodyMedium" tone="brand">
                  {data.actions.completion}%
                </AppText>
              </View>
              <ProgressBar value={(data.actions.completion || 0) / 100} tone="success" />
              <View style={styles.actionStats}>
                <Chip label={`${data.actions.open} ${t('actions_open')}`} tone="warning" icon="time-outline" />
                <Chip label={`${data.actions.done} ${t('actions_done')}`} tone="success" icon="checkmark-done" />
              </View>
              <Chip
                label={t('actions_title')}
                icon="arrow-forward"
                tone="brand"
                onPress={() => router.push('/actions')}
                testID="insights-actions-link"
              />
            </Card>
          </View>

          {data.by_source?.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('insights_sources')} />
              <Card style={{ gap: theme.spacing.md }}>
                {data.by_source.map((s: any) => {
                  const meta = sourceMeta[s.key] || sourceMeta.text;
                  const color = (theme.colors as any)[meta.color] as string;
                  return (
                    <View key={s.key} style={{ gap: 6 }}>
                      <View style={styles.rowBetween}>
                        <View style={styles.sourceLabel}>
                          <Ionicons name={meta.icon as any} size={14} color={color} />
                          <AppText variant="caption" tone="secondary">
                            {meta.label}
                          </AppText>
                        </View>
                        <AppText variant="caption" tone="muted">
                          {s.count}
                        </AppText>
                      </View>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.colors.surfaceMuted,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            height: 6,
                            width: `${(s.count / totalSources) * 100}%`,
                            backgroundColor: color,
                            borderRadius: 3,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}

          {data.by_template?.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('insights_templates')} />
              <Card padded={false}>
                {data.by_template.map((tpl: any, i: number) => (
                  <View key={tpl.key}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <View style={styles.templateRow}>
                      <AppText variant="callout" numberOfLines={1} style={styles.flex}>
                        {tpl.key}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {tpl.count}
                      </AppText>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {data.top_tags?.length ? (
            <View style={styles.section}>
              <SectionHeader title={t('insights_tags')} />
              <View style={styles.tagWrap}>
                {data.top_tags.map((tag: any) => (
                  <Chip
                    key={tag.tag}
                    label={tag.tag}
                    count={tag.count}
                    onPress={() =>
                      router.push(
                        `/notes?tag=${encodeURIComponent(tag.tag)}&title=${encodeURIComponent(`#${tag.tag}`)}`
                      )
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          <AppText variant="micro" tone="muted" center style={styles.footer}>
            {lang === 'fr'
              ? 'Statistiques calculées à partir de vos notes uniquement.'
              : 'Statistics computed from your notes only.'}
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  kpi: { flexBasis: '47%', flexGrow: 1 },
  kpiInner: { padding: 14, gap: 3 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 100 },
  barSlot: { flex: 1, justifyContent: 'flex-end', minWidth: 2 },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  actionStats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sourceLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  flex: { flex: 1, minWidth: 0 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { marginTop: 24 },
});
