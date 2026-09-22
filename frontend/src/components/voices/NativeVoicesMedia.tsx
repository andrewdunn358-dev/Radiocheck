/**
 * NativeVoicesMedia — the phone-app equivalent of the web <audio>/<video>
 * elements in VoicesPlayerProvider.
 *
 * One expo-video player handles both audio and video clips (expo-video
 * plays audio-only files fine), keeping the "single media element"
 * design from the web version: the mini-player and full-screen player
 * share this one player, so there is never double audio.
 *
 * To keep VoicesPlayerProvider's logic identical on web and native, this
 * component hands the Provider a small "handle" that behaves like an
 * HTMLMediaElement: paused / currentTime / duration, play() / pause() /
 * load(), and addEventListener for timeupdate, play, pause, ended,
 * loadedmetadata and error.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';

type MediaEvent = 'timeupdate' | 'play' | 'pause' | 'ended' | 'loadedmetadata' | 'error';
type Listener = () => void;

export interface NativeMediaHandle {
  readonly paused: boolean;
  currentTime: number;
  readonly duration: number;
  play: () => Promise<void>;
  pause: () => void;
  load: () => void;
  addEventListener: (type: MediaEvent, fn: Listener) => void;
  removeEventListener: (type: MediaEvent, fn: Listener) => void;
}

export default function NativeVoicesMedia({
  src,
  onReady,
}: {
  src: string | null;
  onReady: (handle: NativeMediaHandle | null, player: VideoPlayer | null) => void;
}) {
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
  });

  const listenersRef = useRef<Map<MediaEvent, Set<Listener>>>(new Map());

  const handle = useMemo<NativeMediaHandle>(() => {
    const listeners = listenersRef.current;
    return {
      get paused() {
        return !player.playing;
      },
      get currentTime() {
        return player.currentTime;
      },
      set currentTime(v: number) {
        player.currentTime = v;
      },
      get duration() {
        return player.duration || 0;
      },
      play: async () => {
        // If the clip has finished, start again from the beginning.
        const d = player.duration || 0;
        if (d > 0 && player.currentTime >= d - 0.25) player.currentTime = 0;
        player.play();
      },
      pause: () => player.pause(),
      // The source is swapped in the effect below when `src` changes, so
      // there is nothing extra to load here.
      load: () => undefined,
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type, fn) => {
        listeners.get(type)?.delete(fn);
      },
    };
  }, [player]);

  // Publish the handle + player to the Provider.
  useEffect(() => {
    onReady(handle, player);
    return () => onReady(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, player]);

  // Forward expo-video events as HTMLMediaElement-style events.
  useEffect(() => {
    const emit = (type: MediaEvent) => {
      listenersRef.current.get(type)?.forEach((fn) => {
        try {
          fn();
        } catch {
          // a listener error must never take the player down
        }
      });
    };
    const subs = [
      player.addListener('timeUpdate', () => emit('timeupdate')),
      player.addListener('playingChange', ({ isPlaying }) => emit(isPlaying ? 'play' : 'pause')),
      player.addListener('playToEnd', () => emit('ended')),
      player.addListener('sourceLoad', () => emit('loadedmetadata')),
      player.addListener('statusChange', ({ status }) => {
        if (status === 'error') emit('error');
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player]);

  // Swap the clip. This runs before the Provider's autoplay effect (child
  // effects run first), so the Provider's play() hits the new source.
  useEffect(() => {
    try {
      player.replace(src ? { uri: src } : null);
    } catch {
      // ignore — statusChange('error') will report real failures
    }
  }, [player, src]);

  return null;
}
