/**
 * Veteran Voices — client SDK (PR #C).
 *
 * Thin wrapper around the public endpoints shipped in PR #C backend.
 * Anonymous user_id is persisted in AsyncStorage (matches the rest of
 * the app's pattern — no JWT for veteran-facing routes).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

const STORAGE_USER_ID_KEY = '@radiocheck.voices.user_id';
const STORAGE_INCLUDE_SENS_KEY = '@radiocheck.voices.include_sensitive';
const STORAGE_CC_DEFAULT_KEY = '@radiocheck.voices.cc_default_on';

export type ClipMediaType = 'audio' | 'video';

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface VoicesClip {
  id: string;
  contributorName: string;
  contributorBio: string;
  contributorPhotoUrl: string | null;
  audioUrl: string;
  mediaType: ClipMediaType;
  durationSeconds: number;
  captions: CaptionSegment[];
  categories: string[];
  sensitivityFlags: string[];
  recordingDate: string | null;
}

export interface CategoryCount {
  category: string;
  count: number;
}

let _userIdCache: string | null = null;

/** Idempotent: generates + persists a stable anonymous user_id on first call. */
export async function getVoicesUserId(): Promise<string> {
  if (_userIdCache) return _userIdCache;
  const existing = await AsyncStorage.getItem(STORAGE_USER_ID_KEY);
  if (existing) {
    _userIdCache = existing;
    return existing;
  }
  const fresh = `voices_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await AsyncStorage.setItem(STORAGE_USER_ID_KEY, fresh);
  _userIdCache = fresh;
  return fresh;
}

/** Per-user setting: should sensitivity-flagged clips appear by default? */
export async function getIncludeSensitive(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_INCLUDE_SENS_KEY);
  return raw === '1';
}
export async function setIncludeSensitive(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_INCLUDE_SENS_KEY, value ? '1' : '0');
}

/** Per-user setting: captions default-on in the full-screen player. */
export async function getCaptionsDefaultOn(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_CC_DEFAULT_KEY);
  return raw === '1';
}
export async function setCaptionsDefaultOn(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_CC_DEFAULT_KEY, value ? '1' : '0');
}

function apiBase(): string {
  return API_URL.replace(/\/$/, '');
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ----- Endpoints ----------------------------------------------------------

export async function fetchRandomClip(includeSensitive: boolean): Promise<VoicesClip> {
  const userId = await getVoicesUserId();
  return fetchJson<VoicesClip>(
    `/api/clips/random?user_id=${encodeURIComponent(userId)}&include_sensitive=${includeSensitive}`,
  );
}

export async function browseClips(opts: {
  category?: string;
  search?: string;
  includeSensitive?: boolean;
  limit?: number;
}): Promise<VoicesClip[]> {
  const qs = new URLSearchParams();
  if (opts.category) qs.set('category', opts.category);
  if (opts.search) qs.set('search', opts.search);
  qs.set('include_sensitive', String(Boolean(opts.includeSensitive)));
  if (opts.limit) qs.set('limit', String(opts.limit));
  return fetchJson<VoicesClip[]>(`/api/clips?${qs.toString()}`);
}

export async function fetchCategories(includeSensitive: boolean): Promise<CategoryCount[]> {
  return fetchJson<CategoryCount[]>(
    `/api/clips/categories?include_sensitive=${includeSensitive}`,
  );
}

export async function fetchSavedClips(): Promise<VoicesClip[]> {
  const userId = await getVoicesUserId();
  return fetchJson<VoicesClip[]>(`/api/clips/saved?user_id=${encodeURIComponent(userId)}`);
}

export async function fetchRecentClips(): Promise<VoicesClip[]> {
  const userId = await getVoicesUserId();
  return fetchJson<VoicesClip[]>(`/api/clips/recent?user_id=${encodeURIComponent(userId)}`);
}

export async function saveClip(clipId: string): Promise<void> {
  const userId = await getVoicesUserId();
  await fetchJson<void>(
    `/api/clips/${clipId}/save?user_id=${encodeURIComponent(userId)}`,
    { method: 'POST' },
  );
}
export async function unsaveClip(clipId: string): Promise<void> {
  const userId = await getVoicesUserId();
  await fetchJson<void>(
    `/api/clips/${clipId}/save?user_id=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}

export async function recordPlay(clipId: string, completion?: number): Promise<void> {
  const userId = await getVoicesUserId();
  const qs = new URLSearchParams({ user_id: userId });
  if (typeof completion === 'number') qs.set('completion', completion.toFixed(2));
  await fetchJson<void>(`/api/clips/${clipId}/play?${qs.toString()}`, { method: 'POST' });
}
