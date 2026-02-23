import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Image, Linking, Modal, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import YoutubePlayer from 'react-native-youtube-iframe';

// Local podcast logos
const FRANKIES_POD_LOGO = require('../assets/images/frankies-pod.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Podcast {
  id: string;
  name: string;
  host: string;
  description: string;
  focus: string[];
  logo: string;
  rssUrl?: string;
  spotifyUrl?: string;
  appleUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
}

interface LatestEpisode {
  title: string;
  date: string;
  link?: string;
  video_id?: string;
  thumbnail?: string;
  description?: string;
  type?: string;
}

const PODCASTS: Podcast[] = [
  {
    id: 'frankies-pod',
    name: "Frankie's Pod: Uncorking the Unforgettable",
    host: 'Frankie Dunn',
    description: 'Raw stories from British military veterans covering PTSD, resilience, and recovery after service.',
    focus: ['PTSD', 'Recovery', 'Veteran Stories'],
    logo: 'local', // Will use local asset
    rssUrl: 'https://feeds.acast.com/public/shows/6714f073e3d9082a5a2bf617',
    spotifyUrl: 'https://open.spotify.com/show/7wrcVZ8zdtX5urzIvZSaUJ',
    appleUrl: 'https://podcasts.apple.com/us/podcast/frankies-pod-uncorking-the-unforgettable/id1729850191',
    youtubeUrl: 'https://www.youtube.com/@FrankiesPod',
  },
  {
    id: 'tom-petch',
    name: 'Speed. Aggression. Surprise.',
    host: 'Tom Petch',
    description: 'Raw, candid conversations with military figures including SAS veterans and commanders.',
    focus: ['Military History', 'Leadership', 'Personal Stories'],
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/55/e1/a4/55e1a412-6002-3594-3e01-3e9df23244dc/mza_2886434919509823568.jpg/600x600bb.jpg',
    rssUrl: 'https://anchor.fm/s/10a795454/podcast/rss',
    spotifyUrl: 'https://open.spotify.com/show/0nqV8qef8CmvjurAPtV0qj',
    appleUrl: 'https://podcasts.apple.com/us/podcast/speed-aggression-surprise-the-untold-truth-behind/id1846864165',
    youtubeUrl: 'https://www.youtube.com/@speedaggressionsurprise',
    websiteUrl: 'https://www.tompetch.com/podcasts',
  },
  {
    id: 'old-paratrooper',
    name: 'The Old Paratrooper Podcast',
    host: 'Chris Binch (ex-2 PARA)',
    description: 'Interviews with British Paras, SAS veterans, and special forces personnel on combat and mental health.',
    focus: ['Parachute Regiment', 'Special Forces', 'Combat Stories'],
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/16/8a/d9/168ad914-db3f-70f8-8e1f-481b80e14183/mza_3119811594421415273.jpg/600x600bb.jpg',
    rssUrl: 'https://feeds.acast.com/public/shows/679a9f6b65f74095105c2af2',
    spotifyUrl: 'https://open.spotify.com/show/4jm3x1EoBBcPqQUXTwD1xc',
    appleUrl: 'https://podcasts.apple.com/us/podcast/the-old-paratrooper-podcast/id1859991469',
    youtubeUrl: 'https://www.youtube.com/@TheOldParatrooperpodcast',
  },
  {
    id: 'beyond-barracks',
    name: 'Beyond the Barracks',
    host: 'RSL Victoria / Gina Allsop',
    description: 'Unfiltered stories from veterans covering transitions to civilian life, resilience, and recovery.',
    focus: ['Transition', 'Recovery', 'Family Support'],
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts122/v4/71/da/c3/71dac30b-6a59-30a7-d5d3-878fa678afc8/mza_11916087358722418837.png/600x600bb.jpg',
    spotifyUrl: 'https://open.spotify.com/show/4MwejGmTY5CdDT8zsRkUTQ',
    youtubeUrl: 'https://www.youtube.com/channel/UCh_L_4t746PldKRfIKvj-0w',
  },
  {
    id: 'combat-stress-100',
    name: 'Combat Stress 100 Podcast',
    host: 'Combat Stress Charity',
    description: 'Clinical expertise combined with veteran testimonies on PTSD, depression, and substance misuse.',
    focus: ['PTSD', 'Depression', 'Clinical Support'],
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/85/7b/90/857b90f2-c285-191f-c296-4cff7e8bd158/mza_11603060415803986663.jpg/600x600bb.jpg',
    rssUrl: 'https://feeds.acast.com/public/shows/62a8eda1-799d-4268-805c-6dd9ebd85c8e',
    appleUrl: 'https://podcasts.apple.com/us/podcast/the-combat-stress-100-podcast/id1534726321',
    websiteUrl: 'https://combatstress.org.uk/combat-stress-100-podcast',
  },
  {
    id: 'military-veterans',
    name: 'Military Veterans Podcast',
    host: 'Gavin Watson (British Army)',
    description: 'Veterans share experiences from before, during, and after service. Includes dedicated PTSD episodes.',
    focus: ['Service Life', 'PTSD', 'Peer Support'],
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/7a/a7/f7/7aa7f7a8-a6f8-fb6d-25d7-1dbf19662230/mza_8250357024051214226.jpg/600x600bb.jpg',
    appleUrl: 'https://podcasts.apple.com/gb/podcast/military-veterans-podcast/id1531710391',
    youtubeUrl: 'https://www.youtube.com/c/MilitaryVeteransPodcast',
    websiteUrl: 'https://milvetpodcast.com',
  },
  {
    id: 'talking-wounded',
    name: 'Talking with the Wounded',
    host: 'Ben',
    description: 'Frank, often humorous conversations with physically and mentally wounded veterans about recovery.',
    focus: ['Wounded Veterans', 'Recovery', 'PTSD Resolution'],
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/1c/62/6b/1c626bbc-1412-2ce3-3a59-1faa05092eac/mza_6205096570431111656.jpg/600x600bb.jpg',
    rssUrl: 'https://talkingwiththewounded.podbean.com/feed.xml',
    appleUrl: 'https://podcasts.apple.com/gb/podcast/talking-with-the-wounded/id1712320662',
    spotifyUrl: 'https://open.spotify.com/show/3kP9jH6mN4vR8sT2wX5yZ1',
  },
  {
    id: 'stray-voltage',
    name: 'Stray Voltage',
    host: 'Veterans',
    description: 'By veterans, for veterans. Covering British military transitions and mental health topics.',
    focus: ['Veteran to Veteran', 'Transitions', 'Mental Health'],
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/cd/05/66/cd056601-ed8d-18f0-dd35-bd8ddc76eb30/mza_1296788537650884352.jpg/600x600bb.jpg',
    spotifyUrl: 'https://open.spotify.com/show/6gyPTRjSXBuD2ImEnWGseD',
    youtubeUrl: 'https://www.youtube.com/channel/UCz1sjXkh9mOI2UoovGMsQjw',
  },
];

