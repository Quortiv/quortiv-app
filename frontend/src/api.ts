import { Platform } from 'react-native';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
const TOKEN_KEY = 'sn_session_token';

let authToken: string | null = null;
export function setAuthToken(t: string | null) {
  authToken = t;
}
export function getAuthToken() {
  return authToken;
}

async function readStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(TOKEN_KEY);
      return null;
    }
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function currentToken(): Promise<string | null> {
  if (authToken) return authToken;
  const stored = await readStoredToken();
  if (stored) authToken = stored;
  return authToken;
}

async function req(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...((opts.headers as Record<string, string>) || {}),
  };
  const token = await currentToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  authSession: (session_id: string) =>
    req('/auth/session', { method: 'POST', body: JSON.stringify({ session_id }) }),
  authGuest: () => req('/auth/guest', { method: 'POST' }),
  me: () => req('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),

  listNotes: (params?: { folder_id?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.folder_id) qs.set('folder_id', params.folder_id);
    if (params?.q) qs.set('q', params.q);
    const s = qs.toString();
    return req(`/notes${s ? `?${s}` : ''}`);
  },
  getNote: (id: string) => req(`/notes/${id}`),
  updateNote: (id: string, body: any) =>
    req(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNote: (id: string) => req(`/notes/${id}`, { method: 'DELETE' }),

  listFolders: () => req('/folders'),
  createFolder: (name: string, color?: string) =>
    req('/folders', { method: 'POST', body: JSON.stringify({ name, color }) }),
  deleteFolder: (id: string) => req(`/folders/${id}`, { method: 'DELETE' }),

  listTemplates: () => req('/templates'),

  stats: () => req('/stats'),

  createFromText: (body: {
    text: string;
    title?: string;
    folder_id?: string;
    template_id?: string;
    language?: string;
  }) => req('/notes/from-text', { method: 'POST', body: JSON.stringify(body) }),

  uploadAudio: async (
    uri: string,
    opts: {
      name?: string;
      duration_sec?: number;
      folder_id?: string;
      template_id?: string;
      title?: string;
      language?: string;
      mime?: string;
    } = {}
  ) => {
    const form = new FormData();
    const name = opts.name || 'recording.m4a';
    const type = opts.mime || 'audio/mp4';
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      form.append('file', blob, name);
    } else {
      form.append('file', { uri, name, type } as any);
    }
    if (opts.title) form.append('title', opts.title);
    if (opts.folder_id) form.append('folder_id', opts.folder_id);
    if (opts.template_id) form.append('template_id', opts.template_id);
    if (opts.language) form.append('language', opts.language);
    if (opts.duration_sec) form.append('duration_sec', String(opts.duration_sec));

    const headers: Record<string, string> = {};
    const token = await currentToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}/api/notes/upload`, {
      method: 'POST',
      body: form,
      headers,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(t || `Upload failed ${res.status}`);
    }
    return res.json();
  },
};
