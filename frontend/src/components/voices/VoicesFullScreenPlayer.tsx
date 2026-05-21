/**
 * VoicesFullScreenPlayer (PR #C) — expanded player UI shown when the
 * user taps the mini-player. Renders a Modal so the underlying route
 * isn't dismounted (the persistent <audio>/<video> stay alive).
 *
 * Layout:
 *   • header: close + save heart + CC toggle
 *   • body:
 *       video clip → embedded <video> (large)
 *       audio clip → contributor photo (large) or initials
 *   • captions area (scrollable, follows positionSeconds)
 *   • controls: replay · play/pause · skip
 *   • CTA: "Talk to someone" → /unified-chat
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useVoicesPlayer } from '../../context/VoicesPlayerContext';

export default function VoicesFullScreenPlayer() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    clip,
    status,
    positionSeconds,
    isExpanded,
    setExpanded,
    togglePlayPause,
    skipNext,
    replay,
    close,
    captionsOn,
    toggleCaptions,
    captionsDefaultOn,
    setCaptionsDefault,
    toggleSave,
    isSaved,
    setVideoSlot,
  } = useVoicesPlayer();

  const activeCaption = useMemo(() => {
    if (!clip) return null;
    return (
      clip.captions.find(
        (c) => positionSeconds >= c.start && positionSeconds < c.end,
      ) ?? null
    );
  }, [clip, positionSeconds]);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Scroll captions to the active line as time advances.
    if (!captionsOn || !activeCaption || !clip) return;
    const idx = clip.captions.findIndex((c) => c.start === activeCaption.start);
    if (idx < 0) return;
    scrollRef.current?.scrollTo({ y: idx * 28, animated: true });
  }, [activeCaption, captionsOn, clip]);

  const [showSettings, setShowSettings] = useState(false);
  if (!clip) return null;

  const saved = isSaved(clip.id);

  return (
    <Modal
      visible={isExpanded}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setExpanded(false)}
    >
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
        data-testid="voices-fullscreen-player"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 48,
            paddingBottom: 12,
            gap: 16,
          }}
        >
          <Pressable
            onPress={() => setExpanded(false)}
            data-testid="voices-fullscreen-close"
            hitSlop={10}
          >
            <Ionicons name="chevron-down" size={28} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => toggleSave(clip.id).catch(() => undefined)}
            data-testid="voices-fullscreen-save"
            hitSlop={10}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={26}
              color={saved ? '#e1455c' : colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() => close()}
            data-testid="voices-fullscreen-stop"
            hitSlop={10}
            accessibilityLabel="Stop playback"
          >
            <Ionicons name="stop-circle-outline" size={26} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => setShowSettings((v) => !v)}
            data-testid="voices-fullscreen-settings"
            hitSlop={10}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Settings popover */}
        {showSettings && (
          <View
            style={{
              marginHorizontal: 16,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: colors.text }}>Captions default-on</Text>
              <Switch
                value={captionsDefaultOn}
                onValueChange={(v) => setCaptionsDefault(v)}
              />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Off by default. Tap the CC button below to toggle for this clip only,
              or flip this switch to default-on for all clips.
            </Text>
          </View>
        )}

        {/* Body */}
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          {clip.mediaType === 'video' ? (
            // The actual <video> element lives in the Provider and is
            // portaled INTO this slot when isExpanded. Using a plain
            // <div> (web-only) so we get a real DOM ref to publish via
            // setVideoSlot — React Native's <View> ref API isn't a
            // straight HTMLElement.
            Platform.OS === 'web' ? (
              <div
                ref={setVideoSlot}
                data-testid="voices-fullscreen-video-slot"
                style={{
                  marginTop: 12,
                  height: 240,
                  borderRadius: 12,
                  backgroundColor: '#000',
                  overflow: 'hidden',
                }}
              />
            ) : (
              <View
                style={{
                  marginTop: 12,
                  height: 240,
                  borderRadius: 12,
                  backgroundColor: '#000',
                }}
              />
            )
          ) : (
            // Audio clip: contributor photo or initials
            <View
              style={{
                width: 200,
                height: 200,
                borderRadius: 100,
                alignSelf: 'center',
                marginTop: 20,
                backgroundColor: colors.card,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {clip.contributorPhotoUrl ? (
                Platform.OS === 'web' ? (
                  <img
                    src={clip.contributorPhotoUrl}
                    alt={clip.contributorName}
                    style={{ width: 200, height: 200, objectFit: 'cover' }}
                  />
                ) : (
                  <Text style={{ color: colors.text, fontSize: 48, fontWeight: '700' }}>
                    {clip.contributorName.slice(0, 1).toUpperCase()}
                  </Text>
                )
              ) : (
                <Text style={{ color: colors.text, fontSize: 64, fontWeight: '700' }}>
                  {clip.contributorName.slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
          )}

          {/* Name / bio */}
          <Text
            style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 16, textAlign: 'center' }}
          >
            {clip.contributorName}
          </Text>
          <Text
            style={{ color: colors.textMuted, fontSize: 14, marginTop: 4, textAlign: 'center' }}
          >
            {clip.contributorBio}
          </Text>

          {/* Captions */}
          <View style={{ flex: 1, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Pressable
                onPress={toggleCaptions}
                data-testid="voices-fullscreen-cc"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: captionsOn ? colors.text : colors.border,
                }}
              >
                <Text style={{ color: captionsOn ? colors.text : colors.textMuted, fontWeight: '600', fontSize: 12 }}>
                  CC {captionsOn ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 8 }}>
                {clip.captions.length === 0
                  ? 'No captions for this clip.'
                  : `${clip.captions.length} caption segments`}
              </Text>
            </View>
            {captionsOn && (
              <ScrollView
                ref={scrollRef}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 8,
                  backgroundColor: colors.card,
                }}
                data-testid="voices-fullscreen-captions"
              >
                {clip.captions.map((c, idx) => {
                  const active =
                    positionSeconds >= c.start && positionSeconds < c.end;
                  return (
                    <Text
                      key={idx}
                      style={{
                        color: active ? colors.text : colors.textMuted,
                        fontWeight: active ? '700' : '400',
                        marginVertical: 2,
                        fontSize: active ? 16 : 14,
                      }}
                    >
                      {c.text}
                    </Text>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Controls */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-around',
              marginVertical: 16,
            }}
          >
            <Pressable
              onPress={replay}
              data-testid="voices-fullscreen-replay"
              hitSlop={10}
            >
              <Ionicons name="refresh" size={28} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={togglePlayPause}
              data-testid="voices-fullscreen-toggle"
              hitSlop={10}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.text,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={status === 'playing' ? 'pause' : 'play'}
                size={32}
                color={colors.background}
              />
            </Pressable>
            <Pressable
              onPress={() => skipNext().catch(() => undefined)}
              data-testid="voices-fullscreen-skip"
              hitSlop={10}
            >
              <Ionicons name="play-skip-forward" size={28} color={colors.text} />
            </Pressable>
          </View>

          {/* CTA — Talk to someone */}
          <Pressable
            onPress={() => {
              setExpanded(false);
              router.push('/unified-chat');
            }}
            data-testid="voices-fullscreen-talk-cta"
            style={({ pressed }) => ({
              marginBottom: 28,
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: colors.text,
              alignItems: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.background, fontSize: 16, fontWeight: '700' }}>
              Talk to someone
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
