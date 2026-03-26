import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface CMSBlock {
  type: string;
  props: Record<string, any>;
}

interface CMSBlockRendererProps {
  blocks: CMSBlock[];
  isLoading: boolean;
}

export function CMSBlockRenderer({ blocks, isLoading }: CMSBlockRendererProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.primary || '#3b82f6'} />
      </View>
    );
  }

  if (!blocks || blocks.length === 0) return null;

  return (
    <View>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return <HeadingBlock key={index} text={block.props?.text} colors={colors} />;
          case 'paragraph':
            return <ParagraphBlock key={index} text={block.props?.text} colors={colors} />;
          case 'callout':
            return <CalloutBlock key={index} text={block.props?.text} icon={block.props?.icon} iconColor={block.props?.iconColor} colors={colors} isDark={isDark} />;
          case 'bullet_list':
            return <BulletListBlock key={index} items={block.props?.items} colors={colors} />;
          case 'support_card':
            return <SupportCardBlock key={index} {...block.props} colors={colors} isDark={isDark} />;
          case 'chat_banner':
            return <ChatBannerBlock key={index} persona={block.props?.persona} colors={colors} router={router} />;
          case 'image':
            return <ImageBlock key={index} url={block.props?.url} alt={block.props?.alt} />;
          case 'crisis_footer':
            return <CrisisFooterBlock key={index} colors={colors} isDark={isDark} router={router} />;
          case 'divider':
            return <DividerBlock key={index} colors={colors} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

function HeadingBlock({ text, colors }: { text: string; colors: any }) {
  if (!text) return null;
  return <Text style={[styles.heading, { color: colors.text }]}>{text}</Text>;
}

function ParagraphBlock({ text, colors }: { text: string; colors: any }) {
  if (!text) return null;
  return <Text style={[styles.paragraph, { color: colors.textSecondary }]}>{text}</Text>;
}

// Map Lucide icon names (from CMS editor) to Ionicons names (for mobile)
const ICON_MAP: Record<string, string> = {
  'message-circle': 'chatbubble-outline',
  'activity': 'pulse-outline',
  'heart': 'heart-outline',
  'heart-pulse': 'fitness-outline',
  'shield': 'shield-outline',
  'home': 'home-outline',
  'users': 'people-outline',
  'book-open': 'book-outline',
  'brain': 'fitness-outline',
  'wallet': 'wallet-outline',
  'scale': 'barbell-outline',
  'stethoscope': 'medkit-outline',
  'star': 'star-outline',
  'zap': 'flash-outline',
  'flame': 'flame-outline',
  'eye': 'eye-outline',
  'clock': 'time-outline',
  'flag': 'flag-outline',
  'target': 'locate-outline',
  'compass': 'compass-outline',
  'globe': 'globe-outline',
  'leaf': 'leaf-outline',
  'phone': 'call-outline',
  'alert-triangle': 'warning-outline',
  'award': 'ribbon-outline',
  'swords': 'shield-outline',
  'anchor': 'boat-outline',
  'coffee': 'cafe-outline',
};

function CalloutBlock({ text, icon, iconColor, colors, isDark }: { text: string; icon?: string; iconColor?: string; colors: any; isDark: boolean }) {
  if (!text) return null;
  const parts = text.split(' \u2014 ');
  const hasTitle = parts.length > 1;
  const ionIconName = icon ? (ICON_MAP[icon] || 'chatbubble-outline') : null;
  const color = iconColor || '#0d9488';

  return (
    <View style={[styles.callout, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 0, borderWidth: 1 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {ionIconName && (
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: color + '20', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name={ionIconName as any} size={22} color={color} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          {hasTitle ? (
            <>
              <Text style={[styles.calloutTitle, { color: colors.text }]}>{parts[0]}</Text>
              <Text style={[styles.calloutText, { color: colors.textSecondary }]}>{parts.slice(1).join(' \u2014 ')}</Text>
            </>
          ) : (
            <Text style={[styles.calloutText, { color: colors.textSecondary }]}>{text}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function BulletListBlock({ items, colors }: { items: string[]; colors: any }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <Text style={[styles.bulletDot, { color: colors.primary || '#3b82f6' }]}>{'\u2022'}</Text>
          <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  'Carer Support': { bg: '#dbeafe', text: '#3b82f6' },
  'Financial': { bg: '#d1fae5', text: '#059669' },
  'Practical': { bg: '#d1fae5', text: '#10b981' },
  'Mental Health': { bg: '#ede9fe', text: '#8b5cf6' },
  'Respite': { bg: '#fef3c7', text: '#f59e0b' },
};

function ImageBlock({ url, alt }: { url: string; alt?: string }) {
  if (!url) return null;
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  return (
    <View style={{ marginBottom: 16 }}>
      <Image source={{ uri: fullUrl }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" accessibilityLabel={alt || 'Page image'} />
    </View>
  );
}

function SupportCardBlock({ title, description, phone, url, tag, colors, isDark }: any) {
  if (!title) return null;
  const tagColor = tag ? TAG_COLORS[tag] || { bg: '#f3f4f6', text: '#6b7280' } : null;

  return (
    <View style={[styles.supportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[styles.supportTitle, { color: colors.text, flex: 1 }]}>{title}</Text>
        {tag && tagColor && (
          <View style={[styles.tag, { backgroundColor: isDark ? tagColor.text + '20' : tagColor.bg }]}>
            <Text style={[styles.tagText, { color: tagColor.text }]}>{tag}</Text>
          </View>
        )}
      </View>
      {description ? <Text style={[styles.supportDesc, { color: colors.textSecondary }]}>{description}</Text> : null}
      <View style={styles.supportActions}>
        {phone ? (
          <TouchableOpacity
            style={styles.phoneButton}
            onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
          >
            <Ionicons name="call" size={15} color="#059669" />
            <Text style={styles.phoneText}>{phone}</Text>
          </TouchableOpacity>
        ) : null}
        {url ? (
          <TouchableOpacity
            style={styles.urlButton}
            onPress={() => Linking.openURL(url)}
          >
            <Ionicons name="open-outline" size={15} color="#3b82f6" />
            <Text style={styles.urlText}>Visit website</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const PERSONA_DATA: Record<string, { name: string; desc: string; color: string; avatar: string }> = {
  helen: { name: 'Helen', desc: 'Army wife for 20 years, cared for her husband with PTSD.', color: '#0d9488', avatar: '/images/helen.png' },
  tommy: { name: 'Tommy', desc: 'Lead Battle Buddy — general veteran support.', color: '#3b82f6', avatar: '/images/tommy.png' },
  rachel: { name: 'Rachel', desc: 'Criminal justice specialist.', color: '#f59e0b', avatar: '/images/rachel.png' },
  mo: { name: 'Mo', desc: 'Recovery support — prosthetics, rehab, chronic pain.', color: '#8b5cf6', avatar: '/images/mo.png' },
  reg: { name: 'Reg', desc: 'Serious illness — cancer, palliative care.', color: '#ef4444', avatar: '/images/reg.png' },
  dave: { name: 'Dave', desc: "Men's health — andropause, MST.", color: '#059669', avatar: '/images/dave.png' },
};

function ChatBannerBlock({ persona, colors, router }: { persona: string; colors: any; router: any }) {
  const data = PERSONA_DATA[persona];
  if (!data) return null;
  const chatRoute = persona === 'rachel' ? '/chat/doris' : `/chat/${persona}`;

  return (
    <TouchableOpacity
      style={[styles.chatBanner, { backgroundColor: colors.surface, borderColor: data.color }]}
      onPress={() => router.push(chatRoute)}
      activeOpacity={0.85}
      data-testid={`chat-${persona}-banner`}
    >
      <Image source={{ uri: data.avatar }} style={[styles.chatAvatar, { borderColor: data.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.chatName, { color: colors.text }]}>Talk to {data.name}</Text>
        <Text style={[styles.chatDesc, { color: colors.textSecondary }]}>{data.desc}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: data.color }]}>
        <Text style={styles.badgeText}>24/7</Text>
      </View>
    </TouchableOpacity>
  );
}

function CrisisFooterBlock({ colors, isDark, router }: { colors: any; isDark: boolean; router: any }) {
  return (
    <View style={[styles.crisisFooter, { backgroundColor: isDark ? '#1c1917' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fca5a5' }]}>
      <Text style={[styles.crisisTitle, { color: isDark ? '#fca5a5' : '#dc2626' }]}>In Crisis?</Text>
      <Text style={[styles.crisisText, { color: colors.textSecondary }]}>If you or someone you know is in immediate danger, please contact emergency services.</Text>
      <View style={styles.crisisNumbers}>
        <TouchableOpacity style={styles.crisisLine} onPress={() => Linking.openURL('tel:999')}>
          <Ionicons name="call" size={14} color="#dc2626" />
          <Text style={styles.crisisLineText}>999 (Emergency)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.crisisLine} onPress={() => Linking.openURL('tel:116123')}>
          <Ionicons name="call" size={14} color="#dc2626" />
          <Text style={styles.crisisLineText}>116 123 (Samaritans)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.crisisLine} onPress={() => Linking.openURL('tel:08001381111')}>
          <Ionicons name="call" size={14} color="#dc2626" />
          <Text style={styles.crisisLineText}>0800 138 1111 (Combat Stress)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DividerBlock({ colors }: { colors: any }) {
  return <View style={[styles.divider, { backgroundColor: colors.border || '#334155' }]} />;
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  paragraph: { fontSize: 15, lineHeight: 22, marginBottom: 16, textAlign: 'center' },
  callout: { borderLeftWidth: 4, borderRadius: 12, padding: 16, marginBottom: 12 },
  calloutTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  calloutText: { fontSize: 14, lineHeight: 20 },
  bulletList: { marginBottom: 16 },
  bulletItem: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  bulletDot: { fontSize: 18, lineHeight: 22, marginRight: 8 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22 },
  supportCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  supportTitle: { fontSize: 15, fontWeight: '700' },
  supportDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  supportActions: { flexDirection: 'row', gap: 16 },
  phoneButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 14, fontWeight: '600', color: '#059669' },
  urlButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  urlText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '700' },
  chatBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 2 },
  chatAvatar: { width: 52, height: 52, borderRadius: 26, marginRight: 12, borderWidth: 2 },
  chatName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  chatDesc: { fontSize: 13 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  crisisFooter: { borderRadius: 16, padding: 20, marginTop: 16, borderWidth: 1 },
  crisisTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  crisisText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  crisisNumbers: { gap: 8 },
  crisisLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crisisLineText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
  divider: { height: 1, marginVertical: 20, opacity: 0.3 },
});
