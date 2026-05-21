/**
 * VoicesPlayerContext — global player state (PR #C, refactored to fix
 * double-audio and missing-autoplay bugs).
 *
 * Single-source-of-truth design
 * =============================
 * The Provider renders the ONE and ONLY <audio> + <video> DOM elements
 * for the whole app (web-only). Mini-player and full-screen player are
 * now pure-UI components that dispatch via this Context — they do NOT
 * render their own media elements.
 *
 * Why a single element?
 * ---------------------
 * Before this refactor, MiniPlayer hosted the persistent <audio>/<video>
 * AND FullScreenPlayer rendered a *second* <video controls> for video
 * clips. That gave us two independent media states for the same clip —
 * controls in one view didn't move the other, and tapping play in the
 * modal would start a second stream layered on top of the first
 * (double audio). The fix is to keep exactly one media element alive
 * for the lifetime of the player and let both views share it.
 *
 * Video positioning trick
 * -----------------------
 * The <video> element is fixed-positioned. When `isExpanded` is true
 * and the clip is video, the element fills the modal's video slot
 * (a placeholder View in FullScreenPlayer reserves the layout space).
 * Otherwise it collapses to 0×0 / opacity 0 but stays mounted, so its
 * audio track keeps playing and currentTime is preserved on collapse.
 *
 * Autoplay (Bug 1)
 * ----------------
 * The old `setTimeout(0)` race could land .play() AFTER the browser's
 * user-activation token had already expired (especially on Safari with
 * a slow network fetch in between). We now:
 *   1. Expose `primeUserGesture()` — call this synchronously in the
 *      user-tap handler BEFORE any async work. It calls .play() +
 *      .pause() on the media element to keep the activation alive.
 *   2. Drive autoplay from a `useEffect(..., [clip?.id, ...])` that
 *      fires after React commits the new src, eliminating the timer.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  fetchRandomClip,
  getCaptionsDefaultOn,
  getIncludeSensitive,
  recordPlay,
  saveClip,
  setCaptionsDefaultOn as persistCaptionsDefault,
  setIncludeSensitive as persistIncludeSensitive,
  unsaveClip,
  type VoicesClip,
} from '../services/voicesApi';

type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

interface VoicesPlayerState {
  // Active clip + status
  clip: VoicesClip | null;
  status: PlayerStatus;
  positionSeconds: number;
  isExpanded: boolean;          // full-screen player visibility
  savedClipIds: Set<string>;    // local cache so the heart updates instantly

  // User preferences (persisted via AsyncStorage)
  includeSensitive: boolean;
  captionsOn: boolean;
  captionsDefaultOn: boolean;

  // Actions
  loadAndPlay: (clip: VoicesClip) => Promise<void>;
  playRandom: () => Promise<void>;
  togglePlayPause: () => void;
  skipNext: () => Promise<void>;
  replay: () => void;
  /** Stop playback + drop the active clip so the mini-player hides. */
  close: () => void;
  setExpanded: (v: boolean) => void;
  toggleCaptions: () => void;
  setCaptionsDefault: (v: boolean) => Promise<void>;
  setSensitivity: (v: boolean) => Promise<void>;
  toggleSave: (clipId: string) => Promise<void>;
  isSaved: (clipId: string) => boolean;
  /**
   * Grant the underlying media element a user-activation token. Call
   * synchronously inside a press / click handler BEFORE any async work
   * so the next .play() after the network fetch isn't rejected by the
   * browser's autoplay policy.
   */
  primeUserGesture: () => void;
}

const VoicesPlayerContext = createContext<VoicesPlayerState | null>(null);

export function useVoicesPlayer(): VoicesPlayerState {
  const ctx = useContext(VoicesPlayerContext);
  if (!ctx) throw new Error('useVoicesPlayer must be used inside VoicesPlayerProvider');
  return ctx;
}

