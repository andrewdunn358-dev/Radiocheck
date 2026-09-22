/** Native app: shows the shared Voices player's picture for video clips. */
import { VideoView } from 'expo-video';

export default function NativeVoicesVideoView({ player }: { player: any }) {
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      nativeControls={false}
    />
  );
}
