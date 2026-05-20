/**
 * MiniPlayer (PR #C) — the always-mounted, always-on-screen tile that
 * - hosts the persistent <audio>/<video> elements (so the source survives
 *   route changes),
 * - shows a compact play/pause/skip/expand bar above the bottom edge
 *   whenever a clip is loaded,
 * - tapping the body expands the full-screen player.
 *
 * Visual treatment is intentionally distinct from AI Buddies (no
 * illustrated avatar — contributor photo if uploaded, otherwise just
 * initials). It must never appear next to a Buddy UI block.
 */
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useVoicesPlayer } from '../../context/VoicesPlayerContext';

const PLAYER_HEIGHT = 64;

export default function VoicesMiniPlayer() {
  const { colors } = useTheme();
  const {
    clip,
    status,
    audioRef,
    videoRef,
    togglePlayPause,
    skipNext,
    setExpanded,
  } = useVoicesPlayer();

  // We always render the audio + video elements (web only) so refs are
  // attached even before the first clip loads. Once a clip is set, the
  // visible bar appears too.
  return (
    <>
      {/* Hidden persistent media elements (web-only). */}
      {Platform.OS === 'web' && (
        <>
          <audio
            ref={audioRef as any}
            src={clip && clip.mediaType === 'audio' ? clip.audioUrl : undefined}
            preload="metadata"
            style={{ display: 'none' }}
          />
          {/* Video element is kept hidden when the full-screen player isn't
              open; the full-screen player re-parents the same ref via
              presentation overlay (kept simple by just hiding here). */}
          <video
            ref={videoRef as any}
            src={clip && clip.mediaType === 'video' ? clip.audioUrl : undefined}
            preload="metadata"
            playsInline
            style={{ display: 'none' }}
          />
        </>
      )}

      {!clip ? null : (
        <Pressable
          onPress={() => setExpanded(true)}
          data-testid="voices-mini-player"
          style={({ pressed }) => ({
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            height: PLAYER_HEIGHT,
            borderRadius: 12,
            paddingHorizontal: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: pressed ? 0.92 : 1,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
            zIndex: 30,
          })}
        >
          {/* Avatar / initials. */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: colors.background,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {clip.contributorPhotoUrl ? (
              // Plain <img> works on both web and native via React Native Web.
              Platform.OS === 'web' ? (
                <img
                  src={clip.contributorPhotoUrl}
                  alt={clip.contributorName}
                  style={{ width: 40, height: 40, objectFit: 'cover' }}
                />
              ) : (
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {clip.contributorName.slice(0, 1).toUpperCase()}
                </Text>
              )
            ) : (
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {clip.contributorName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>

          {/* Text. */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ color: colors.text, fontWeight: '600' }}
              numberOfLines={1}
            >
              {clip.contributorName}
            </Text>
            <Text
              style={{ color: colors.textMuted, fontSize: 12 }}
              numberOfLines={1}
            >
              {clip.categories[0] ?? clip.contributorBio}
            </Text>
          </View>

          {/* Controls. */}
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); togglePlayPause(); }}
            data-testid="voices-mini-toggle"
            hitSlop={8}
          >
            <Ionicons
              name={status === 'playing' ? 'pause' : 'play'}
              size={26}
              color={colors.text}
            />
          </Pressable>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); skipNext().catch(() => undefined); }}
            data-testid="voices-mini-skip"
            hitSlop={8}
          >
            <Ionicons name="play-skip-forward" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); setExpanded(true); }}
            data-testid="voices-mini-expand"
            hitSlop={8}
          >
            <Ionicons name="chevron-up" size={22} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      )}
    </>
  );
}
