import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, TextInput, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';

interface Book {
  title: string;
  author: string;
  description: string;
  rating: number;
  category: string;
  format: 'book' | 'audiobook' | 'both';
  amazonUrl: string;
}

const BOOKS: Book[] = [
  {
    title: "Bravo Two Zero",
    author: "Andy McNab",
    description: "The classic SAS patrol account from the Gulf War. One of the best-selling war books of all time.",
    rating: 4.6,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0552141275"
  },
  {
    title: "Spoken from the Front",
    author: "Andy McNab",
    description: "Real accounts from British soldiers serving in Afghanistan. Raw, unfiltered voices from the frontline.",
    rating: 4.7,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0552161004"
  },
  {
    title: "The Body Keeps the Score",
    author: "Bessel van der Kolk",
    description: "Groundbreaking research on trauma and PTSD. Essential reading for understanding how the body stores trauma and pathways to recovery.",
    rating: 4.7,
    category: "Mental Health",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0141978619"
  },
  {
    title: "It Doesn't Have to Hurt to Work",
    author: "Dave Collins & Leigh Maybury",
    description: "Performance psychology from a former military psychologist. Practical tools for managing stress and building resilience.",
    rating: 4.5,
    category: "Mental Health",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/dp/1472976401"
  },
  {
    title: "Walking with the Wounded",
    author: "Mark McCrum",
    description: "The inspiring story of wounded veterans who trekked to the North Pole. Incredible resilience and determination.",
    rating: 4.5,
    category: "Inspiration",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0751547840"
  },
  {
    title: "The Unforgiving Minute",
    author: "Craig Mullaney",
    description: "A soldier's education from West Point to Afghanistan. Thoughtful, honest and deeply human.",
    rating: 4.6,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0143116878"
  },
  {
    title: "Chickenhawk",
    author: "Robert Mason",
    description: "Helicopter pilot's raw memoir from Vietnam. One of the most vivid accounts of combat flying ever written.",
    rating: 4.7,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0552152536"
  },
  {
    title: "Man's Search for Meaning",
    author: "Viktor Frankl",
    description: "Holocaust survivor and psychiatrist on finding purpose through suffering. A life-changing read for anyone facing darkness.",
    rating: 4.7,
    category: "Mental Health",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/1846041244"
  },
  {
    title: "Apache Dawn",
    author: "Damien Lewis",
    description: "British forces in Afghanistan — 3 Para's bloody battle for Helmand. Gripping and brutal.",
    rating: 4.5,
    category: "Military History",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0751541834"
  },
  {
    title: "Trauma Is Really Strange",
    author: "Steve Haines",
    description: "A short, illustrated guide to understanding trauma and how the body responds. Perfect introduction — not heavy reading.",
    rating: 4.6,
    category: "Mental Health",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/dp/1848192932"
  },
  {
    title: "East of Croydon",
    author: "Sue Perkins",
    description: "Not military — but a brilliant, funny memoir about identity and belonging. Sometimes you need a laugh. Good for carers too.",
    rating: 4.4,
    category: "Lighter Reads",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/1405938358"
  },
  {
    title: "Ant Middleton: First Man In",
    author: "Ant Middleton",
    description: "Former SBS point man's take on leadership, fear and resilience. Direct, no-nonsense and motivating.",
    rating: 4.6,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/0008245738"
  },
  {
    title: "Wearing the Green Beret",
    author: "Robin Childs",
    description: "A Royal Marine Commando's journey. Honest account of service life, the bonds formed, and the challenges after.",
    rating: 4.5,
    category: "Memoir",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/dp/1399018590"
  },
  {
    title: "Soldier Box",
    author: "Joe Glenton",
    description: "A British soldier's story of refusing to return to Afghanistan. Controversial, brave, and thought-provoking.",
    rating: 4.3,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/1781681058"
  },
  {
    title: "The Complete Guide to Veterans' Benefits",
    author: "Bruce Brown",
    description: "Comprehensive guide to understanding and claiming all the benefits and support you're entitled to.",
    rating: 4.4,
    category: "Practical",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/dp/0764167510"
  },
  {
    title: "Painting the Sand",
    author: "Kim Hughes GC",
    description: "Bomb disposal in Helmand by a George Cross recipient. Terrifying, gripping and deeply human.",
    rating: 4.7,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/1471156729"
  },
  {
    title: "Complex PTSD: From Surviving to Thriving",
    author: "Pete Walker",
    description: "Practical guide for recovering from complex trauma. Written by a therapist who is himself a survivor.",
    rating: 4.7,
    category: "Mental Health",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/dp/1492871842"
  },
  {
    title: "Losing the Plot",
    author: "Gail Hanlon",
    description: "Growing a garden to grow yourself. Therapeutic gardening for mental health — popular with veterans' allotment projects.",
    rating: 4.5,
    category: "Wellbeing",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/dp/1399714023"
  },
];

const CATEGORIES = ['All', 'Memoir', 'Mental Health', 'Military History', 'Practical', 'Inspiration', 'Wellbeing', 'Lighter Reads'];

