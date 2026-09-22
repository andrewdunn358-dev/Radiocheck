/**
 * Web build: Veterans' Voices uses real <audio>/<video> elements rendered
 * by VoicesPlayerProvider, so the native player is not needed here.
 * (This file stops expo-video being bundled into the website.)
 */
export type NativeMediaHandle = never;
export default function NativeVoicesMedia(_props: {
  src: string | null;
  onReady: (handle: any, player: any) => void;
}) {
  return null;
}
