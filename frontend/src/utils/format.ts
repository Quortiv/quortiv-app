import { Lang } from '../i18n';

export function formatDuration(seconds?: number | null): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m) return `${m} min ${String(sec).padStart(2, '0')}`;
  return `${sec} s`;
}

export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const RELATIVE = {
  fr: { now: "à l'instant", min: 'min', hour: 'h', yesterday: 'Hier', days: 'j' },
  en: { now: 'just now', min: 'min', hour: 'h', yesterday: 'Yesterday', days: 'd' },
};

export function formatRelative(iso?: string | null, lang: Lang = 'fr'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = (Date.now() - date.getTime()) / 1000;
  const r = RELATIVE[lang] || RELATIVE.fr;
  if (diff < 60) return r.now;
  if (diff < 3600) return `${Math.floor(diff / 60)} ${r.min}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${r.hour}`;
  if (diff < 172800) return r.yesterday;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ${r.days}`;
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function formatDate(iso?: string | null, lang: Lang = 'fr'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(iso?: string | null, lang: Lang = 'fr'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function greetingKey(): 'greeting_morning' | 'greeting_afternoon' | 'greeting_evening' {
  const h = new Date().getHours();
  if (h < 12) return 'greeting_morning';
  if (h < 18) return 'greeting_afternoon';
  return 'greeting_evening';
}

export function firstName(name?: string | null): string {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}

export function initials(name?: string | null, email?: string | null): string {
  const source = (name || email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function compactNumber(n?: number | null): string {
  const value = n || 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.0', '')}k`;
  return String(value);
}

export function excerpt(text?: string | null, max = 140): string {
  const clean = (text || '')
    .replace(/[#*`_>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}
