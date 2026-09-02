import { Platform } from 'react-native';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
const TOKEN_KEY = 'qv_session_token';

let authToken: string | null = null;

export function setAuthToken(t: string | null) {
  authToken = t;
}
export function getAuthToken() {
  return authToken;
}
export const apiBase = `${BASE}/api`;

async function readStored(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    }
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function persistToken(token: string | null) {
  authToken = token;
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      return;
    }
    const SecureStore = require('expo-secure-store');
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* storage unavailable — session stays in memory */
  }
}

async function currentToken(): Promise<string | null> {
  if (authToken) return authToken;
  const stored = await readStored();
  if (stored) authToken = stored;
  return authToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function parseError(text: string, status: number) {
  try {
    const data = JSON.parse(text);
    const detail = data.detail ?? data.message;
    if (typeof detail === 'string') return new ApiError(detail, status);
    if (Array.isArray(detail) && detail[0]?.msg) return new ApiError(detail[0].msg, status);
  } catch {
    /* not json */
  }
  const fallback =
    status === 401
      ? 'Session expirée, reconnectez-vous.'
      : status === 0
        ? 'Connexion impossible. Vérifiez votre réseau.'
        : `Erreur serveur (${status})`;
  return new ApiError(text?.slice(0, 200) || fallback, status);
}

export async function req<T = any>(path: string, opts: RequestInit = {}, timeoutMs = 45000): Promise<T> {
  const headers: Record<string, string> = { ...((opts.headers as Record<string, string>) || {}) };
  const token = await currentToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, { ...opts, headers, signal: controller.signal });
  } catch (e: any) {
    clearTimeout(timer);
    throw new ApiError(
      e?.name === 'AbortError'
        ? 'La requête a expiré. Réessayez.'
        : 'Connexion impossible. Vérifiez votre réseau.',
      0
    );
  }
  clearTimeout(timer);

  if (!res.ok) throw parseError(await res.text().catch(() => ''), res.status);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return (await res.text()) as any;
}

/* ------------------------------------------------------------------ types */
export type Prefs = {
  language: string;
  theme: 'system' | 'light' | 'dark';
  default_template_id: string | null;
  default_folder_id: string | null;
  summary_level: 'brief' | 'standard' | 'deep';
  recording_consent_ack: boolean;
  diarization: boolean;
  reduce_motion: boolean;
};

export type User = {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
  is_guest?: boolean;
  prefs: Prefs;
  created_at: string;
};

export type ActionItem = {
  id: string;
  text: string;
  owner?: string | null;
  due_date?: string | null;
  done: boolean;
};

export type Segment = { start: number; end: number; text: string; speaker?: string | null };

export type Note = {
  id: string;
  title: string;
  folder_id: string | null;
  template_id?: string | null;
  template_name?: string | null;
  source_type: string;
  source_name?: string | null;
  source_url?: string | null;
  audio_path?: string | null;
  duration_sec: number;
  language: string;
  status: 'processing' | 'ready' | 'failed';
  error?: string | null;
  transcription: string;
  segments: Segment[];
  speakers: Record<string, string>;
  summary: string;
  summary_level: string;
  key_points: string[];
  decisions: string[];
  actions: ActionItem[];
  plan: string[];
  insights: string;
  tags: string[];
  translations?: Record<string, { summary?: string; transcription?: string; key_points?: string[] }>;
  translation_status?: string;
  favorite: boolean;
  archived: boolean;
  share_id?: string | null;
  word_count: number;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  name: string;
  color: string;
  icon: string;
  note_count: number;
  created_at: string;
};

export type Template = {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  icon: string;
  category: string;
  focus: string;
  sections: string[];
  is_specialized: boolean;
  is_builtin: boolean;
  is_default?: boolean;
};

export type NotesPage = { items: Note[]; total: number; skip: number; limit: number; has_more: boolean };

export type NoteFilters = {
  folder_id?: string;
  q?: string;
  status?: string;
  source_type?: string;
  tag?: string;
  favorite?: boolean;
  archived?: boolean;
  period?: string;
  date_from?: string;
  date_to?: string;
  sort?: string;
  limit?: number;
  skip?: number;
};

