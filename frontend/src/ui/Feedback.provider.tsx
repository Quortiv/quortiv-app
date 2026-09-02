import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../design/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';

/* ------------------------------------------------------------------ toasts */
type ToastTone = 'success' | 'error' | 'info' | 'warning';
type Toast = { id: number; message: string; tone: ToastTone; actionLabel?: string; onAction?: () => void };

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Ctx = {
  toast: (message: string, tone?: ToastTone, opts?: { actionLabel?: string; onAction?: () => void }) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<Ctx>({ toast: () => {}, confirm: async () => false });

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(
    null
  );
  const counter = useRef(0);

  const toast = useCallback<Ctx['toast']>((message, tone = 'info', opts) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone, ...opts }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), opts?.actionLabel ? 6000 : 3600);
  }, []);

  const confirm = useCallback<Ctx['confirm']>(
    (opts) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );

  const close = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  const tones: Record<ToastTone, { bg: string; fg: string; icon: any }> = {
    success: { bg: t.colors.success, fg: '#fff', icon: 'checkmark-circle' },
    error: { bg: t.colors.danger, fg: '#fff', icon: 'alert-circle' },
    warning: { bg: t.colors.warning, fg: '#fff', icon: 'warning' },
    info: { bg: t.colors.surfaceInverse, fg: t.colors.textOnInverse, icon: 'information-circle' },
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <View
        pointerEvents="box-none"
        style={[styles.toastLayer, { top: insets.top + 8 }]}
        accessibilityLiveRegion="polite"
      >
        {toasts.map((item) => {
          const skin = tones[item.tone];
          return (
            <Animated.View
              key={item.id}
              entering={FadeInUp.duration(200)}
              exiting={FadeOutUp.duration(160)}
              style={[
                styles.toast,
                { backgroundColor: skin.bg, borderRadius: t.radius.md, maxWidth: t.layout.maxContentWidth },
                t.shadows.md,
              ]}
            >
              <Ionicons name={skin.icon} size={18} color={skin.fg} />
              <AppText variant="callout" numberOfLines={3} style={{ color: skin.fg, flex: 1 }}>
                {item.message}
              </AppText>
              {item.actionLabel && item.onAction ? (
                <Pressable
                  onPress={() => {
                    item.onAction?.();
                    setToasts((prev) => prev.filter((x) => x.id !== item.id));
                  }}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <AppText variant="label" style={{ color: skin.fg, textDecorationLine: 'underline' }}>
                    {item.actionLabel}
                  </AppText>
                </Pressable>
              ) : null}
            </Animated.View>
          );
        })}
      </View>

      <Modal
        visible={!!confirmState}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close(false)}
      >
        <View style={[styles.dialogBackdrop, { backgroundColor: t.colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel="Annuler" />
          <View
            style={[
              styles.dialog,
              { backgroundColor: t.colors.bgElevated, borderRadius: t.radius.lg, padding: t.spacing.xxl },
              t.shadows.md,
            ]}
            accessibilityViewIsModal
            accessibilityRole="alert"
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: t.radius.md,
                backgroundColor: confirmState?.destructive ? t.colors.dangerSoft : t.colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: t.spacing.lg,
                alignSelf: 'center',
              }}
            >
              <Ionicons
                name={confirmState?.destructive ? 'trash-outline' : 'help-circle-outline'}
                size={24}
                color={confirmState?.destructive ? t.colors.danger : t.colors.brand}
              />
            </View>
            <AppText variant="title2" center>
              {confirmState?.title}
            </AppText>
            {confirmState?.message ? (
              <AppText variant="callout" tone="muted" center style={{ marginTop: t.spacing.sm }}>
                {confirmState.message}
              </AppText>
            ) : null}
            <View style={{ gap: t.spacing.sm, marginTop: t.spacing.xxl }}>
              <Button
                label={confirmState?.confirmLabel || 'Confirmer'}
                variant={confirmState?.destructive ? 'danger' : 'primary'}
                onPress={() => close(true)}
                testID="confirm-accept"
              />
              <Button
                label={confirmState?.cancelLabel || 'Annuler'}
                variant="ghost"
                onPress={() => close(false)}
                testID="confirm-cancel"
              />
            </View>
          </View>
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}

const styles = StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  dialogBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 400 },
});
