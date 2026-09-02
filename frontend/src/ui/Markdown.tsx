import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';

type Token =
  | { kind: 'h1' | 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'hr' }
  | { kind: 'code'; text: string };

function tokenize(md: string): Token[] {
  const lines = (md || '').replace(/\r/g, '').split('\n');
  const tokens: Token[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;
  let code: string[] | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      tokens.push({ kind: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      tokens.push(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushList();
      if (code) {
        tokens.push({ kind: 'code', text: code.join('\n') });
        code = null;
      } else code = [];
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) {
      flushParagraph();
      flushList();
      tokens.push({ kind: 'hr' });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      tokens.push({ kind: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3', text: heading[2] });
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      tokens.push({ kind: 'quote', text: quote[1] });
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.kind !== 'ul') {
        flushList();
        list = { kind: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.kind !== 'ol') {
        flushList();
        list = { kind: 'ol', items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (code) tokens.push({ kind: 'code', text: code.join('\n') });
  return tokens;
}

/** Inline bold / italic / code / checkbox rendering. */
function Inline({ text, size = 'body' }: { text: string; size?: 'body' | 'callout' }) {
  const t = useTheme();
  const parts = useMemo(() => {
    const out: { text: string; bold?: boolean; italic?: boolean; code?: boolean }[] = [];
    const regex = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text))) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      const token = m[0];
      if (token.startsWith('**') || token.startsWith('__')) out.push({ text: token.slice(2, -2), bold: true });
      else if (token.startsWith('`')) out.push({ text: token.slice(1, -1), code: true });
      else out.push({ text: token.slice(1, -1), italic: true });
      last = m.index + token.length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }, [text]);

  return (
    <AppText variant={size} tone="secondary">
      {parts.map((p, i) => (
        <AppText
          key={i}
          variant={size}
          tone={p.bold ? 'default' : 'secondary'}
          style={[
            p.bold ? { fontWeight: '700' } : null,
            p.italic ? { fontStyle: 'italic' } : null,
            p.code
              ? {
                  fontFamily: 'monospace',
                  backgroundColor: t.colors.surfaceMuted,
                  color: t.colors.brand,
                }
              : null,
          ]}
        >
          {p.text}
        </AppText>
      ))}
    </AppText>
  );
}

export function Markdown({ content, compact }: { content: string; compact?: boolean }) {
  const t = useTheme();
  const tokens = useMemo(() => tokenize(content), [content]);
  const gap = compact ? t.spacing.sm : t.spacing.md;

  if (!content?.trim()) return null;

  return (
    <View style={{ gap }}>
      {tokens.map((token, i) => {
        switch (token.kind) {
          case 'h1':
            return (
              <AppText key={i} variant="title2" style={{ marginTop: i ? t.spacing.md : 0 }}>
                {token.text.replace(/\*\*/g, '')}
              </AppText>
            );
          case 'h2':
            return (
              <View key={i} style={{ marginTop: i ? t.spacing.lg : 0, gap: 6 }}>
                <AppText variant="title3" tone="brand">
                  {token.text.replace(/\*\*/g, '')}
                </AppText>
                <View style={{ height: 2, width: 26, borderRadius: 2, backgroundColor: t.colors.brandSoftStrong }} />
              </View>
            );
          case 'h3':
            return (
              <AppText key={i} variant="bodyMedium" style={{ marginTop: i ? t.spacing.sm : 0 }}>
                {token.text.replace(/\*\*/g, '')}
              </AppText>
            );
          case 'hr':
            return <View key={i} style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.divider }} />;
          case 'quote':
            return (
              <View
                key={i}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: t.colors.brandSoftStrong,
                  paddingLeft: t.spacing.md,
                  paddingVertical: 2,
                }}
              >
                <Inline text={token.text} size="callout" />
              </View>
            );
          case 'code':
            return (
              <View
                key={i}
                style={{
                  backgroundColor: t.colors.surfaceMuted,
                  borderRadius: t.radius.sm,
                  padding: t.spacing.md,
                }}
              >
                <AppText variant="caption" tone="secondary" style={{ fontFamily: 'monospace' }}>
                  {token.text}
                </AppText>
              </View>
            );
          case 'ul':
          case 'ol':
            return (
              <View key={i} style={{ gap: t.spacing.sm }}>
                {token.items.map((item, j) => {
                  const checkbox = item.match(/^\[( |x|X)\]\s*(.*)$/);
                  return (
                    <View key={j} style={styles.listItem}>
                      {checkbox ? (
                        <AppText variant="callout" tone={checkbox[1] === ' ' ? 'muted' : 'success'}>
                          {checkbox[1] === ' ' ? '○' : '●'}
                        </AppText>
                      ) : token.kind === 'ol' ? (
                        <AppText variant="callout" tone="brand" style={styles.marker}>
                          {j + 1}.
                        </AppText>
                      ) : (
                        <View style={[styles.dot, { backgroundColor: t.colors.brand }]} />
                      )}
                      <View style={styles.listText}>
                        <Inline text={checkbox ? checkbox[2] : item} />
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          default:
            return (
              <View key={i}>
                <Inline text={token.text} />
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  listItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  marker: { minWidth: 18 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8, marginLeft: 4, marginRight: 3 },
  listText: { flex: 1, minWidth: 0 },
});
