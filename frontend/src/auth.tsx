import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api, setAuthToken } from './api';
import { Lang } from './i18n';

WebBrowser.maybeCompleteAuthSession();

type User = { user_id: string; email: string; name?: string; picture?: string };

type Ctx = {
  user: User | null;
  loading: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

const TOKEN_KEY = 'sn_session_token';
const LANG_KEY = 'sn_lang';

async function saveToken(t: string | null) {
  if (Platform.OS === 'web') {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } else {
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function saveLang(l: Lang) {
  if (Platform.OS === 'web') localStorage.setItem(LANG_KEY, l);
  else await SecureStore.setItemAsync(LANG_KEY, l);
}
async function readLang(): Promise<Lang> {
  if (Platform.OS === 'web') return (localStorage.getItem(LANG_KEY) as Lang) || 'fr';
  return ((await SecureStore.getItemAsync(LANG_KEY)) as Lang) || 'fr';
}

const usedSessionIds = new Set<string>();

async function exchangeSessionId(sid: string) {
  if (usedSessionIds.has(sid)) return null;
  usedSessionIds.add(sid);
  const r = await api.authSession(sid);
  return r;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>('fr');

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    saveLang(l);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const l = await readLang();
      setLangState(l);
      const t = await readToken();
      if (t) {
        setAuthToken(t);
        try {
          const me = await api.me();
          setUser(me);
        } catch {
          await saveToken(null);
          setAuthToken(null);
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // handle web session_id in hash/query first
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.location.hash + window.location.search;
      const m = raw.match(/[?#&]session_id=([^&#]+)/);
      if (m) {
        const sid = decodeURIComponent(m[1]);
        exchangeSessionId(sid)
          .then((r) => {
            if (r) {
              saveToken(r.session_token);
              setAuthToken(r.session_token);
              setUser(r.user);
              // clean URL
              try {
                const url = new URL(window.location.href);
                url.hash = '';
                url.searchParams.delete('session_id');
                window.history.replaceState(window.history.state, '', url.toString());
              } catch {}
            }
          })
          .catch(() => {})
          .finally(() => bootstrap());
        return;
      }
    }
    bootstrap();

    // mobile deep-link handler
    if (Platform.OS !== 'web') {
      const sub = Linking.addEventListener('url', ({ url }) => {
        const m = url.match(/[?#&]session_id=([^&#]+)/);
        if (m) {
          const sid = decodeURIComponent(m[1]);
          exchangeSessionId(sid)
            .then((r) => {
              if (r) {
                saveToken(r.session_token);
                setAuthToken(r.session_token);
                setUser(r.user);
              }
            })
            .catch(() => {});
        }
      });
      Linking.getInitialURL().then((url) => {
        if (!url) return;
        const m = url.match(/[?#&]session_id=([^&#]+)/);
        if (m) {
          const sid = decodeURIComponent(m[1]);
          exchangeSessionId(sid)
            .then((r) => {
              if (r) {
                saveToken(r.session_token);
                setAuthToken(r.session_token);
                setUser(r.user);
              }
            })
            .catch(() => {});
        }
      });
      return () => sub.remove();
    }
  }, [bootstrap]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin + '/'
        : Linking.createURL('');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = (result as any).url || null;
    if (!url) url = await Linking.getInitialURL();
    if (url) {
      const m = url.match(/[?#&]session_id=([^&#]+)/);
      if (m) {
        const sid = decodeURIComponent(m[1]);
        const r = await exchangeSessionId(sid);
        if (r) {
          await saveToken(r.session_token);
          setAuthToken(r.session_token);
          setUser(r.user);
        }
      }
    }
  }, []);

  const signInAsGuest = useCallback(async () => {
    const r = await api.authGuest();
    await saveToken(r.session_token);
    setAuthToken(r.session_token);
    setUser(r.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    await saveToken(null);
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, lang, setLang, signInWithGoogle, signInAsGuest, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export function useT() {
  const { lang } = useAuth();
  const { strings } = require('./i18n');
  return (key: keyof typeof strings['fr']) => strings[lang][key] || String(key);
}
