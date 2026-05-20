/**
 * /voices — Library screen (PR #C).
 *
 * Sub-tabs:
 *   • Categories   — clip counts per situational category
 *   • Saved        — user's favourited clips
 *   • Recent       — most-recently-played, deduped
 *   • Search       — by contributor name or caption text
 *
 * Sensitivity filter toggle persists via AsyncStorage.
 *
 * No AI-Buddy adjacency: this screen lives at its own route. The
 * persistent mini-player floats over the bottom inset.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { useVoicesPlayer } from '../src/context/VoicesPlayerContext';
import {
  browseClips,
  fetchCategories,
  fetchRecentClips,
  fetchSavedClips,
  type CategoryCount,
  type VoicesClip,
} from '../src/services/voicesApi';

type Tab = 'categories' | 'saved' | 'recent' | 'search';

export default function VoicesLibraryScreen() {
  const { colors } = useTheme();
  const player = useVoicesPlayer();
  const [tab, setTab] = useState<Tab>('categories');
  const [loading, setLoading] = useState(false);

  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [clipsInCategory, setClipsInCategory] = useState<VoicesClip[] | null>(null);
  const [saved, setSaved] = useState<VoicesClip[]>([]);
  const [recent, setRecent] = useState<VoicesClip[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<VoicesClip[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'categories') {
        if (activeCategory) {
          const r = await browseClips({
            category: activeCategory,
            includeSensitive: player.includeSensitive,
          });
          setClipsInCategory(r);
        } else {
          const c = await fetchCategories(player.includeSensitive);
          setCategoryCounts(c);
          setClipsInCategory(null);
        }
      } else if (tab === 'saved') {
        setSaved(await fetchSavedClips());
      } else if (tab === 'recent') {
        setRecent(await fetchRecentClips());
      }
    } finally {
      setLoading(false);
    }
  }, [tab, activeCategory, player.includeSensitive]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runSearch = useCallback(async () => {
    if (!searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const r = await browseClips({
        search: searchQ.trim(),
        includeSensitive: player.includeSensitive,
      });
      setSearchResults(r);
    } finally {
      setLoading(false);
    }
  }, [searchQ, player.includeSensitive]);

  const ClipRow = ({ clip }: { clip: VoicesClip }) => (
    <Pressable
      onPress={() => {
        player.loadAndPlay(clip).catch(() => undefined);
        player.setExpanded(true);
      }}
      data-testid={`voices-library-row-${clip.id}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {clip.contributorPhotoUrl && Platform.OS === 'web' ? (
          <img
            src={clip.contributorPhotoUrl}
            alt={clip.contributorName}
            style={{ width: 44, height: 44, objectFit: 'cover' }}
          />
        ) : (
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {clip.contributorName.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
          {clip.contributorName}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
          {clip.contributorBio}
        </Text>
      </View>
      <Ionicons
        name={clip.mediaType === 'video' ? 'videocam' : 'headset-outline'}
        size={18}
        color={colors.textMuted}
      />
    </Pressable>
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: 36 }}
      data-testid="voices-library-screen"
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', paddingHorizontal: 16 }}>
        Voices
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 13,
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        Real voices from people who&apos;ve been through it. Tap any to listen.
      </Text>

      {/* Sensitivity toggle */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>
          Include heavier topics (MST, suicidal ideation, addiction, violence)
        </Text>
        <Switch
          value={player.includeSensitive}
          onValueChange={(v) => player.setSensitivity(v)}
          data-testid="voices-library-sensitivity-toggle"
        />
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 }}>
        {(['categories', 'saved', 'recent', 'search'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => { setTab(t); setActiveCategory(null); }}
            data-testid={`voices-library-tab-${t}`}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: tab === t ? colors.text : 'transparent',
              borderWidth: 1,
              borderColor: tab === t ? colors.text : colors.border,
            }}
          >
            <Text
              style={{
                color: tab === t ? colors.background : colors.text,
                fontSize: 13,
                fontWeight: '600',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

      {tab === 'categories' && !activeCategory && (
        <FlatList
          data={categoryCounts}
          keyExtractor={(c) => c.category}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveCategory(item.category)}
              data-testid={`voices-library-cat-${item.category}`}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                flexDirection: 'row',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ flex: 1, color: colors.text, textTransform: 'capitalize' }}>
                {item.category.replace(/_/g, ' ')}
              </Text>
              <Text style={{ color: colors.textMuted }}>{item.count}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, padding: 16 }}>
              No categories yet.
            </Text>
          }
        />
      )}

      {tab === 'categories' && activeCategory && (
        <>
          <Pressable
            onPress={() => setActiveCategory(null)}
            style={{ paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="arrow-back" size={16} color={colors.text} />
            <Text style={{ color: colors.text, marginLeft: 8, textTransform: 'capitalize' }}>
              {activeCategory.replace(/_/g, ' ')}
            </Text>
          </Pressable>
          <FlatList
            data={clipsInCategory ?? []}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => <ClipRow clip={item} />}
          />
        </>
      )}

      {tab === 'saved' && (
        <FlatList
          data={saved}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ClipRow clip={item} />}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, padding: 16 }}>
              No saved clips yet — tap the heart on the full-screen player to save one.
            </Text>
          }
        />
      )}

      {tab === 'recent' && (
        <FlatList
          data={recent}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ClipRow clip={item} />}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, padding: 16 }}>
              Nothing recent — start with the &quot;Hear someone&quot; card on home.
            </Text>
          }
        />
      )}

      {tab === 'search' && (
        <>
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              alignItems: 'center',
              gap: 8,
              marginVertical: 8,
            }}
          >
            <TextInput
              value={searchQ}
              onChangeText={setSearchQ}
              onSubmitEditing={runSearch}
              placeholder="Search by name or what was said…"
              placeholderTextColor={colors.textMuted}
              data-testid="voices-library-search-input"
              style={{
                flex: 1,
                color: colors.text,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            />
            <Pressable
              onPress={runSearch}
              data-testid="voices-library-search-go"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: colors.text,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.background, fontWeight: '600' }}>Search</Text>
            </Pressable>
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => <ClipRow clip={item} />}
          />
        </>
      )}
    </View>
  );
}
