import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { api } from '@/src/api';
import { useTheme } from '@/src/design/ThemeProvider';
import { useI18n } from '@/src/i18n';
import { AppText } from '@/src/ui/AppText';
import { IconButton } from '@/src/ui/Button';
import { Card, Chip } from '@/src/ui/Card';
import { useFeedback } from '@/src/ui/Feedback.provider';
import { Input } from '@/src/ui/Input';
import { Markdown } from '@/src/ui/Markdown';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

export function ChatPanel({
  noteId,
  workspace,
  disabled,
}: {
  noteId?: string;
  workspace?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const { toast, confirm } = useFeedback();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loader = workspace ? api.workspaceHistory() : api.chatHistory(noteId!);
    loader.then((rows) => setMessages(rows as Message[])).catch(() => {});
    if (!workspace && noteId) {
      api.suggestions(noteId).then(setSuggestions).catch(() => {});
    }
  }, [noteId, workspace]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;
    setInput('');
    setSending(true);
    const localId = `local_${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, role: 'user', content: question }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      const res = workspace ? await api.workspaceChat(question) : await api.chat(noteId!, question);
      setMessages((prev) => [...prev, res.message as Message]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      setInput(question);
      toast(e?.message || t('error_generic'), 'error');
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    const ok = await confirm({ title: t('assistant_clear'), confirmLabel: t('delete'), destructive: true });
    if (!ok) return;
    if (workspace) await api.clearWorkspace();
    else await api.clearChat(noteId!);
    setMessages([]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'translate-with-padding' : 'height'}
      keyboardVerticalOffset={16}
      style={styles.flex}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.lg },
              ]}
            >
              <Ionicons name="chatbubbles-outline" size={26} color={theme.colors.brand} />
            </View>
            <AppText variant="title3" center>
              {t('assistant_empty')}
            </AppText>
            <AppText variant="callout" tone="muted" center>
              {t('assistant_empty_desc')}
            </AppText>
          </View>
        ) : (
          messages.map((message) => {
            const mine = message.role === 'user';
            return (
              <View
                key={message.id}
                style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}
              >
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? theme.colors.brand : theme.colors.surface,
                      borderColor: mine ? 'transparent' : theme.colors.border,
                      borderRadius: theme.radius.md,
                      borderBottomRightRadius: mine ? 4 : theme.radius.md,
                      borderBottomLeftRadius: mine ? theme.radius.md : 4,
                    },
                  ]}
                >
                  {mine ? (
                    <AppText variant="body" style={{ color: theme.colors.textOnBrand }}>
                      {message.content}
                    </AppText>
                  ) : (
                    <Markdown content={message.content} compact />
                  )}
                </View>
              </View>
            );
          })
        )}

        {sending ? (
          <View style={styles.thinking}>
            <Ionicons name="sparkles" size={14} color={theme.colors.brand} />
            <AppText variant="caption" tone="muted">
              {t('assistant_thinking')}
            </AppText>
          </View>
        ) : null}

        {suggestions.length && messages.length === 0 ? (
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Chip key={s} label={s} tone="brand" onPress={() => send(s)} testID={`suggestion-${s}`} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.inputRow}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder={workspace ? t('assistant_workspace_placeholder') : t('assistant_note_placeholder')}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          containerStyle={styles.flex}
          editable={!disabled}
          testID="chat-input"
        />
        <IconButton
          icon="arrow-up"
          variant="solid"
          onPress={() => send()}
          disabled={sending || !input.trim() || disabled}
          accessibilityLabel={lang === 'fr' ? 'Envoyer' : 'Send'}
          testID="chat-send"
        />
        {messages.length ? (
          <IconButton
            icon="trash-outline"
            onPress={clear}
            accessibilityLabel={t('assistant_clear')}
            testID="chat-clear"
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  messages: { paddingVertical: 12, gap: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderWidth: StyleSheet.hairlineWidth },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  suggestions: { gap: 8, marginTop: 8, alignItems: 'flex-start' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingBottom: 8, paddingTop: 4 },
});
