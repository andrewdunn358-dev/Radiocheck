import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

import { API_URL } from '../src/config/api';

interface Character {
  id: string;
  name: string;
  description: string;
  avatar: string;
}

interface AboutInfo {
  title: string;
  description: string;
}

export default function AIBuddies() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [about, setAbout] = useState<AboutInfo | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai-buddies/characters`);
      const data = await response.json();
      // Filter to only show Tommy and Doris for the 24/7 crisis support page
      const crisisCharacters = data.characters.filter((char: Character) => 
        char.id === 'tommy' || char.id === 'doris'
      );
      setCharacters(crisisCharacters);
      setAbout(data.about);
    } catch (error) {
      console.error('Error fetching characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectCharacter = (characterId: string) => {
    router.push(`/ai-chat?character=${characterId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/home')} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color="#94a3b8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>We're on stag 24/7</Text>
        <TouchableOpacity onPress={() => setShowAbout(!showAbout)} style={styles.infoButton}>
          <FontAwesome5 name="info-circle" size={22} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* About Section (Expandable) */}
      {showAbout && about && (
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>{about.title}</Text>
          <Text style={styles.aboutText}>{about.description}</Text>
        </View>
      )}

      {/* Intro Text */}
      <View style={styles.introSection}>
        <Text style={styles.introTitle}>Choose Your Battle Buddy</Text>
        <Text style={styles.introText}>
          Select who you'd like to talk to. Both are here to listen without judgement.
        </Text>
      </View>

      {/* Character Cards */}
      <View style={styles.charactersContainer}>
        {characters.map((char) => (
          <TouchableOpacity
            key={char.id}
            style={styles.characterCard}
            onPress={() => selectCharacter(char.id)}
            activeOpacity={0.8}
            data-testid={`character-${char.id}`}
          >
            <Image source={{ uri: char.avatar }} style={styles.characterAvatar} />
            <View style={styles.characterInfo}>
              <Text style={styles.characterName}>{char.name}</Text>
              <Text style={styles.characterDescription}>{char.description}</Text>
            </View>
            <View style={styles.chatButton}>
              <FontAwesome5 name="comments" size={18} color="#fff" />
              <Text style={styles.chatButtonText}>Chat</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <FontAwesome5 name="info-circle" size={14} color="#64748b" />
        <Text style={styles.disclaimerText}>
          Tommy and Doris are AI companions. They cannot provide medical advice or replace human support. 
          If you need to speak to a real person, use the options below.
        </Text>
      </View>

      {/* Talk to Real Person Buttons */}
      <View style={styles.realPersonSection}>
        <Text style={styles.realPersonTitle}>Need a real person?</Text>
        <View style={styles.realPersonButtons}>
          <TouchableOpacity
            style={styles.peerButton}
            onPress={() => router.push('/peer-support')}
          >
            <FontAwesome5 name="users" size={16} color="#16a34a" />
            <Text style={styles.peerButtonText}>Talk to a Peer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.counsellorButton}
            onPress={() => router.push('/crisis-support')}
          >
            <FontAwesome5 name="user-md" size={16} color="#2563eb" />
            <Text style={styles.counsellorButtonText}>Talk to Counsellor</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f1419',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1a2332',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3a4d',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  infoButton: {
    padding: 8,
  },
  aboutCard: {
    backgroundColor: '#1e2a3a',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  aboutText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },
  introSection: {
    padding: 24,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  introText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
  },
  charactersContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  characterCard: {
    backgroundColor: '#1e2a3a',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3a4d',
  },
  characterAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  characterInfo: {
    flex: 1,
  },
  characterName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  characterDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  chatButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a2332',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  realPersonSection: {
    padding: 16,
    alignItems: 'center',
  },
  realPersonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  realPersonButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  peerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  peerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  counsellorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  counsellorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
});
