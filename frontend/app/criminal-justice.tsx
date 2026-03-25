import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { useCMSPage } from '../src/hooks/useCMSPage';
import { CMSContentRenderer } from '../src/components/CMSContentRenderer';

export default function CriminalJustice() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = createStyles(colors, isDark);
  const { content, isLoading } = useCMSPage('criminal-justice');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Criminal Justice</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <CMSContentRenderer content={content} isLoading={isLoading} />

        {/* Chat with Rachel — interactive, stays in TSX */}
        <TouchableOpacity 
          style={styles.chatBanner}
          onPress={() => router.push('/chat/doris')}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubbles" size={24} color="#f59e0b" />
          <View style={styles.chatBannerText}>
            <Text style={styles.chatBannerTitle}>Chat with Rachel</Text>
            <Text style={styles.chatBannerSub}>Criminal justice specialist</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  chatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1e293b' : '#fff7ed',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 12,
  },
  chatBannerText: {
    flex: 1,
  },
  chatBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  chatBannerSub: {
    fontSize: 13,
    color: isDark ? '#94a3b8' : '#78716c',
  },
});
