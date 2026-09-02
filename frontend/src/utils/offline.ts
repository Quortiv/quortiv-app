/**
 * Offline layer: read-through cache for lists/notes plus a durable outbox for
 * captures created while the device is offline. Everything persists in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api, ApiError, Note } from '../api';

const NOTES_KEY = 'qv_cache_notes';
const NOTE_KEY = (id: string) => `qv_cache_note_${id}`;
const OUTBOX_KEY = 'qv_outbox';

export type PendingCapture = {
  id: string;
  kind: 'text';
  payload: { text: string; title?: string; folder_id?: string; template_id?: string; language?: string };
  created_at: string;
};

export function isOffline(e: unknown) {
  return e instanceof ApiError && e.status === 0;
}

export async function cacheNotes(notes: Note[]) {
  try {
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify({ at: Date.now(), notes: notes.slice(0, 60) }));
  } catch {
    /* quota */
  }
}

export async function readCachedNotes(): Promise<{ notes: Note[]; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { notes: parsed.notes || [], at: parsed.at || 0 };
  } catch {
    return null;
  }
}

export async function cacheNote(note: Note) {
  try {
    await AsyncStorage.setItem(NOTE_KEY(note.id), JSON.stringify(note));
  } catch {
    /* quota */
  }
}

export async function readCachedNote(id: string): Promise<Note | null> {
  try {
    const raw = await AsyncStorage.getItem(NOTE_KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function readOutbox(): Promise<PendingCapture[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeOutbox(items: PendingCapture[]) {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items)).catch(() => {});
}

export async function queueCapture(payload: PendingCapture['payload']) {
  const items = await readOutbox();
  const entry: PendingCapture = {
    id: `pending_${Date.now()}`,
    kind: 'text',
    payload,
    created_at: new Date().toISOString(),
  };
  await writeOutbox([...items, entry]);
  return entry;
}

/** Attempts to flush the outbox. Returns how many captures were synced. */
export async function flushOutbox(): Promise<number> {
  const items = await readOutbox();
  if (!items.length) return 0;
  const remaining: PendingCapture[] = [];
  let synced = 0;
  for (const item of items) {
    try {
      await api.fromText(item.payload);
      synced += 1;
    } catch (e) {
      if (isOffline(e)) remaining.push(item);
      // permanent failures are dropped so the queue never blocks forever
    }
  }
  await writeOutbox(remaining);
  return synced;
}

export async function clearCaches() {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as string[]);
  const mine = keys.filter((k) => k.startsWith('qv_cache_') || k === OUTBOX_KEY);
  if (mine.length) await AsyncStorage.multiRemove(mine).catch(() => {});
}
