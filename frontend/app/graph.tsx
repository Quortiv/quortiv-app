import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { Card, Chip } from '@/src/ui/Card';
import { EmptyState, LoadingState } from '@/src/ui/Feedback';
import { AppHeader, Screen, SectionHeader } from '@/src/ui/Screen';

type Graph = { nodes: any[]; edges: any[]; orphans: number };

/** Knowledge map: tag clusters and the notes attached to each of them. */
export default function GraphScreen() {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    api
      .graph()
      .then(setGraph)
      .catch(() => setGraph({ nodes: [], edges: [], orphans: 0 }));
  }, []);

  if (!graph) {
    return (
      <Screen header={<AppHeader onBack title={t('insights_graph')} />} testID="graph-loading">
        <LoadingState />
      </Screen>
    );
  }

  const tagNodes = graph.nodes.filter((n) => n.type === 'tag').sort((a, b) => b.weight - a.weight);
  const noteNodes = graph.nodes.filter((n) => n.type === 'note');

  const notesForTag = (tagId: string) =>
    graph.edges
      .filter((e) => e.target === tagId)
      .map((e) => noteNodes.find((n) => n.id === e.source))
      .filter(Boolean);

  return (
    <Screen
      scroll
      testID="graph-screen"
      header={<AppHeader onBack title={t('insights_graph')} subtitle={t('insights_graph_desc')} />}
    >
      {tagNodes.length === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title={t('insights_no_data')}
          description={
            lang === 'fr'
              ? 'Ajoutez des tags à vos notes : les liens apparaîtront dès qu’un tag est partagé par deux notes.'
              : 'Add tags to your notes: links appear as soon as a tag is shared by two notes.'
          }
          testID="graph-empty"
        />
      ) : (
        <>
          <View style={styles.statsRow}>
            <Chip label={`${tagNodes.length} ${t('tags')}`} tone="brand" icon="pricetag-outline" />
            <Chip label={`${noteNodes.length} ${t('notes_count')}`} icon="documents-outline" />
            <Chip label={`${graph.orphans} ${lang === 'fr' ? 'isolées' : 'orphans'}`} tone="warning" />
          </View>

          {tagNodes.map((tag) => {
            const linked = notesForTag(tag.id);
            const size = Math.min(1, tag.weight / Math.max(2, tagNodes[0].weight));
            return (
              <View key={tag.id} style={styles.section}>
                <SectionHeader
                  title={`#${tag.label}`}
                  action={`${linked.length}`}
                  onAction={() =>
                    router.push(
                      `/notes?tag=${encodeURIComponent(tag.label)}&title=${encodeURIComponent(`#${tag.label}`)}`
                    )
                  }
                />
                <Card padded={false}>
                  <View style={styles.cluster}>
                    <View
                      style={[
                        styles.hub,
                        {
                          backgroundColor: theme.colors.brand,
                          opacity: 0.55 + size * 0.45,
                          borderRadius: theme.radius.pill,
                        },
                      ]}
                    >
                      <AppText variant="micro" style={{ color: '#fff' }}>
                        {tag.weight}
                      </AppText>
                    </View>
                    <View style={styles.spokes}>
                      {linked.slice(0, 8).map((node: any) => (
                        <View key={node.id} style={styles.spoke}>
                          <View style={[styles.line, { backgroundColor: theme.colors.brandSoftStrong }]} />
                          <AppText
                            variant="caption"
                            tone="secondary"
                            numberOfLines={1}
                            style={styles.flex}
                            onPress={() => router.push(`/note/${node.note_id}` as any)}
                            suppressHighlighting
                            accessibilityRole="button"
                          >
                            {node.label}
                          </AppText>
                          <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                        </View>
                      ))}
                    </View>
                  </View>
                </Card>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  section: { marginTop: 24 },
  cluster: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  hub: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  spokes: { flex: 1, gap: 8 },
  spoke: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { width: 14, height: 2, borderRadius: 1 },
  flex: { flex: 1, minWidth: 0 },
});
