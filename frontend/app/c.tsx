/**
 * /c — NFC / QR public clip player.
 *
 * Purpose
 * -------
 * Wristbands, printed cards and posters in venues carry an NFC chip or
 * QR code that points to https://app.radiocheck.me/c . A stranger taps
 * the wristband, lands here on their phone browser, taps "Play", and
 * hears a 30-60s clip of a real veteran talking. That's it. No account,
 * no install, no app gate.
 *
 * Safety
 * ------
 *   • Always calls /api/clips/random-public (no auth) — that endpoint
 *     hard-enforces include_sensitive=False and status=published.
 *   • Anonymous device UUIDv4 stored in the radiocheck_recent_c cookie
 *     (30-day expiry). The cookie also keeps the 5 most-recently-served
 *     clip IDs so the same device sees variety on repeat taps.
 *   • Cookie is sent to /api/clips/random-public via ?anon_id + ?exclude
 *     query params. No third-party trackers. No personally identifying
 *     information. No localStorage / auth tokens touched.
 *
 * Out of scope (per brief)
 * ------------------------
 *   • Universal Links / App Links so an NFC tap opens the installed app
 *     instead of the browser — follow-up PR.
 *   • QR code generation — that's a printing/asset step.
 *   • NFC chip programming — physical hardware setup.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';

const RADIO_CHECK_LOGO = require('../assets/images/logo.png');

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');

// ----- Cookie helpers (web-only) ------------------------------------------
const COOKIE_NAME = 'radiocheck_recent_c';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type CookiePayload = { anon: string; recent: string[] };

function uuidv4(): string {
  // Use crypto.randomUUID where available; fall back to a Math.random()
  // generator so we don't crash on older mobile browsers that lack it.
  if (Platform.OS === 'web' && typeof globalThis !== 'undefined'
      && (globalThis as any).crypto?.randomUUID) {
    return (globalThis as any).crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readCookie(): CookiePayload {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return { anon: uuidv4(), recent: [] };
  }
  const raw = document.cookie.split('; ').find((r) => r.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return { anon: uuidv4(), recent: [] };
  try {
    const decoded = decodeURIComponent(raw.slice(COOKIE_NAME.length + 1));
    const parsed = JSON.parse(decoded);
    if (typeof parsed?.anon === 'string' && Array.isArray(parsed?.recent)) {
      return {
        anon: parsed.anon,
        recent: parsed.recent.filter((x: unknown): x is string => typeof x === 'string').slice(0, 5),
      };
    }
  } catch {
    // fall through to fresh cookie
  }
  return { anon: uuidv4(), recent: [] };
}

function writeCookie(payload: CookiePayload): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const json = encodeURIComponent(JSON.stringify(payload));
  // SameSite=Lax + Secure so the cookie is opaque to cross-origin requests
  // but survives the NFC tap → browser → app.radiocheck.me redirect.
  document.cookie = `${COOKIE_NAME}=${json}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

// ----- Page ----------------------------------------------------------------

interface PublicClip {
  id: string;
  contributorName: string;
  contributorBio: string;
  contributorPhotoUrl?: string | null;
  audioUrl: string;
  mediaType: 'audio' | 'video';
  durationSeconds: number;
  captions: Array<{ start: number; end: number; text: string }>;
}

type PageStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export default function NfcPublicClipPage() {
  const [clip, setClip] = useState<PublicClip | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cookieRef = useRef<CookiePayload>({ anon: '', recent: [] });

  // Bootstrap: read/create cookie, then fetch a clip.
  useEffect(() => {
    cookieRef.current = readCookie();
    if (!cookieRef.current.anon) cookieRef.current.anon = uuidv4();
    writeCookie(cookieRef.current);
    fetchClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClip = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setPosition(0);
    try {
      const { anon, recent } = cookieRef.current;
      const qs = new URLSearchParams({ anon_id: anon });
      if (recent.length > 0) qs.set('exclude', recent.join(','));
      const r = await fetch(`${BACKEND}/api/clips/random-public?${qs.toString()}`);
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        throw new Error(detail.detail || `Could not load a clip (${r.status}).`);
      }
      const data: PublicClip = await r.json();
      setClip(data);
      setStatus('ready');
    } catch (e: any) {
      setError(e?.message || 'Could not load a clip right now.');
      setStatus('error');
    }
  }, []);

  // Push the just-served clip into the front of the recent ring, capped at 5.
  const pushRecent = useCallback((clipId: string) => {
    const prev = cookieRef.current;
    const recent = [clipId, ...prev.recent.filter((id) => id !== clipId)].slice(0, 5);
    cookieRef.current = { anon: prev.anon, recent };
    writeCookie(cookieRef.current);
  }, []);

  // Record play with source=public_c — fire-and-forget; analytics.
  const recordPlay = useCallback((clipId: string, completion?: number) => {
    if (!BACKEND) return;
    const qs = new URLSearchParams({
      user_id: `anon:${cookieRef.current.anon}`,
      source: 'public_c',
    });
    if (typeof completion === 'number') {
      qs.set('completion', String(Math.max(0, Math.min(1, completion))));
    }
    fetch(`${BACKEND}/api/clips/${clipId}/play?${qs.toString()}`, { method: 'POST' })
      .catch(() => undefined);
  }, []);

  const onPlayPress = useCallback(() => {
    if (!clip) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      const p = el.play();
      if (p && typeof p.then === 'function') p.catch(() => setStatus('error'));
    } else {
      el.pause();
    }
  }, [clip]);

  const onHearAnother = useCallback(() => {
    if (clip) pushRecent(clip.id);
    // Pause current playback so we don't double up while the new clip loads.
    try { audioRef.current?.pause(); } catch { /* ignore */ }
    fetchClip();
  }, [clip, pushRecent, fetchClip]);

  const onTalkToSomeone = useCallback(() => {
    // Mirrors the in-app convention you just confirmed: back to /home.
    router.push('/home');
  }, []);

  // Attach media listeners to the audio/video element.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = audioRef.current;
    if (!el || !clip) return;

    const playedRef = { current: false };
    const onPlay = () => {
      setStatus('playing');
      if (!playedRef.current) {
        playedRef.current = true;
        recordPlay(clip.id);
      }
    };
    const onPause = () => setStatus((s) => (s === 'ended' ? s : 'paused'));
    const onEnded = () => {
      setStatus('ended');
      // Record completion (we know it played to the end).
      recordPlay(clip.id, 1.0);
    };
    const onTime = () => setPosition(el.currentTime);
    const onErr = () => { setStatus('error'); setError('Playback failed.'); };

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('error', onErr);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('error', onErr);
    };
  }, [clip, recordPlay]);

  const currentCaption = useMemo(() => {
    if (!captionsOn || !clip?.captions?.length) return '';
    const c = clip.captions.find((seg) => position >= seg.start && position <= seg.end);
    return c?.text ?? '';
  }, [captionsOn, clip, position]);

  const isPlaying = status === 'playing';
  const isEnded = status === 'ended';
  const duration = clip?.durationSeconds || 0;
  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <ScrollView
      contentContainerStyle={{
        minHeight: '100%',
        padding: 24,
        backgroundColor: '#0c0c0e',
      }}
      data-testid="nfc-public-page"
    >
      {/* Top-bar — Radio Check logo (centred so it's the visual anchor) */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <Image
          source={RADIO_CHECK_LOGO}
          style={{ width: 88, height: 88 }}
          resizeMode="contain"
          accessibilityLabel="Radio Check"
        />
      </View>

      <Text style={{ color: '#e7e7ea', fontSize: 26, fontWeight: '700', lineHeight: 34 }}>
        A veteran wants you to hear something.
      </Text>
      <Text style={{ color: '#9b9ba1', fontSize: 14, marginTop: 8 }}>
        Press play. Listen for a minute. You don't need an account.
      </Text>

      {/* Loading state */}
      {status === 'loading' && (
        <View style={{ marginTop: 60, alignItems: 'center' }} data-testid="nfc-loading">
          <ActivityIndicator color="#e7e7ea" />
          <Text style={{ color: '#9b9ba1', marginTop: 12 }}>Finding a voice for you…</Text>
        </View>
      )}

      {/* Error state */}
      {status === 'error' && (
        <View style={{ marginTop: 40 }} data-testid="nfc-error">
          <Text style={{ color: '#ff7d7d', fontSize: 14 }}>{error}</Text>
          <Pressable
            onPress={fetchClip}
            data-testid="nfc-retry"
            style={({ pressed }) => ({
              marginTop: 16,
              alignSelf: 'flex-start',
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#3b3b41',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: '#e7e7ea' }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {/* Player */}
      {clip && status !== 'loading' && status !== 'error' && (
        <View style={{ marginTop: 32 }} data-testid="nfc-player">
          {/* Contributor card */}
          <View
            style={{
              borderRadius: 14,
              padding: 18,
              backgroundColor: '#16161a',
              borderWidth: 1,
              borderColor: '#27272d',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: '#0c0c0e',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {clip.contributorPhotoUrl && Platform.OS === 'web' ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <img
                    src={clip.contributorPhotoUrl}
                    alt={clip.contributorName}
                    style={{ width: 56, height: 56, objectFit: 'cover' }}
                  />
                ) : (
                  <Text style={{ color: '#e7e7ea', fontSize: 20, fontWeight: '700' }}>
                    {clip.contributorName.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={{ color: '#e7e7ea', fontSize: 18, fontWeight: '600' }}>
                  {clip.contributorName}
                </Text>
                <Text style={{ color: '#9b9ba1', marginTop: 2, fontSize: 13 }} numberOfLines={2}>
                  {clip.contributorBio}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View
              style={{
                marginTop: 18,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#27272d',
                overflow: 'hidden',
              }}
              data-testid="nfc-progress"
            >
              <View
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  backgroundColor: '#e7e7ea',
                }}
              />
            </View>

            {/* Controls */}
            <View
              style={{
                marginTop: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <Pressable
                onPress={onPlayPress}
                data-testid="nfc-play"
                style={({ pressed }) => ({
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#e7e7ea',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={28}
                  color="#0c0c0e"
                  // Nudge the play triangle right a hair so it looks centred.
                  style={isPlaying ? undefined : { marginLeft: 3 }}
                />
              </Pressable>
              {/* Mid-clip "next" — same effect as the post-end button */}
              <Pressable
                onPress={onHearAnother}
                data-testid="nfc-skip"
                hitSlop={10}
                accessibilityLabel="Skip to another clip"
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: '#3b3b41',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="play-skip-forward" size={20} color="#e7e7ea" />
              </Pressable>
              {/* Captions toggle */}
              <Pressable
                onPress={() => setCaptionsOn((v) => !v)}
                data-testid="nfc-captions-toggle"
                hitSlop={10}
                accessibilityLabel="Toggle captions"
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: captionsOn ? '#e7e7ea' : '#3b3b41',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: captionsOn ? '#e7e7ea' : '#9b9ba1', fontSize: 12, fontWeight: '600' }}>
                  CC
                </Text>
              </Pressable>
            </View>

            {/* Captions display */}
            {captionsOn && (
              <Text
                style={{ color: '#e7e7ea', marginTop: 16, fontSize: 14, minHeight: 20 }}
                data-testid="nfc-caption-line"
              >
                {currentCaption}
              </Text>
            )}
          </View>

          {/* Post-end "Hear another" + app upsell */}
          {isEnded && (
            <View style={{ marginTop: 28 }}>
              <Pressable
                onPress={onHearAnother}
                data-testid="nfc-hear-another"
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  backgroundColor: '#e7e7ea',
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: '#0c0c0e', fontWeight: '700', fontSize: 16 }}>
                  Hear another
                </Text>
              </Pressable>

              {Platform.OS === 'web' && (
                <a
                  href="https://app.radiocheck.me/"
                  data-testid="nfc-app-cta"
                  style={{
                    display: 'block',
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid #27272d',
                    backgroundColor: '#16161a',
                    textDecoration: 'none',
                    color: '#e7e7ea',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    Get the Radio Check app
                  </div>
                  <div style={{ color: '#9b9ba1', fontSize: 13, marginTop: 4 }}>
                    More voices, peer support, and someone to talk to whenever you need.
                  </div>
                </a>
              )}
            </View>
          )}

          {/* Bottom "Talk to someone" CTA — always visible */}
          <Pressable
            onPress={onTalkToSomeone}
            data-testid="nfc-talk-cta"
            style={({ pressed }) => ({
              marginTop: 32,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#3b3b41',
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: '#e7e7ea', fontWeight: '600', fontSize: 15 }}>
              Talk to someone
            </Text>
          </Pressable>

          {/* The actual media element. Web-only by design — /c is a
              browser route reached from an NFC tap or QR scan.
              Hidden visually; the page's own controls drive it. */}
          {Platform.OS === 'web' && (
            clip.mediaType === 'video' ? (
              <video
                ref={audioRef as any}
                src={clip.audioUrl}
                playsInline
                preload="metadata"
                style={{ width: 0, height: 0, opacity: 0, pointerEvents: 'none', position: 'fixed' }}
                data-testid="nfc-media"
              />
            ) : (
              <audio
                ref={audioRef}
                src={clip.audioUrl}
                preload="metadata"
                style={{ display: 'none' }}
                data-testid="nfc-media"
              />
            )
          )}
        </View>
      )}
    </ScrollView>
  );
}
