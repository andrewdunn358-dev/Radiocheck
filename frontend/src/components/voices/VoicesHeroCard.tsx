/**
 * VoicesHeroCard (PR #C) — the "Hear someone" CTA placed above the
 * fold on home.tsx. Calm tone, no illustrations, no AI-buddy framing.
 *
 * One tap = fetch a random clip + start playback in the persistent
 * mini-player. No navigation occurs (player floats at the bottom).
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useVoicesPlayer } from '../../context/VoicesPlayerContext';

export default function VoicesHeroCard({
  onError,
}: {
  onError?: (msg: string) => void;
}) {
  const { colors } = useTheme();
  const { playRandom, primeUserGesture } = useVoicesPlayer();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    // Grant the shared media element a user-gesture token BEFORE the
    // async fetch — otherwise browsers (especially Safari) reject the
    // post-fetch .play() and the user has to tap play a second time.
    primeUserGesture();
    setBusy(true);
    try {
      await playRandom();
    } catch (e) {
      onError?.(
        e instanceof Error
          ? e.message
          : 'No clips available right now. Please check back later.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      data-testid="voices-hero-card"
      style={({ pressed }) => ({
        marginHorizontal: 20,
        marginVertical: 12,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Ionicons name="headset-outline" size={28} color={colors.text} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}
        >
          Veterans Voices
        </Text>
      </View>
      <Ionicons name="play-circle" size={36} color={colors.text} />
    </Pressable>
  );
}
