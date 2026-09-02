import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api';
import { useT } from '@/src/auth';
import { colors, spacing, radius } from '@/src/theme';

export default function TemplatePicker() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    api.listTemplates().then(setItems).catch(() => {});
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('templates')}</Text>
        <Pressable onPress={() => router.back()} testID="close-templates-btn">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`template-row-${item.id}`}>
            <View style={[styles.iconBox, item.is_medical && { backgroundColor: colors.brandSecondary }]}>
              <Ionicons name={item.icon as any} size={22} color={item.is_medical ? colors.onBrandSecondary : colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowDesc}>{item.description}</Text>
            </View>
            {item.is_medical ? <View style={styles.medBadge}><Text style={styles.medBadgeText}>MED</Text></View> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface, marginBottom: 2 },
  rowDesc: { fontSize: 12, color: colors.muted, lineHeight: 16 },
  medBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  medBadgeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
