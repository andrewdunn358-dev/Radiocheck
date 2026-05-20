/**
 * VoicesPlayerContext — global player state (PR #C).
 *
 * Owns: the currently-loaded clip, play/pause, position, save state,
 * captions toggle, and an in-memory "queue" used for skip-next /
 * play-next. Backed by an HTML5 <audio>/<video> element rendered in the
 * MiniPlayer so the source persists across navigation.
 *
 * Web-first: this app's primary delivery is React Native Web. Native
 * platforms can swap the player engine to expo-audio later — the
 * context API stays the same.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

  // Element refs (for MiniPlayer to wire to)
  audioRef: React.RefObject<HTMLAudioElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;

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
  const currentEl = (): HTMLMediaElement | null => {
    if (!clip) return null;
    return clip.mediaType === 'video' ? videoRef.current : audioRef.current;
  };

  const loadAndPlay = useCallback(async (next: VoicesClip) => {
    setStatus('loading');
    setPositionSeconds(0);
    playedRecordedRef.current = null;
    setClip(next);
    // Wait a tick so the element ref binds to the new src, then play.
    setTimeout(() => {
      const el = next.mediaType === 'video' ? videoRef.current : audioRef.current;
      if (!el) {
        setStatus('error');
        return;
      }
      // Some browsers need .load() after a src change before .play().
      try {
        el.load();
      } catch {
        // ignore
      }
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.catch(() => setStatus('error'));
      }
    }, 0);
  }, []);

  const playRandom = useCallback(async () => {
    try {
      const next = await fetchRandomClip(includeSensitive);
      await loadAndPlay(next);
    } catch (e) {
      // Surfacing happens at the call site (it shows an error toast).
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
  }, [clip]);

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
  }, [clip]);

  const close = useCallback(() => {
    // Stop whatever's playing on either element, then drop the clip so
    // the mini-player unmounts itself. Used by the mini-player's X
    // button and by any "stop everything" path.
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
  }, [clip]);

  const value = useMemo<VoicesPlayerState>(() => ({
    clip,
    status,
    positionSeconds,
    isExpanded,
    savedClipIds,
    includeSensitive,
    captionsOn,
    captionsDefaultOn,
    audioRef,
    videoRef,
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
  }), [
    clip, status, positionSeconds, isExpanded, savedClipIds,
    includeSensitive, captionsOn, captionsDefaultOn,
    loadAndPlay, playRandom, togglePlayPause, skipNext, replay, close,
    toggleCaptions, setCaptionsDefault, setSensitivity, toggleSave, isSaved,
  ]);

  return (
    <VoicesPlayerContext.Provider value={value}>
      {children}
    </VoicesPlayerContext.Provider>
  );
}
