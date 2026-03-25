import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, TextInput, Linking, Image, ActivityIndicator } from 'react-native';
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
  coverUrl: string;
}

const BOOKS: Book[] = [
  {
    title: "Bravo Two Zero",
    author: "Andy McNab",
    description: "The classic SAS patrol account from the Gulf War. One of the best-selling war books of all time.",
    rating: 4.6,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Bravo+Two+Zero+Andy+McNab",
    coverUrl: "https://covers.openlibrary.org/b/id/1003545-M.jpg"
  },
  {
    title: "Spoken from the Front",
    author: "Andy McNab",
    description: "Real accounts from British soldiers serving in Afghanistan. Raw, unfiltered voices from the frontline.",
    rating: 4.7,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Spoken+from+the+Front+Andy+McNab",
    coverUrl: "https://covers.openlibrary.org/b/id/6430891-M.jpg"
  },
  {
    title: "Escape from Kabul",
    author: "Levison Wood & Geraint Jones",
    description: "The gripping inside story of the 2021 Kabul evacuation. Eyewitness accounts from soldiers, interpreters and officials during the Taliban's return.",
    rating: 4.6,
    category: "Military History",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Escape+from+Kabul+Levison+Wood+Geraint+Jones",
    coverUrl: "https://covers.openlibrary.org/b/id/14748224-M.jpg"
  },
  {
    title: "Walking the Nile",
    author: "Levison Wood",
    description: "Former British Army officer walks the entire length of the Nile. Adventure, resilience and the power of putting one foot in front of the other.",
    rating: 4.5,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Walking+the+Nile+Levison+Wood",
    coverUrl: "https://covers.openlibrary.org/b/id/8867756-M.jpg"
  },
  {
    title: "The Body Keeps the Score",
    author: "Bessel van der Kolk",
    description: "Groundbreaking research on trauma and PTSD. Essential reading for understanding how the body stores trauma and pathways to recovery.",
    rating: 4.7,
    category: "Mental Health",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=The+Body+Keeps+the+Score+Bessel+van+der+Kolk",
    coverUrl: "https://covers.openlibrary.org/b/id/8315367-M.jpg"
  },
  {
    title: "Complex PTSD: From Surviving to Thriving",
    author: "Pete Walker",
    description: "Practical guide for recovering from complex trauma. Written by a therapist who is himself a survivor.",
    rating: 4.7,
    category: "Mental Health",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Complex+PTSD+From+Surviving+to+Thriving+Pete+Walker",
    coverUrl: "https://covers.openlibrary.org/b/id/9319615-M.jpg"
  },
  {
    title: "Painting the Sand",
    author: "Kim Hughes GC",
    description: "Bomb disposal in Helmand by a George Cross recipient. Terrifying, gripping and deeply human.",
    rating: 4.7,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Painting+the+Sand+Kim+Hughes",
    coverUrl: ""
  },
  {
    title: "Chickenhawk",
    author: "Robert Mason",
    description: "Helicopter pilot's raw memoir from Vietnam. One of the most vivid accounts of combat flying ever written.",
    rating: 4.7,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Chickenhawk+Robert+Mason",
    coverUrl: "https://covers.openlibrary.org/b/id/93944-M.jpg"
  },
  {
    title: "Man's Search for Meaning",
    author: "Viktor Frankl",
    description: "Holocaust survivor and psychiatrist on finding purpose through suffering. A life-changing read for anyone facing darkness.",
    rating: 4.7,
    category: "Mental Health",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Mans+Search+for+Meaning+Viktor+Frankl",
    coverUrl: "https://covers.openlibrary.org/b/id/8516506-M.jpg"
  },
  {
    title: "First Man In",
    author: "Ant Middleton",
    description: "Former SBS point man's take on leadership, fear and resilience. Direct, no-nonsense and motivating.",
    rating: 4.6,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=First+Man+In+Ant+Middleton",
    coverUrl: "https://covers.openlibrary.org/b/id/9168494-M.jpg"
  },
  {
    title: "Apache Dawn",
    author: "Damien Lewis",
    description: "British forces in Afghanistan — 3 Para's bloody battle for Helmand. Gripping and brutal.",
    rating: 4.5,
    category: "Military History",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Apache+Dawn+Damien+Lewis",
    coverUrl: "https://covers.openlibrary.org/b/id/11589739-M.jpg"
  },
  {
    title: "Walking with the Wounded",
    author: "Mark McCrum",
    description: "The inspiring story of wounded veterans who trekked to the North Pole. Incredible resilience and determination.",
    rating: 4.5,
    category: "Inspiration",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Walking+with+the+Wounded+Mark+McCrum",
    coverUrl: "https://covers.openlibrary.org/b/id/8195152-M.jpg"
  },
  {
    title: "The Unforgiving Minute",
    author: "Craig Mullaney",
    description: "A soldier's education from West Point to Afghanistan. Thoughtful, honest and deeply human.",
    rating: 4.6,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=The+Unforgiving+Minute+Craig+Mullaney",
    coverUrl: "https://covers.openlibrary.org/b/id/5665294-M.jpg"
  },
  {
    title: "Trauma Is Really Strange",
    author: "Steve Haines",
    description: "A short, illustrated guide to understanding trauma and how the body responds. Perfect introduction — not heavy reading.",
    rating: 4.6,
    category: "Mental Health",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/s?k=Trauma+Is+Really+Strange+Steve+Haines",
    coverUrl: "https://covers.openlibrary.org/b/id/13440430-M.jpg"
  },
  {
    title: "It Doesn't Have to Hurt to Work",
    author: "Dave Collins & Leigh Maybury",
    description: "Performance psychology from a former military psychologist. Practical tools for managing stress and building resilience.",
    rating: 4.5,
    category: "Mental Health",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/s?k=It+Doesnt+Have+to+Hurt+to+Work+Dave+Collins",
    coverUrl: ""
  },
  {
    title: "Wearing the Green Beret",
    author: "Robin Childs",
    description: "A Royal Marine Commando's journey. Honest account of service life, the bonds formed, and the challenges after.",
    rating: 4.5,
    category: "Memoir",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/s?k=Wearing+the+Green+Beret+Robin+Childs",
    coverUrl: ""
  },
  {
    title: "Soldier Box",
    author: "Joe Glenton",
    description: "A British soldier's story of refusing to return to Afghanistan. Controversial, brave, and thought-provoking.",
    rating: 4.3,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Soldier+Box+Joe+Glenton",
    coverUrl: ""
  },
  {
    title: "Losing the Plot",
    author: "Gail Hanlon",
    description: "Growing a garden to grow yourself. Therapeutic gardening for mental health — popular with veterans' allotment projects.",
    rating: 4.5,
    category: "Wellbeing",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/s?k=Losing+the+Plot+Gail+Hanlon",
    coverUrl: ""
  },
  {
    title: "East of Croydon",
    author: "Sue Perkins",
    description: "Not military — but a brilliant, funny memoir about identity and belonging. Sometimes you need a laugh. Good for carers too.",
    rating: 4.4,
    category: "Lighter Reads",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=East+of+Croydon+Sue+Perkins",
    coverUrl: "https://covers.openlibrary.org/b/id/10187926-M.jpg"
  },
  {
    title: "The Complete Guide to Veterans' Benefits",
    author: "Bruce Brown",
    description: "Comprehensive guide to understanding and claiming all the benefits and support you're entitled to.",
    rating: 4.4,
    category: "Practical",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/s?k=Complete+Guide+Veterans+Benefits+Bruce+Brown",
    coverUrl: "https://covers.openlibrary.org/b/id/12550227-M.jpg"
  },
  {
    title: "Danger Close",
    author: "Stuart Tootal",
    description: "The true story of Helmand from the leader of 3 PARA. A commanding officer's gripping account of the brutal 2006 deployment to Afghanistan.",
    rating: 4.7,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Danger+Close+Stuart+Tootal",
    coverUrl: "https://covers.openlibrary.org/b/id/11759009-M.jpg"
  },
  {
    title: "Operation Mayhem",
    author: "Steve Heaney MC",
    description: "The first account of X Platoon's epic mission during a bloody civil war in Africa. Raw courage, elite forces, and a story that had to be told.",
    rating: 4.6,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Operation+Mayhem+Steve+Heaney",
    coverUrl: "https://covers.openlibrary.org/b/id/10436919-M.jpg"
  },
  {
    title: "Operation Telic",
    author: "Tim Ripley",
    description: "The definitive account of the British campaign in Iraq 2003-2009. Uncensored documents, SAS operations, and the real story of Basra.",
    rating: 4.5,
    category: "Military History",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/s?k=Operation+Telic+Tim+Ripley",
    coverUrl: ""
  },
  {
    title: "Charlie Four Kilo",
    author: "Rich Jones",
    description: "After events out of his control, a veteran finds himself in the criminal underworld. A true story of organised crime across Europe, life-threatening entanglements, and a 15-year prison sentence. Raw, honest, and gripping.",
    rating: 4.5,
    category: "Memoir",
    format: "both",
    amazonUrl: "https://www.amazon.co.uk/Charlie-Four-Kilo-Rich-Jones/dp/1800315414",
    coverUrl: ""
  },
  {
    title: "Conquering Dreams",
    author: "Hari Budha Magar MBE",
    description: "The autobiography of the first double above-knee amputee to summit Everest and complete the Seven Summits. A former Gurkha who lost both legs in Afghanistan and refused to stop climbing. Coming August 2026.",
    rating: 0,
    category: "Inspiration",
    format: "book",
    amazonUrl: "https://www.amazon.co.uk/s?k=Conquering+Dreams+Hari+Budha+Magar",
    coverUrl: ""
  },
];

