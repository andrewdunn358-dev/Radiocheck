import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Linking, ActivityIndicator, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';

interface Resource {
  id: string;
  title: string;
  description?: string;
  category: string;
  content?: string;
  link?: string;
  image_url?: string;
}

export default function Resources() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  const fetchResources = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/resources`);
      if (response.ok) {
        const data = await response.json();
        setResources(data);
      } else {
        setError('Unable to load resources');
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
      setError('Unable to connect. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const categories = [...new Set(resources.map(r => r.category))];
  
  const filteredResources = selectedCategory 
    ? resources.filter(r => r.category === selectedCategory)
    : resources;

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resources Library</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.description}>
          <Text style={styles.descriptionText}>
            Helpful resources, guides, and support materials for veterans and their families.
          </Text>
        </View>

        {/* Category Filter */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <TouchableOpacity
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>All</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Loading State */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading resources...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchResources}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredResources.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="library" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No resources available</Text>
            <Text style={styles.emptySubtext}>Check back later for helpful materials</Text>
          </View>
        ) : (
          /* Resources List */
          filteredResources.map((resource) => (
            <TouchableOpacity 
              key={resource.id} 
              style={styles.resourceCard}
              onPress={() => setExpandedResource(expandedResource === resource.id ? null : resource.id)}
              activeOpacity={0.8}
            >
              {resource.image_url && (
                <Image 
                  source={{ uri: resource.image_url }} 
                  style={styles.resourceImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.resourceContent}>
                <View style={styles.resourceHeader}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{resource.category}</Text>
                  </View>
                </View>
                <Text style={styles.resourceTitle}>{resource.title}</Text>
                {resource.description && (
                  <Text style={styles.resourceDescription} numberOfLines={expandedResource === resource.id ? undefined : 2}>
                    {resource.description}
                  </Text>
                )}
                
                {expandedResource === resource.id && resource.content && (
                  <View style={styles.resourceFullContent}>
                    <Text style={styles.resourceContentText}>{resource.content}</Text>
                  </View>
                )}

                <View style={styles.resourceActions}>
                  {resource.link && (
                    <TouchableOpacity 
                      style={styles.linkButton}
                      onPress={() => handleOpenLink(resource.link!)}
                    >
                      <Ionicons name="open-outline" size={16} color="#ffffff" />
                      <Text style={styles.linkButtonText}>Learn More</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.expandButton}>
                    <Ionicons 
                      name={expandedResource === resource.id ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Resources are provided for informational purposes. Always consult with professionals for medical or legal advice.
          </Text>
        </View>
      </ScrollView>
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
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  description: {
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resourceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resourceImage: {
    width: '100%',
    height: 150,
  },
  resourceContent: {
    padding: 16,
  },
  resourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  resourceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  resourceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  resourceFullContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resourceContentText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  resourceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  linkButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  expandButton: {
    padding: 8,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