export function VoicesPlayerProvider({ children }: { children: ReactNode }) {
  const [clip, setClip] = useState<VoicesClip | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedClipIds, setSavedClipIds] = useState<Set<string>>(new Set());
  const [includeSensitive, setIncludeSensitiveState] = useState(false);
  const [captionsDefaultOn, setCaptionsDefaultState] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playedRecordedRef = useRef<string | null>(null);
  const lastClipDurationRef = useRef<number>(0);
  // Tracks whether the user (or hero card) asked us to start playing on
  // the next clip change. The autoplay effect reads + clears this.
  const desiredPlayingRef = useRef<boolean>(false);

  // Load persisted prefs on mount.
  useEffect(() => {
    (async () => {
      try {
        const [sens, cc] = await Promise.all([getIncludeSensitive(), getCaptionsDefaultOn()]);
        setIncludeSensitiveState(sens);
        setCaptionsDefaultState(cc);
        setCaptionsOn(cc);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Reset captions toggle to the user's default whenever a new clip loads.
  useEffect(() => {
    setCaptionsOn(captionsDefaultOn);
  }, [clip?.id, captionsDefaultOn]);

  /** The element that's currently relevant for this clip's media type. */
  const currentEl = useCallback((): HTMLMediaElement | null => {
    if (!clip) return null;
    return clip.mediaType === 'video' ? videoRef.current : audioRef.current;
  }, [clip]);

  /**
   * Sync user-gesture priming. Called from the hero card's onPress
   * BEFORE awaiting the fetch. We call .play() then .pause() on the
   * relevant element with no src — the play() will reject (which we
   * swallow) but the act of calling it inside the gesture stack keeps
   * the browser's user-activation alive so the real .play() after the
   * fetch completes is accepted.
   */
  const primeUserGesture = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const a = audioRef.current;
    const v = videoRef.current;
    // We don't know the upcoming clip's mediaType yet, so prime both.
    try {
      const pa = a?.play();
      if (pa && typeof pa.then === 'function') pa.catch(() => undefined);
      a?.pause();
    } catch {
      // ignore
    }
    try {
      const pv = v?.play();
      if (pv && typeof pv.then === 'function') pv.catch(() => undefined);
      v?.pause();
    } catch {
      // ignore
    }
  }, []);

  const loadAndPlay = useCallback(async (next: VoicesClip) => {
    // Mark intent first — the autoplay effect picks it up after React
    // commits the new src.
    desiredPlayingRef.current = true;
    setStatus('loading');
    setPositionSeconds(0);
    playedRecordedRef.current = null;
    setClip(next);
  }, []);

  const playRandom = useCallback(async () => {
    try {
      const next = await fetchRandomClip(includeSensitive);
      await loadAndPlay(next);
    } catch (e) {
      desiredPlayingRef.current = false;
      setStatus('error');
      throw e;
    }
  }, [includeSensitive, loadAndPlay]);

  const togglePlayPause = useCallback(() => {
    const el = currentEl();
    if (!el || !clip) return;
    if (el.paused) {
      const p = el.play();
      if (p && typeof p.then === 'function') p.catch(() => setStatus('error'));
    } else {
      el.pause();
    }
  }, [clip, currentEl]);

  const skipNext = useCallback(async () => {
    // Always pull a random next (matches the "two consecutive taps return
    // different clips" acceptance criterion — the backend last-served map
    // guarantees it).
    await playRandom();
  }, [playRandom]);

  const replay = useCallback(() => {
    const el = currentEl();
    if (!el) return;
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.then === 'function') p.catch(() => setStatus('error'));
  }, [currentEl]);

  const close = useCallback(() => {
    // Stop whatever's playing on either element, then drop the clip so
    // the mini-player unmounts itself. Used by the mini-player's X
    // button and by any "stop everything" path.
    desiredPlayingRef.current = false;
    try {
      audioRef.current?.pause();
    } catch {
      // ignore
    }
    try {
      videoRef.current?.pause();
    } catch {
      // ignore
    }
    setIsExpanded(false);
    setStatus('idle');
    setPositionSeconds(0);
    setClip(null);
  }, []);

  const toggleSave = useCallback(async (clipId: string) => {
    setSavedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
    try {
      if (savedClipIds.has(clipId)) {
        await unsaveClip(clipId);
      } else {
        await saveClip(clipId);
      }
    } catch (e) {
      // Roll back optimistic update on failure.
      setSavedClipIds((prev) => {
        const next = new Set(prev);
        if (next.has(clipId)) next.delete(clipId);
        else next.add(clipId);
        return next;
      });
      throw e;
    }
  }, [savedClipIds]);

  const isSaved = useCallback((clipId: string) => savedClipIds.has(clipId), [savedClipIds]);

  const setSensitivity = useCallback(async (v: boolean) => {
    setIncludeSensitiveState(v);
    await persistIncludeSensitive(v);
  }, []);

  const setCaptionsDefault = useCallback(async (v: boolean) => {
    setCaptionsDefaultState(v);
    await persistCaptionsDefault(v);
  }, []);

  const toggleCaptions = useCallback(() => {
    setCaptionsOn((v) => !v);
  }, []);

  // -- Autoplay effect (replaces fragile setTimeout(0)) ----------------
  // Runs after React commits the new src onto the relevant element.
  // If the caller asked us to start playing (via loadAndPlay), we kick
  // off .load() + .play() here, where the DOM is guaranteed up to date.
  useEffect(() => {
    if (!clip) return;
    if (!desiredPlayingRef.current) return;
    desiredPlayingRef.current = false;
    const el = clip.mediaType === 'video' ? videoRef.current : audioRef.current;
    if (!el) {
      setStatus('error');
      return;
    }
    // Pause the OTHER element to guarantee no leftover audio from a
    // previous clip of the opposite media type.
    try {
      if (clip.mediaType === 'video') audioRef.current?.pause();
      else videoRef.current?.pause();
    } catch {
      // ignore
    }
    try {
      el.load();
    } catch {
      // ignore
    }
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.catch(() => setStatus('error'));
    }
  }, [clip]);

  // -- Element listeners (attached after the first render) --------------
  // Both audio + video share the same handlers; we just toggle which ref
  // is active based on mediaType.
  useEffect(() => {
    const el = currentEl();
    if (!el || !clip) return;

    const onTimeUpdate = () => setPositionSeconds(el.currentTime);
    const onPlay = () => setStatus('playing');
    const onPause = () => setStatus('paused');
    const onEnded = () => {
      setStatus('ended');
      // Best-effort completion record.
      const duration = el.duration || clip.durationSeconds || lastClipDurationRef.current;
      if (clip.id && playedRecordedRef.current !== clip.id) {
        playedRecordedRef.current = clip.id;
        recordPlay(clip.id, 1.0).catch(() => undefined);
      } else if (clip.id) {
        const completion = duration > 0 ? Math.min(1, el.currentTime / duration) : undefined;
        recordPlay(clip.id, completion).catch(() => undefined);
      }
    };
    const onLoadedMetadata = () => {
      lastClipDurationRef.current = el.duration || 0;
      // Once we know it's playable, log a play event so analytics + the
      // random selector's "recent" exclusion both fire even if the user
      // skips before the end.
      if (clip.id && playedRecordedRef.current !== clip.id) {
        playedRecordedRef.current = clip.id;
        recordPlay(clip.id).catch(() => undefined);
      }
    };
    const onError = () => setStatus('error');

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('error', onError);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('error', onError);
    };
  }, [clip, currentEl]);

  const value = useMemo<VoicesPlayerState>(() => ({
    clip,
    status,
    positionSeconds,
    isExpanded,
    savedClipIds,
    includeSensitive,
    captionsOn,
    captionsDefaultOn,
    loadAndPlay,
    playRandom,
    togglePlayPause,
    skipNext,
    replay,
    close,
    setExpanded: setIsExpanded,
    toggleCaptions,
    setCaptionsDefault,
    setSensitivity,
    toggleSave,
    isSaved,
    primeUserGesture,
  }), [
    clip, status, positionSeconds, isExpanded, savedClipIds,
    includeSensitive, captionsOn, captionsDefaultOn,
    loadAndPlay, playRandom, togglePlayPause, skipNext, replay, close,
    toggleCaptions, setCaptionsDefault, setSensitivity, toggleSave, isSaved,
    primeUserGesture,
  ]);

  // ----- Single-source-of-truth media elements (web only) -------------
  // The <video> element is fixed-positioned. It either:
  //   - fills the modal video slot when isExpanded && mediaType==='video'
  //   - or collapses to 0×0 (but stays mounted so its audio keeps
  //     playing and currentTime is preserved).
  const videoVisible = !!clip && clip.mediaType === 'video' && isExpanded;
  const videoStyle: React.CSSProperties = videoVisible
    ? {
        position: 'fixed',
        top: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(92vw, 520px)',
        maxHeight: 300,
        background: '#000',
        zIndex: 10000,
        borderRadius: 12,
      }
    : {
        position: 'fixed',
        width: 0,
        height: 0,
        opacity: 0,
        pointerEvents: 'none',
        // Park off-screen so layout never sees it.
        top: -9999,
        left: -9999,
      };

  return (
    <VoicesPlayerContext.Provider value={value}>
      {Platform.OS === 'web' && (
        <>
          <audio
            ref={audioRef as any}
            src={clip && clip.mediaType === 'audio' ? clip.audioUrl : undefined}
            preload="metadata"
            style={{ display: 'none' }}
          />
          <video
            ref={videoRef as any}
            src={clip && clip.mediaType === 'video' ? clip.audioUrl : undefined}
            preload="metadata"
            playsInline
            style={videoStyle}
            data-testid="voices-shared-video"
          />
        </>
      )}
      {children}
    </VoicesPlayerContext.Provider>
  );
}