interface SearchResult {
  title: string;
  author: string;
  year?: number;
  coverId?: number;
  isbn?: string;
}

const CATEGORIES = ['All', 'Memoir', 'Mental Health', 'Military History', 'Practical', 'Inspiration', 'Wellbeing', 'Lighter Reads'];

export default function RecommendedReads() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'book' | 'audiobook'>('all');

  // Live search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchBooks = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const encoded = encodeURIComponent(query.trim());
      const res = await fetch(`https://openlibrary.org/search.json?q=${encoded}&fields=title,author_name,first_publish_year,cover_i,isbn&limit=12`);
      const data = await res.json();
      const results: SearchResult[] = (data.docs || []).map((doc: any) => ({
        title: doc.title || 'Unknown Title',
        author: (doc.author_name || []).join(', ') || 'Unknown Author',
        year: doc.first_publish_year,
        coverId: doc.cover_i,
        isbn: doc.isbn?.[0],
      }));
      setSearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchInput = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    searchTimeout.current = setTimeout(() => searchBooks(text), 500);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const openAmazon = (title: string, author: string) => {
    const q = encodeURIComponent(`${title} ${author}`);
    Linking.openURL(`https://www.amazon.co.uk/s?k=${q}`);
  };

  const openWaterstones = (title: string, author: string) => {
    const q = encodeURIComponent(`${title} ${author}`);
    Linking.openURL(`https://www.waterstones.com/category/book/term/${q}`);
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

  const curatedBooks = useMemo(() => {
    return BOOKS.filter(book => {
      const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
      const matchesFormat = selectedFormat === 'all' ||
        (selectedFormat === 'audiobook' ? (book.format === 'audiobook' || book.format === 'both') : true);
      return matchesCategory && matchesFormat;
    });
  }, [selectedCategory, selectedFormat]);

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
            placeholder="Search any book or audiobook..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchInput}
            returnKeyType="search"
            onSubmitEditing={() => searchBooks(searchQuery)}
            data-testid="search-input"
          />
          {isSearching && <ActivityIndicator size="small" color="#b45309" />}
          {searchQuery.length > 0 && !isSearching && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {hasSearched && (
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.searchSectionTitle, { color: colors.text }]}>
              {isSearching ? 'Searching...' : `${searchResults.length} results found`}
            </Text>
            {searchResults.map((result, index) => (
              <View
                key={index}
                style={[styles.searchCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                data-testid={`search-result-${index}`}
              >
                <View style={styles.searchRow}>
                  {result.coverId ? (
                    <Image
                      source={{ uri: `https://covers.openlibrary.org/b/id/${result.coverId}-M.jpg` }}
                      style={styles.searchCover}
                    />
                  ) : (
                    <View style={[styles.searchCover, { backgroundColor: isDark ? '#374151' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="book" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.searchInfo}>
                    <Text style={[styles.searchTitle, { color: colors.text }]} numberOfLines={2}>{result.title}</Text>
                    <Text style={[styles.searchAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{result.author}</Text>
                    {result.year && <Text style={[styles.searchYear, { color: colors.textSecondary }]}>{result.year}</Text>}
                    <View style={styles.buyButtons}>
                      <TouchableOpacity
                        style={[styles.buyBtn, { backgroundColor: '#ff9900' }]}
                        onPress={() => openAmazon(result.title, result.author)}
                        data-testid={`buy-amazon-${index}`}
                      >
                        <Text style={styles.buyBtnText}>Amazon</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.buyBtn, { backgroundColor: '#1d3557' }]}
                        onPress={() => openWaterstones(result.title, result.author)}
                        data-testid={`buy-waterstones-${index}`}
                      >
                        <Text style={styles.buyBtnText}>Waterstones</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
            {!isSearching && searchResults.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                <Ionicons name="book-outline" size={36} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No results found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Try different keywords</Text>
              </View>
            )}
          </View>
        )}

        {/* Our Picks Section Title */}
        <Text style={[styles.picksTitle, { color: colors.text }]}>Our Picks</Text>

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
          {curatedBooks.length} {curatedBooks.length === 1 ? 'book' : 'books'}
        </Text>

        {/* Book Cards */}
        {curatedBooks.map((book, index) => {
          const badge = getFormatBadge(book.format);
          return (
            <View
              key={index}
              style={[styles.bookCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              data-testid={`book-card-${index}`}
            >
              <View style={styles.bookRow}>
                {book.coverUrl ? (
                  <Image
                    source={{ uri: book.coverUrl }}
                    style={styles.bookCover}
                  />
                ) : (
                  <View style={[styles.bookCover, { backgroundColor: isDark ? '#374151' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="book" size={28} color={isDark ? '#6b7280' : '#9ca3af'} />
                  </View>
                )}
                <View style={styles.bookInfo}>
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

                  <Text style={[styles.bookDesc, { color: colors.textSecondary }]} numberOfLines={3}>{book.description}</Text>

                  <View style={styles.bookFooter}>
                    <View style={styles.ratingRow}>
                      {book.rating > 0 ? (
                        <>
                          {renderStars(book.rating)}
                          <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{book.rating}</Text>
                        </>
                      ) : (
                        <Text style={[styles.ratingText, { color: '#b45309', fontStyle: 'italic' }]}>Coming soon</Text>
                      )}
                    </View>
                    <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(book.category) + '20' }]}>
                      <Text style={[styles.categoryTagText, { color: getCategoryColor(book.category) }]}>{book.category}</Text>
                    </View>
                  </View>

                  <View style={styles.buyButtons}>
                    <TouchableOpacity
                      style={[styles.buyBtn, { backgroundColor: '#ff9900' }]}
                      onPress={() => openAmazon(book.title, book.author)}
                    >
                      <Text style={styles.buyBtnText}>Amazon</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.buyBtn, { backgroundColor: '#1d3557' }]}
                      onPress={() => openWaterstones(book.title, book.author)}
                    >
                      <Text style={styles.buyBtnText}>Waterstones</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        {curatedBooks.length === 0 && (
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
  searchSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  searchCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  searchRow: { flexDirection: 'row', gap: 12 },
  searchCover: { width: 60, height: 90, borderRadius: 6, backgroundColor: '#e5e7eb' },
  searchInfo: { flex: 1 },
  searchTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  searchAuthor: { fontSize: 13, marginBottom: 2 },
  searchYear: { fontSize: 12, marginBottom: 6 },
  buyButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  buyBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  buyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  picksTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  formatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  formatChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6 },
  formatChipText: { fontSize: 13, fontWeight: '600' },
  categoryScroll: { marginBottom: 16 },
  categoryContainer: { gap: 8 },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  categoryPillText: { fontSize: 13, fontWeight: '600' },
  resultsCount: { fontSize: 13, marginBottom: 12 },
  bookCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  bookRow: { flexDirection: 'row', gap: 14 },
  bookCover: { width: 70, height: 105, borderRadius: 8, backgroundColor: '#e5e7eb' },
  bookInfo: { flex: 1 },
  bookHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
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