// Backend URL for fetching latest episodes
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://veteran-support-8.preview.emergentagent.com';

export default function PodcastsScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const styles = createStyles(colors);
  const [latestEpisodes, setLatestEpisodes] = useState<Record<string, LatestEpisode>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<{videoId: string, title: string} | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    fetchLatestEpisodes();
  }, []);

  const fetchLatestEpisodes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/podcasts/latest`);
      if (response.ok) {
        const data = await response.json();
        setLatestEpisodes(data);
      }
    } catch (error) {
      console.log('Could not fetch latest episodes, showing static content');
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const getPrimaryLink = (podcast: Podcast): string | undefined => {
    return podcast.spotifyUrl || podcast.appleUrl || podcast.youtubeUrl || podcast.websiteUrl;
  };

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setIsPlaying(false);
    }
  }, []);

  const playVideo = (videoId: string, title: string) => {
    setPlayingVideo({ videoId, title });
    setIsPlaying(true);
  };

  const closeVideo = () => {
    setPlayingVideo(null);
    setIsPlaying(false);
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          data-testid="back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recommended Podcasts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Section */}
        <View style={styles.introSection}>
          <View style={styles.introIconContainer}>
            <Ionicons name="headset" size={32} color="#db2777" />
          </View>
          <Text style={styles.introTitle}>Listen & Learn</Text>
          <Text style={styles.introText}>
            Curated podcasts from veterans, for veterans. Real stories about service, 
            recovery, mental health, and life after the military.
          </Text>
        </View>

        {/* Podcasts List */}
        <View style={styles.podcastsList}>
          {PODCASTS.map((podcast) => {
            const latestEp = latestEpisodes[podcast.id];
            
            // Use local logo for Frankie's Pod, remote URLs for others
            const logoSource = podcast.logo === 'local' 
              ? FRANKIES_POD_LOGO 
              : { uri: podcast.logo };
            
            return (
              <View key={podcast.id} style={styles.podcastCard}>
                {/* Header with Logo */}
                <View style={styles.podcastHeader}>
                  <Image 
                    source={logoSource} 
                    style={styles.podcastLogo}
                  />
                  <View style={styles.podcastInfo}>
                    <Text style={styles.podcastName} numberOfLines={2}>{podcast.name}</Text>
                    <Text style={styles.podcastHost}>Hosted by {podcast.host}</Text>
                  </View>
                </View>
                
                <Text style={styles.podcastDescription}>{podcast.description}</Text>
                
                {/* Latest Episode with Thumbnail */}
                {latestEp && (
                  <View style={styles.latestEpisodeContainer}>
                    <Text style={styles.latestEpisodeHeader}>Latest Episode</Text>
                    
                    {/* Video Thumbnail with Play Button */}
                    {latestEp.video_id && latestEp.thumbnail ? (
                      <TouchableOpacity 
                        style={styles.videoThumbnailContainer}
                        onPress={() => playVideo(latestEp.video_id!, latestEp.title)}
                        activeOpacity={0.8}
                        data-testid={`play-${podcast.id}`}
                      >
                        <Image 
                          source={{ uri: latestEp.thumbnail }}
                          style={styles.videoThumbnail}
                          resizeMode="cover"
                        />
                        <View style={styles.playButtonOverlay}>
                          <View style={styles.playButton}>
                            <Ionicons name="play" size={32} color="#fff" />
                          </View>
                        </View>
                        <View style={styles.videoDuration}>
                          <Text style={styles.videoDurationText}>
                            {latestEp.type === 'youtube' ? 'YouTube' : 'Podcast'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.latestEpisodeFallback}
                        onPress={() => latestEp.link && openLink(latestEp.link)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.latestEpisodeIcon}>
                          <Ionicons name="play-circle" size={24} color="#db2777" />
                        </View>
                        <View style={styles.latestEpisodeInfo}>
                          <Text style={styles.latestEpisodeTitle} numberOfLines={2}>{latestEp.title}</Text>
                          {latestEp.date && (
                            <Text style={styles.latestEpisodeDate}>{formatDate(latestEp.date)}</Text>
                          )}
                        </View>
                        <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    
                    {/* Episode Title and Date */}
                    {latestEp.video_id && (
                      <View style={styles.episodeMetadata}>
                        <Text style={styles.episodeTitle} numberOfLines={2}>{latestEp.title}</Text>
                        {latestEp.date && (
                          <Text style={styles.episodeDate}>{formatDate(latestEp.date)}</Text>
                        )}
                        {latestEp.description && (
                          <Text style={styles.episodeDescription} numberOfLines={2}>{latestEp.description}</Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
                
                {/* Focus Tags */}
                <View style={styles.tagsContainer}>
                  {podcast.focus.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                
                {/* Platform Links */}
                <View style={styles.platformsContainer}>
                  {podcast.spotifyUrl && (
                    <TouchableOpacity
                      style={styles.platformButton}
                      onPress={() => openLink(podcast.spotifyUrl!)}
                      data-testid={`${podcast.id}-spotify`}
                    >
                      <Ionicons name="logo-spotify" size={18} color="#1DB954" />
                      <Text style={styles.platformText}>Spotify</Text>
                    </TouchableOpacity>
                  )}
                  {podcast.appleUrl && (
                    <TouchableOpacity
                      style={styles.platformButton}
                      onPress={() => openLink(podcast.appleUrl!)}
                      data-testid={`${podcast.id}-apple`}
                    >
                      <Ionicons name="logo-apple" size={18} color={colors.text} />
                      <Text style={styles.platformText}>Apple</Text>
                    </TouchableOpacity>
                  )}
                  {podcast.youtubeUrl && (
                    <TouchableOpacity
                      style={styles.platformButton}
                      onPress={() => openLink(podcast.youtubeUrl!)}
                      data-testid={`${podcast.id}-youtube`}
                    >
                      <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                      <Text style={styles.platformText}>YouTube</Text>
                    </TouchableOpacity>
                  )}
                  {podcast.websiteUrl && (
                    <TouchableOpacity
                      style={styles.platformButton}
                      onPress={() => openLink(podcast.websiteUrl!)}
                      data-testid={`${podcast.id}-website`}
                    >
                      <Ionicons name="globe-outline" size={18} color={colors.primary} />
                      <Text style={styles.platformText}>Website</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.footerText}>
            These podcasts are independently produced. Radio Check recommends them 
            as helpful resources but is not affiliated with their creators.
          </Text>
        </View>
      </ScrollView>

      {/* YouTube Video Player Modal */}
      <Modal
        visible={playingVideo !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeVideo}
      >
        <SafeAreaView style={styles.videoModal}>
          <View style={styles.videoModalHeader}>
            <TouchableOpacity 
              style={styles.closeVideoButton}
              onPress={closeVideo}
              data-testid="close-video"
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.videoModalTitle} numberOfLines={2}>
              {playingVideo?.title || 'Now Playing'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          
          {playingVideo && (
            <View style={styles.videoPlayerContainer}>
              <YoutubePlayer
                height={SCREEN_WIDTH * 0.5625} // 16:9 aspect ratio
                width={SCREEN_WIDTH}
                play={isPlaying}
                videoId={playingVideo.videoId}
                onChangeState={onStateChange}
                webViewProps={{
                  onMessage: (event: any) => {
                    // Safely handle messages from the YouTube iframe
                    try {
                      const data = typeof event.nativeEvent.data === 'string' 
                        ? JSON.parse(event.nativeEvent.data) 
                        : event.nativeEvent.data;
                      // Message parsed successfully
                    } catch (e) {
                      // Ignore non-JSON messages from the iframe
                    }
                  }
                }}
              />
            </View>
          )}
          
          <View style={styles.videoActions}>
            <TouchableOpacity 
              style={styles.watchOnYouTubeButton}
              onPress={() => {
                if (playingVideo) {
                  openLink(`https://www.youtube.com/watch?v=${playingVideo.videoId}`);
                }
              }}
            >
              <Ionicons name="logo-youtube" size={20} color="#FF0000" />
              <Text style={styles.watchOnYouTubeText}>Watch on YouTube</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  introSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  introIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fce7f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  introText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  podcastsList: {
    gap: 16,
  },
  podcastCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  podcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  podcastLogo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.background,
    marginRight: 12,
  },
  podcastInfo: {
    flex: 1,
  },
  podcastName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  podcastHost: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  podcastDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  latestEpisode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  latestEpisodeIcon: {
    marginRight: 10,
  },
  latestEpisodeInfo: {
    flex: 1,
  },
  latestEpisodeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#db2777',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  latestEpisodeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  latestEpisodeDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  platformsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  platformButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  platformText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // New video player styles
  latestEpisodeContainer: {
    marginBottom: 12,
  },
  latestEpisodeHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#db2777',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  videoThumbnailContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  videoThumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: colors.background,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#db2777',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoDurationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  episodeMetadata: {
    paddingVertical: 4,
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  episodeDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  episodeDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  latestEpisodeFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    borderRadius: 10,
    padding: 12,
  },
  // Video Modal styles
  videoModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  videoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeVideoButton: {
    padding: 4,
  },
  videoModalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  videoPlayerContainer: {
    backgroundColor: '#000',
  },
  videoActions: {
    padding: 20,
    alignItems: 'center',
  },
  watchOnYouTubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  watchOnYouTubeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