function qs(params: Record<string, any>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

/* ------------------------------------------------------------------ api */
export const api = {
  /* auth */
  authSession: (session_id: string) =>
    req<{ session_token: string; user: User }>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),
  authGuest: () => req<{ session_token: string; user: User }>('/auth/guest', { method: 'POST' }),
  me: () => req<User>('/auth/me'),
  updatePrefs: (body: Partial<Prefs> & { name?: string }) =>
    req<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  logout: () => req('/auth/logout', { method: 'POST' }),
  exportAccount: () => req<any>('/auth/export', {}, 90000),
  deleteAccount: () => req('/auth/me', { method: 'DELETE' }),

  /* folders */
  listFolders: () => req<Folder[]>('/folders'),
  createFolder: (body: { name: string; color?: string; icon?: string }) =>
    req<Folder>('/folders', { method: 'POST', body: JSON.stringify(body) }),
  updateFolder: (id: string, body: { name?: string; color?: string; icon?: string }) =>
    req<Folder>(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFolder: (id: string, moveTo?: string) =>
    req(`/folders/${id}${qs({ move_to: moveTo })}`, { method: 'DELETE' }),

  /* templates */
  listTemplates: () => req<Template[]>('/templates'),
  createTemplate: (body: {
    name: string;
    description?: string;
    focus: string;
    sections?: string[];
    icon?: string;
  }) => req<Template>('/templates', { method: 'POST', body: JSON.stringify(body) }),
  updateTemplate: (id: string, body: Partial<Template>) =>
    req<Template>(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  duplicateTemplate: (id: string) => req<Template>(`/templates/${id}/duplicate`, { method: 'POST' }),
  deleteTemplate: (id: string) => req(`/templates/${id}`, { method: 'DELETE' }),

  /* notes */
  listNotes: (filters: NoteFilters = {}) => req<NotesPage>(`/notes${qs(filters)}`),
  getNote: (id: string) => req<Note>(`/notes/${id}`),
  updateNote: (id: string, body: Partial<Note>) =>
    req<Note>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNote: (id: string) => req(`/notes/${id}`, { method: 'DELETE' }),
  bulkNotes: (note_ids: string[], action: string, folder_id?: string) =>
    req<{ affected: number }>('/notes/bulk', {
      method: 'POST',
      body: JSON.stringify({ note_ids, action, folder_id }),
    }),
  listTags: () => req<{ tag: string; count: number }[]>('/tags'),
  relatedNotes: (id: string) => req<any[]>(`/notes/${id}/related`),
  audioUrl: (id: string) => `${apiBase}/notes/${id}/audio?token=${encodeURIComponent(authToken || '')}`,

  /* capture */
  createDraft: (body: { title?: string; folder_id?: string; template_id?: string; language?: string }) =>
    req<Note>('/notes/draft', { method: 'POST', body: JSON.stringify(body) }),
  discardDraft: (id: string) => req(`/notes/${id}/draft`, { method: 'DELETE' }),
  fromText: (body: {
    text: string;
    title?: string;
    folder_id?: string;
    template_id?: string;
    language?: string;
    analyze?: boolean;
  }) => req<Note>('/notes/from-text', { method: 'POST', body: JSON.stringify(body) }, 60000),
  fromUrl: (body: { url: string; title?: string; folder_id?: string; template_id?: string; language?: string }) =>
    req<Note>('/notes/from-url', { method: 'POST', body: JSON.stringify(body) }, 90000),

  /* intelligence */
  reprocess: (id: string, body: { template_id?: string; summary_level?: string; language?: string }) =>
    req(`/notes/${id}/reprocess`, { method: 'POST', body: JSON.stringify(body) }),
  translate: (id: string, target_lang: string, scope: 'summary' | 'transcription' | 'both' = 'summary') =>
    req(`/notes/${id}/translate`, { method: 'POST', body: JSON.stringify({ target_lang, scope }) }),
  chatHistory: (id: string) => req<any[]>(`/notes/${id}/chat`),
  chat: (id: string, message: string) =>
    req<{ message: any; user_message: any }>(
      `/notes/${id}/chat`,
      { method: 'POST', body: JSON.stringify({ message }) },
      120000
    ),
  clearChat: (id: string) => req(`/notes/${id}/chat`, { method: 'DELETE' }),
  suggestions: (id: string) => req<string[]>(`/notes/${id}/suggestions`, {}, 60000),
  smartSearch: (query: string, limit = 20) =>
    req<{ items: any[]; total: number; expanded_terms: string[] }>(
      '/search/smart',
      { method: 'POST', body: JSON.stringify({ query, limit }) },
      90000
    ),
  workspaceChat: (message: string, note_ids?: string[]) =>
    req<{ message: any; sources: { id: string; title: string }[] }>(
      '/chat',
      { method: 'POST', body: JSON.stringify({ message, note_ids }) },
      120000
    ),
  workspaceHistory: () => req<any[]>('/chat/workspace'),
  clearWorkspace: () => req('/chat/workspace', { method: 'DELETE' }),

  /* export / share */
  exportUrl: (id: string, format: 'pdf' | 'md' | 'txt', includeTranscript = true) =>
    `${apiBase}/notes/${id}/export?format=${format}&include_transcript=${includeTranscript}&token=${encodeURIComponent(
      authToken || ''
    )}`,
  plainText: (id: string, format: 'md' | 'txt' = 'md') =>
    req<{ title: string; content: string }>(`/notes/${id}/plain?format=${format}`),
  createShare: (id: string, includeTranscript = true) =>
    req<{ share_id: string }>(`/notes/${id}/share?include_transcript=${includeTranscript}`, {
      method: 'POST',
    }),
  revokeShare: (id: string) => req(`/notes/${id}/share`, { method: 'DELETE' }),
  publicNote: (shareId: string) =>
    req<{ note: any; shared_by: string }>(`/public/notes/${shareId}`),

  /* insights */
  stats: () => req<{
    total_notes: number;
    total_folders: number;
    notes_this_week: number;
    processing: number;
    open_actions: number;
    total_duration_sec: number;
    total_words: number;
  }>('/stats'),
  analytics: (days = 30) => req<any>(`/analytics?days=${days}`),
  graph: () => req<{ nodes: any[]; edges: any[]; orphans: number }>('/graph'),
  listActions: (openOnly = true) => req<any[]>(`/actions?open_only=${openOnly}`),
  listReminders: (includeDone = false) => req<any[]>(`/reminders?include_done=${includeDone}`),
  createReminder: (body: { text: string; note_id?: string; action_id?: string; due_at?: string }) =>
    req('/reminders', { method: 'POST', body: JSON.stringify(body) }),
  updateReminder: (id: string, body: { text?: string; due_at?: string; done?: boolean }) =>
    req(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteReminder: (id: string) => req(`/reminders/${id}`, { method: 'DELETE' }),

  /* uploads */
  uploadMedia: async (
    uri: string,
    opts: {
      name?: string;
      mime?: string;
      title?: string;
      folder_id?: string;
      template_id?: string;
      language?: string;
      duration_sec?: number;
    } = {}
  ) => {
    const form = new FormData();
    const name = opts.name || 'enregistrement.m4a';
    await appendFile(form, uri, name, opts.mime || 'audio/mp4');
    ['title', 'folder_id', 'template_id', 'language'].forEach((k) => {
      const v = (opts as any)[k];
      if (v) form.append(k, String(v));
    });
    if (opts.duration_sec) form.append('duration_sec', String(Math.round(opts.duration_sec)));
    return postForm<Note>('/notes/upload', form, 180000);
  },

  uploadDocument: async (
    uri: string,
    opts: { name: string; mime?: string; title?: string; folder_id?: string; template_id?: string; language?: string }
  ) => {
    const form = new FormData();
    await appendFile(form, uri, opts.name, opts.mime || 'application/octet-stream');
    ['title', 'folder_id', 'template_id', 'language'].forEach((k) => {
      const v = (opts as any)[k];
      if (v) form.append(k, String(v));
    });
    return postForm<Note>('/notes/from-document', form, 180000);
  },

  uploadChunk: async (noteId: string, uri: string, offsetSec: number, language: string) => {
    const form = new FormData();
    await appendFile(form, uri, `chunk-${Date.now()}.m4a`, 'audio/mp4');
    form.append('offset_sec', String(offsetSec));
    form.append('language', language);
    return postForm<{ text: string; transcription: string; segments: Segment[] }>(
      `/notes/${noteId}/chunk`,
      form,
      120000
    );
  },

  finalizeRecording: async (
    noteId: string,
    opts: {
      uri?: string | null;
      mime?: string;
      duration_sec?: number;
      template_id?: string;
      folder_id?: string;
      language?: string;
      title?: string;
    }
  ) => {
    const form = new FormData();
    if (opts.uri) await appendFile(form, opts.uri, 'enregistrement.m4a', opts.mime || 'audio/mp4');
    form.append('duration_sec', String(Math.round(opts.duration_sec || 0)));
    ['template_id', 'folder_id', 'language', 'title'].forEach((k) => {
      const v = (opts as any)[k];
      if (v) form.append(k, String(v));
    });
    return postForm<Note>(`/notes/${noteId}/finalize`, form, 180000);
  },
};

async function appendFile(form: FormData, uri: string, name: string, type: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, name);
  } else {
    form.append('file', { uri, name, type } as any);
  }
}

async function postForm<T>(path: string, form: FormData, timeoutMs: number): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await currentToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      body: form,
      headers,
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    throw new ApiError(
      e?.name === 'AbortError' ? "L'envoi a expiré. Vérifiez votre connexion." : "L'envoi a échoué.",
      0
    );
  }
  clearTimeout(timer);
  if (!res.ok) throw parseError(await res.text().catch(() => ''), res.status);
  return res.json();
}
