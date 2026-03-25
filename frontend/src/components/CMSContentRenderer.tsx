import React from 'react';
import { View, Text, ActivityIndicator, useWindowDimensions, Linking, StyleSheet } from 'react-native';
import RenderHtml, { defaultSystemFonts } from 'react-native-render-html';
import { useTheme } from '../config/theme';

interface CMSContentRendererProps {
  content: string;
  isLoading: boolean;
  fallback?: React.ReactNode;
}

export function CMSContentRenderer({ content, isLoading, fallback }: CMSContentRendererProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary || '#3b82f6'} />
      </View>
    );
  }

  if (!content) {
    return fallback ? <>{fallback}</> : null;
  }

  const tagsStyles = {
    body: {
      color: colors.text || '#fff',
      fontSize: 15,
      lineHeight: 24,
    },
    h1: {
      color: colors.text || '#fff',
      fontSize: 24,
      fontWeight: '700' as const,
      marginTop: 20,
      marginBottom: 10,
    },
    h2: {
      color: colors.text || '#fff',
      fontSize: 20,
      fontWeight: '700' as const,
      marginTop: 18,
      marginBottom: 8,
    },
    h3: {
      color: colors.text || '#fff',
      fontSize: 17,
      fontWeight: '600' as const,
      marginTop: 14,
      marginBottom: 6,
    },
    p: {
      color: colors.text || '#fff',
      fontSize: 15,
      lineHeight: 24,
      marginBottom: 12,
    },
    a: {
      color: '#60a5fa',
      textDecorationLine: 'underline' as const,
    },
    strong: {
      fontWeight: '700' as const,
      color: colors.text || '#fff',
    },
    em: {
      fontStyle: 'italic' as const,
      color: colors.textSecondary || '#9ca3af',
    },
    li: {
      color: colors.text || '#fff',
      fontSize: 15,
      lineHeight: 24,
      marginBottom: 4,
    },
    ul: {
      marginBottom: 12,
      paddingLeft: 8,
    },
    ol: {
      marginBottom: 12,
      paddingLeft: 8,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: '#f59e0b',
      paddingLeft: 14,
      marginVertical: 12,
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderRadius: 6,
      paddingVertical: 10,
      paddingRight: 10,
    },
    img: {
      borderRadius: 8,
      marginVertical: 10,
    },
  };

  const renderersProps = {
    a: {
      onPress: (_: any, href: string) => {
        if (href) Linking.openURL(href);
      },
    },
  };

  return (
    <View style={styles.container}>
      <RenderHtml
        contentWidth={width - 40}
        source={{ html: content }}
        tagsStyles={tagsStyles}
        renderersProps={renderersProps}
        systemFonts={[...defaultSystemFonts]}
        enableExperimentalMarginCollapsing={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
});
