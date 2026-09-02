import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api, ApiError, persistToken, Prefs, User } from './api';

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleSession: (sessionId: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  savePrefs: (patch: Partial<Prefs> & { name?: string }) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithGoogleSession: async () => {},
  signInAsGuest: async () => {},
  signOut: async () => {},
  refresh: async () => {},
  savePrefs: async () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await persistToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const signInWithGoogleSession = useCallback(async (sessionId: string) => {
    const res = await api.authSession(sessionId);
    await persistToken(res.session_token);
    setUser(res.user);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/`
        : Linking.createURL('');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web') {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    const url: string | null = (result as any).url || (await Linking.getInitialURL());
    const match = url?.match(/[?#&]session_id=([^&#]+)/);
    if (!match) throw new ApiError('Connexion Google annulée.', 401);
    await signInWithGoogleSession(decodeURIComponent(match[1]));
  }, [signInWithGoogleSession]);

  /* Web returns from the OAuth provider with ?session_id= in the URL. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const match = window.location.href.match(/[?#&]session_id=([^&#]+)/);
    if (!match) return;
    signInWithGoogleSession(decodeURIComponent(match[1]))
      .catch(() => {})
      .finally(() => {
        window.history.replaceState({}, '', window.location.pathname);
      });
  }, [signInWithGoogleSession]);

  const signInAsGuest = useCallback(async () => {
    const res = await api.authGuest();
    await persistToken(res.session_token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* token may already be invalid */
    }
    await persistToken(null);
    setUser(null);
  }, []);

  const savePrefs = useCallback(async (patch: Partial<Prefs> & { name?: string }) => {
    const updated = await api.updatePrefs(patch);
    setUser(updated);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.deleteAccount();
    await persistToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signInWithGoogleSession,
      signInAsGuest,
      signOut,
      refresh: hydrate,
      savePrefs,
      deleteAccount,
    }),
    [
      user,
      loading,
      signInWithGoogle,
      signInWithGoogleSession,
      signInAsGuest,
      signOut,
      hydrate,
      savePrefs,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