export default function RecommendedReads() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'book' | 'audiobook'>('all');

  const filteredBooks = useMemo(() => {
    return BOOKS.filter(book => {
      const matchesSearch = searchQuery === '' ||
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
      const matchesFormat = selectedFormat === 'all' ||
        (selectedFormat === 'audiobook' ? (book.format === 'audiobook' || book.format === 'both') : true);
      return matchesSearch && matchesCategory && matchesFormat;
    });
  }, [searchQuery, selectedCategory, selectedFormat]);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.3;
    for (let i = 0; i < full; i++) stars.push(<Ionicons key={`f${i}`} name="star" size={14} color="#f59e0b" />);
    if (hasHalf) stars.push(<Ionicons key="h" name="star-half" size={14} color="#f59e0b" />);
    return stars;
  };

  const getFormatBadge = (format: string) => {
    if (format === 'both') return { text: 'Book & Audio', color: '#8b5cf6', bg: '#ede9fe' };
    if (format === 'audiobook') return { text: 'Audiobook', color: '#0891b2', bg: '#cffafe' };
    return { text: 'Book', color: '#b45309', bg: '#fef3c7' };
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Memoir': return '#2563eb';
      case 'Mental Health': return '#dc2626';
      case 'Military History': return '#059669';
      case 'Practical': return '#d97706';
      case 'Inspiration': return '#8b5cf6';
      case 'Wellbeing': return '#0d9488';
      case 'Lighter Reads': return '#ec4899';
      default: return '#6b7280';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={[styles.heroSection, { backgroundColor: isDark ? '#292524' : '#fef3c7', borderColor: '#b45309' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="book" size={28} color="#b45309" />
            <Text style={[styles.heroTitle, { color: colors.text, marginLeft: 10 }]}>Recommended Reads</Text>
          </View>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Books and audiobooks picked by veterans, for veterans. Whether you want to understand what you're going through, hear someone else's story, or just escape for a bit.
          </Text>
        </View>

        {/* Search Box */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]} data-testid="search-box">
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search books, authors, topics..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            data-testid="search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Format Filter */}
        <View style={styles.formatRow}>
          {(['all', 'book', 'audiobook'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.formatChip, { backgroundColor: selectedFormat === f ? '#b45309' : colors.surface, borderColor: colors.border }]}
              onPress={() => setSelectedFormat(f)}
              data-testid={`format-${f}`}
            >
              <Ionicons
                name={f === 'audiobook' ? 'headset' : f === 'book' ? 'book' : 'library'}
                size={14}
                color={selectedFormat === f ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.formatChipText, { color: selectedFormat === f ? '#fff' : colors.text }]}>
                {f === 'all' ? 'All' : f === 'audiobook' ? 'Audiobooks' : 'Books'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContainer}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: selectedCategory === cat ? getCategoryColor(cat) : colors.surface,
                  borderColor: selectedCategory === cat ? getCategoryColor(cat) : colors.border,
                }
              ]}
              onPress={() => setSelectedCategory(cat)}
              data-testid={`category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Text style={[styles.categoryPillText, { color: selectedCategory === cat ? '#fff' : colors.text }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results Count */}
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'} found
        </Text>

        {/* Book Cards */}
        {filteredBooks.map((book, index) => {
          const badge = getFormatBadge(book.format);
          return (
            <TouchableOpacity
              key={index}
              style={[styles.bookCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => openLink(book.amazonUrl)}
              activeOpacity={0.85}
              data-testid={`book-card-${index}`}
            >
              <View style={styles.bookHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookTitle, { color: colors.text }]}>{book.title}</Text>
                  <Text style={[styles.bookAuthor, { color: colors.textSecondary }]}>by {book.author}</Text>
                </View>
                <View style={[styles.formatBadge, { backgroundColor: badge.bg }]}>
                  <Ionicons name={book.format === 'book' ? 'book' : 'headset'} size={12} color={badge.color} />
                  <Text style={[styles.formatBadgeText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              </View>

              <Text style={[styles.bookDesc, { color: colors.textSecondary }]}>{book.description}</Text>

              <View style={styles.bookFooter}>
                <View style={styles.ratingRow}>
                  {renderStars(book.rating)}
                  <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{book.rating}</Text>
                </View>
                <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(book.category) + '20' }]}>
                  <Text style={[styles.categoryTagText, { color: getCategoryColor(book.category) }]}>{book.category}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {filteredBooks.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Ionicons name="search" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No books found</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Try a different search or category</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 600, alignSelf: 'center', width: '100%' },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  heroSection: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1 },
  heroTitle: { fontSize: 24, fontWeight: '700' },
  heroSubtitle: { fontSize: 14, lineHeight: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  formatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  formatChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6 },
  formatChipText: { fontSize: 13, fontWeight: '600' },
  categoryScroll: { marginBottom: 16 },
  categoryContainer: { gap: 8 },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  categoryPillText: { fontSize: 13, fontWeight: '600' },
  resultsCount: { fontSize: 13, marginBottom: 12 },
  bookCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  bookHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  bookTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  bookAuthor: { fontSize: 13 },
  formatBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  formatBadgeText: { fontSize: 11, fontWeight: '600' },
  bookDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  bookFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  categoryTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryTagText: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40, borderRadius: 16, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 14 },
});
