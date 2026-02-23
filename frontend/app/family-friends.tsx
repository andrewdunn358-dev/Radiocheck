import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput,
  Alert,
  Linking,
  Platform,
  Image,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { useCMSContent, getSection, CMSCard } from '../src/hooks/useCMSContent';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Fallback data (used when CMS is unavailable)
const FALLBACK_SIGNS_OF_CHANGE = [
  { id: 'isolation', label: 'Withdrawing from friends/family', icon: 'user-times' },
  { id: 'sleep', label: 'Sleeping more or less than usual', icon: 'bed' },
  { id: 'drinking', label: 'Drinking more than usual', icon: 'wine-bottle' },
  { id: 'anger', label: 'Increased anger or irritability', icon: 'angry' },
  { id: 'selfcare', label: 'Neglecting self-care', icon: 'shower' },
  { id: 'mood', label: 'Low mood or seeming hopeless', icon: 'cloud-rain' },
  { id: 'talking', label: 'Talking about being a burden', icon: 'comment-slash' },
  { id: 'reckless', label: 'Reckless behaviour', icon: 'exclamation-triangle' },
];

const FALLBACK_SUPPORT_RESOURCES = [
  { name: 'Op Courage', desc: 'NHS mental health service for serving personnel and veterans', phone: '0300 323 0137', url: 'https://www.nhs.uk/nhs-services/armed-forces-community/mental-health/veterans-reservists/' },
  { name: 'Combat Stress', desc: '24hr helpline for the armed forces community', phone: '0800 138 1619', url: 'https://combatstress.org.uk' },
  { name: 'SSAFA', desc: 'Armed Forces charity support', phone: '0800 260 6767', url: 'https://www.ssafa.org.uk' },
  { name: 'Royal British Legion', desc: 'Support for serving and ex-serving', phone: '0808 802 8080', url: 'https://www.britishlegion.org.uk' },
  { name: "Men's Sheds", desc: 'Community spaces for men', url: 'https://menssheds.org.uk' },
  { name: 'Samaritans', desc: '24/7 emotional support', phone: '116 123', url: 'https://www.samaritans.org' },
];

const FALLBACK_ADDICTION_RESOURCES = [
  { name: 'Tom Harrison House', desc: 'Residential rehab for armed forces personnel with addiction', phone: '0151 526 2109', url: 'https://www.tomharrisonhouse.org.uk' },
  { name: 'Change Grow Live', desc: 'Free drug & alcohol support', phone: '0808 802 9000', url: 'https://www.changegrowlive.org' },
  { name: 'Alcoholics Anonymous', desc: '24hr helpline for alcohol addiction', phone: '0800 917 7650', url: 'https://www.alcoholics-anonymous.org.uk' },
  { name: 'FRANK', desc: 'Friendly drug advice service', phone: '0300 123 6600', url: 'https://www.talktofrank.com' },
  { name: 'Drinkline', desc: 'National alcohol helpline', phone: '0300 123 1110', url: 'https://www.nhs.uk/live-well/alcohol-advice/alcohol-support/' },
  { name: 'We Are With You', desc: 'Free drug and alcohol support', url: 'https://www.wearewithyou.org.uk' },
];

const PRISON_RESOURCES = [
  { name: 'NACRO', desc: 'Support for people with criminal records', phone: '0300 123 1999', url: 'https://www.nacro.org.uk' },
  { name: 'Forces in Mind Trust', desc: 'Research on veterans in justice system', url: 'https://www.fim-trust.org' },
  { name: 'Walking With The Wounded', desc: 'Employment & justice support for the armed forces', url: 'https://walkingwiththewounded.org.uk' },
  { name: 'Project Nova', desc: 'Armed forces personnel in the criminal justice system', phone: '0800 917 7299', url: 'https://www.rfea.org.uk/our-programmes/project-nova/' },
  { name: 'Probation Services', desc: 'Support after prison release', phone: '0800 464 0708', url: 'https://www.gov.uk/guidance/probation-services' },
  { name: "Veterans' Gateway", desc: 'First point of contact for veterans', phone: '0808 802 1212', url: 'https://www.veteransgateway.org.uk' },
];

export default function FamilyFriends() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = createStyles(colors, isDark);
  const [view, setView] = useState<'main' | 'concern' | 'resources' | 'signs' | 'addiction' | 'prison'>('main');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Rita AI character state
  const [ritaCharacter, setRitaCharacter] = useState<{avatar: string; bio: string} | null>(null);
  const [loadingRita, setLoadingRita] = useState(true);
  
  // Fetch Rita's character info
  useEffect(() => {
    const fetchRita = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ai-buddies/characters`);
        if (res.ok) {
          const data = await res.json();
          const rita = data.characters?.find((c: any) => c.id === 'rita');
          if (rita) {
            setRitaCharacter({ avatar: rita.avatar, bio: rita.bio || '' });
          }
        }
      } catch (error) {
        console.error('Error fetching Rita:', error);
      } finally {
        setLoadingRita(false);
      }
    };
    fetchRita();
  }, []);
  
  // CMS Content - fetch support resources, addiction resources, and warning signs
  const { sections } = useCMSContent('family-friends');
  
  // Get CMS data or fall back to hardcoded
  const supportSection = getSection(sections, 'support_resources');
  const addictionSection = getSection(sections, 'addiction_resources');
  const signsSection = getSection(sections, 'warning_signs');
  
  // Map CMS cards to the format used in the component
  const SUPPORT_RESOURCES = supportSection?.cards?.length 
    ? supportSection.cards.map(c => ({ name: c.title, desc: c.description || '', phone: c.phone || '', url: c.external_url || '' }))
    : FALLBACK_SUPPORT_RESOURCES;
    
  const ADDICTION_RESOURCES = addictionSection?.cards?.length
    ? addictionSection.cards.map(c => ({ name: c.title, desc: c.description || '', phone: c.phone || '', url: c.external_url || '' }))
    : FALLBACK_ADDICTION_RESOURCES;
    
  const SIGNS_OF_CHANGE = signsSection?.cards?.length
    ? signsSection.cards.map((c, i) => ({ id: c.id || `sign-${i}`, label: c.title, icon: c.icon || 'alert' }))
    : FALLBACK_SIGNS_OF_CHANGE;
  
  // Form state
  const [yourName, setYourName] = useState('');
  const [yourEmail, setYourEmail] = useState('');
  const [yourPhone, setYourPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [veteranName, setVeteranName] = useState('');
  const [concerns, setConcerns] = useState('');
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [howLong, setHowLong] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [consentToContact, setConsentToContact] = useState(false);

  const toggleSign = (id: string) => {
    setSelectedSigns(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const submitConcern = async () => {
    if (!yourName.trim() || !relationship.trim() || !concerns.trim()) {
      Alert.alert('Required Fields', 'Please fill in your name, relationship, and your concerns.');
      return;
    }
    if (!yourEmail.trim() && !yourPhone.trim()) {
      Alert.alert('Contact Required', 'Please provide at least an email or phone number so we can follow up.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/concerns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          your_name: yourName.trim(),
          your_email: yourEmail.trim() || null,
          your_phone: yourPhone.trim() || null,
          relationship: relationship.trim(),
          veteran_name: veteranName.trim() || null,
          concerns: concerns.trim(),
          signs_noticed: selectedSigns,
          how_long: howLong.trim() || null,
          urgency,
          consent_to_contact: consentToContact,
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Thank You',
          'Your concern has been submitted. A member of our team will be in touch soon.\n\nIf this is an emergency, please call 999.',
          [{ text: 'OK', onPress: () => setView('main') }]
        );
        // Reset form
        setYourName(''); setYourEmail(''); setYourPhone('');
        setRelationship(''); setVeteranName(''); setConcerns('');
        setSelectedSigns([]); setHowLong(''); setUrgency('medium');
        setConsentToContact(false);
      } else {
        Alert.alert('Error', 'Failed to submit concern. Please try again or call us directly.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit concern. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => view === 'main' ? router.back() : setView('main')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Friends & Family</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main View */}
        {view === 'main' && (
          <>
            {/* Rita AI Chat Card - at the very top */}
            <TouchableOpacity 
              style={[styles.ritaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/ai-chat', params: { character: 'rita' } })}
              data-testid="rita-chat-card"
            >
              <View style={styles.ritaContent}>
                {ritaCharacter?.avatar ? (
                  <Image 
                    source={{ uri: ritaCharacter.avatar }} 
                    style={styles.ritaAvatar}
                  />
                ) : (
                  <View style={[styles.ritaAvatarPlaceholder, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                    {loadingRita ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <FontAwesome5 name="user" size={24} color="#64748b" />
                    )}
                  </View>
                )}
                <View style={styles.ritaInfo}>
                  <View style={styles.ritaHeader}>
                    <Text style={[styles.ritaName, { color: colors.text }]}>Talk to Rita</Text>
                    <View style={styles.ritaBadge}>
                      <FontAwesome5 name="comment-dots" size={10} color="#fff" />
                      <Text style={styles.ritaBadgeText}>AI Support</Text>
                    </View>
                  </View>
                  <Text style={[styles.ritaDesc, { color: colors.textSecondary }]}>
                    Family support companion for partners, spouses & loved ones of military personnel
                  </Text>
                  <Text style={[styles.ritaBio, { color: colors.textMuted || '#64748b' }]} numberOfLines={2}>
                    {ritaCharacter?.bio || "I've been around the military for a long time. I understand what families go through."}
                  </Text>
                </View>
              </View>
              <View style={styles.ritaAction}>
                <Text style={styles.ritaActionText}>Chat Now</Text>
                <FontAwesome5 name="arrow-right" size={12} color="#2563eb" />
              </View>
            </TouchableOpacity>

            {/* Intro Card */}
            <View style={[styles.introCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
              <FontAwesome5 name="hands-helping" size={40} color="#2563eb" />
              <Text style={[styles.introTitle, { color: colors.text }]}>Worried About Someone?</Text>
              <Text style={[styles.introText, { color: colors.textSecondary }]}>
                If you're concerned about a veteran or serving person in your life, you're not alone. 
                Recognising that someone needs support is the first step.
              </Text>
            </View>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => setView('concern')}>
              <View style={[styles.actionIcon, { backgroundColor: colors.background }]}>
                <FontAwesome5 name="exclamation-circle" size={24} color="#dc2626" />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Raise a Concern</Text>
                <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Let us know about your worries - we'll reach out to help</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => setView('signs')}>
              <View style={[styles.actionIcon, { backgroundColor: colors.background }]}>
                <FontAwesome5 name="search" size={24} color="#f59e0b" />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Signs to Look For</Text>
                <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Learn what changes might indicate someone needs support</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => setView('resources')}>
              <View style={[styles.actionIcon, { backgroundColor: colors.background }]}>
                <FontAwesome5 name="life-ring" size={24} color="#16a34a" />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Support Services</Text>
                <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>Op Courage, Combat Stress, Men's Sheds & more</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.tipCard}>
              <FontAwesome5 name="lightbulb" size={20} color="#f59e0b" />
              <Text style={styles.tipText}>
                <Text style={styles.tipBold}>Tip: </Text>
                Veterans often downplay their struggles or use humour to mask distress. 
                If something feels off, trust your instincts.
              </Text>
            </View>

            <View style={styles.emergencyCard}>
              <FontAwesome5 name="exclamation-triangle" size={20} color="#dc2626" />
              <Text style={styles.emergencyText}>
                If you believe someone is in immediate danger, call 999
              </Text>
            </View>
          </>
        )}

        {/* Raise a Concern Form */}
        {view === 'concern' && (
          <>
            <Text style={styles.sectionTitle}>Raise a Concern</Text>
            <Text style={styles.sectionSubtitle}>
              We'll treat this information confidentially and reach out to offer support.
            </Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Your Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                value={yourName}
                onChangeText={setYourName}
              />

              <Text style={styles.formLabel}>Your Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={yourEmail}
                onChangeText={setYourEmail}
                keyboardType="email-address"
              />

              <Text style={styles.formLabel}>Your Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Your phone number"
                value={yourPhone}
                onChangeText={setYourPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Your Relationship *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Spouse, Parent, Friend, Colleague"
                value={relationship}
                onChangeText={setRelationship}
              />

              <Text style={styles.formLabel}>Their Name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Name of person you're concerned about"
                value={veteranName}
                onChangeText={setVeteranName}
              />

              <Text style={styles.formLabel}>What are your concerns? *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what's worrying you..."
                value={concerns}
                onChangeText={setConcerns}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.formLabel}>Signs you've noticed</Text>
              <View style={styles.signsGrid}>
                {SIGNS_OF_CHANGE.map(sign => (
                  <TouchableOpacity
                    key={sign.id}
                    style={[styles.signChip, selectedSigns.includes(sign.id) && styles.signChipSelected]}
                    onPress={() => toggleSign(sign.id)}
                  >
                    <FontAwesome5 
                      name={sign.icon} 
                      size={14} 
                      color={selectedSigns.includes(sign.id) ? '#fff' : '#64748b'} 
                    />
                    <Text style={[styles.signChipText, selectedSigns.includes(sign.id) && styles.signChipTextSelected]}>
                      {sign.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>How long have you noticed these changes?</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. A few weeks, Several months"
                value={howLong}
                onChangeText={setHowLong}
              />

              <Text style={styles.formLabel}>How urgent is this?</Text>
              <View style={styles.urgencyButtons}>
                {['low', 'medium', 'high', 'urgent'].map(level => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.urgencyBtn, urgency === level && styles.urgencyBtnSelected]}
                    onPress={() => setUrgency(level)}
                  >
                    <Text style={[styles.urgencyBtnText, urgency === level && styles.urgencyBtnTextSelected]}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.checkboxRow}
                onPress={() => setConsentToContact(!consentToContact)}
              >
                <View style={[styles.checkbox, consentToContact && styles.checkboxChecked]}>
                  {consentToContact && <FontAwesome5 name="check" size={12} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  The person I'm concerned about knows I'm reaching out
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={submitConcern}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Concern'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Signs to Look For */}
        {view === 'signs' && (
          <>
            <Text style={styles.sectionTitle}>Signs to Look For</Text>
            <Text style={styles.sectionSubtitle}>
              Changes in behaviour that might indicate someone is struggling.
            </Text>

            {SIGNS_OF_CHANGE.map(sign => (
              <View key={sign.id} style={styles.signCard}>
                <View style={styles.signIconContainer}>
                  <FontAwesome5 name={sign.icon} size={20} color="#2563eb" />
                </View>
                <Text style={styles.signLabel}>{sign.label}</Text>
              </View>
            ))}

            <View style={styles.additionalSignsCard}>
              <Text style={styles.additionalSignsTitle}>Also watch for:</Text>
              <Text style={styles.additionalSignsText}>• Dark humour about death or disappearing</Text>
              <Text style={styles.additionalSignsText}>• Giving away possessions</Text>
              <Text style={styles.additionalSignsText}>• Saying goodbyes or "I won't be around"</Text>
              <Text style={styles.additionalSignsText}>• Increased risk-taking or recklessness</Text>
              <Text style={styles.additionalSignsText}>• Talking about being a burden</Text>
              <Text style={styles.additionalSignsText}>• Sudden calm after a period of distress</Text>
            </View>

            <View style={styles.tipCard}>
              <FontAwesome5 name="info-circle" size={20} color="#2563eb" />
              <Text style={styles.tipText}>
                Veterans often mask distress with humour or by saying "others had it worse". 
                Trust your instincts if something feels wrong.
              </Text>
            </View>
          </>
        )}

        {/* Support Resources */}
        {view === 'resources' && (
          <>
            <Text style={styles.sectionTitle}>Support Services</Text>
            <Text style={styles.sectionSubtitle}>
              Organisations that can help veterans and their families.
            </Text>

            {SUPPORT_RESOURCES.map((resource, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.resourceCard}
                onPress={() => resource.url && Linking.openURL(resource.url)}
              >
                <View style={styles.resourceContent}>
                  <Text style={styles.resourceName}>{resource.name}</Text>
                  <Text style={styles.resourceDesc}>{resource.desc}</Text>
                  {resource.phone && (
                    <TouchableOpacity 
                      style={styles.resourcePhone}
                      onPress={() => Linking.openURL(`tel:${resource.phone.replace(/\s/g, '')}`)}
                    >
                      <FontAwesome5 name="phone-alt" size={14} color="#16a34a" />
                      <Text style={styles.resourcePhoneText}>{resource.phone}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <FontAwesome5 name="external-link-alt" size={14} color="#94a3b8" />
              </TouchableOpacity>
            ))}

            <View style={styles.covenantCard}>
              <Text style={styles.covenantTitle}>Armed Forces Covenant</Text>
              <Text style={styles.covenantText}>
                The Covenant ensures that those who serve or have served, and their families, 
                are treated fairly. Your local council should have a Covenant lead who can help 
                with housing, healthcare, and support services.
              </Text>
              <TouchableOpacity 
                style={styles.covenantLink}
                onPress={() => Linking.openURL('https://www.armedforcescovenant.gov.uk')}
              >
                <Text style={styles.covenantLinkText}>Learn More</Text>
                <FontAwesome5 name="external-link-alt" size={12} color="#2563eb" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Addiction Support */}
        {view === 'addiction' && (
          <>
            <Text style={styles.sectionTitle}>Addictions Support</Text>
            <Text style={styles.sectionSubtitle}>
              Specialist help for serving personnel and veterans dealing with addiction - alcohol, drugs, gambling, and more.
            </Text>

            <View style={styles.infoCard}>
              <FontAwesome5 name="info-circle" size={18} color="#d97706" />
              <Text style={styles.infoText}>
                Many in the armed forces turn to alcohol, drugs, or gambling to cope with trauma, pain, or the transition to civilian life. 
                Seeking help is a sign of strength, not weakness.
              </Text>
            </View>

            {ADDICTION_RESOURCES.map((resource, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.resourceCard}
                onPress={() => resource.url && Linking.openURL(resource.url)}
              >
                <View style={styles.resourceContent}>
                  <Text style={styles.resourceName}>{resource.name}</Text>
                  <Text style={styles.resourceDesc}>{resource.desc}</Text>
                  {resource.phone && (
                    <TouchableOpacity 
                      style={styles.resourcePhone}
                      onPress={() => Linking.openURL(`tel:${resource.phone.replace(/\s/g, '')}`)}
                    >
                      <FontAwesome5 name="phone-alt" size={14} color="#16a34a" />
                      <Text style={styles.resourcePhoneText}>{resource.phone}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <FontAwesome5 name="external-link-alt" size={14} color="#94a3b8" />
              </TouchableOpacity>
            ))}

            <View style={styles.tipCard}>
              <FontAwesome5 name="lightbulb" size={20} color="#f59e0b" />
              <Text style={styles.tipText}>
                <Text style={styles.tipBold}>Tip: </Text>
                Tom Harrison House is the UK's only residential rehab specifically for veterans and emergency service workers.
              </Text>
            </View>
          </>
        )}

        {/* Prison & Criminal Justice Support */}
        {view === 'prison' && (
          <>
            <Text style={styles.sectionTitle}>Criminal Justice Support</Text>
            <Text style={styles.sectionSubtitle}>
              Help for veterans in the criminal justice system or recently released from prison.
            </Text>

            <View style={styles.infoCard}>
              <FontAwesome5 name="info-circle" size={18} color="#4f46e5" />
              <Text style={styles.infoText}>
                Serving personnel and veterans can face unique challenges with the law, often linked to untreated PTSD, substance misuse, 
                or difficulty adjusting to civilian life. Specialist support is available.
              </Text>
            </View>

            {PRISON_RESOURCES.map((resource, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.resourceCard}
                onPress={() => resource.url && Linking.openURL(resource.url)}
              >
                <View style={styles.resourceContent}>
                  <Text style={styles.resourceName}>{resource.name}</Text>
                  <Text style={styles.resourceDesc}>{resource.desc}</Text>
                  {resource.phone && (
                    <TouchableOpacity 
                      style={styles.resourcePhone}
                      onPress={() => Linking.openURL(`tel:${resource.phone.replace(/\s/g, '')}`)}
                    >
                      <FontAwesome5 name="phone-alt" size={14} color="#16a34a" />
                      <Text style={styles.resourcePhoneText}>{resource.phone}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <FontAwesome5 name="external-link-alt" size={14} color="#94a3b8" />
              </TouchableOpacity>
            ))}

            <View style={styles.tipCard}>
              <FontAwesome5 name="lightbulb" size={20} color="#f59e0b" />
              <Text style={styles.tipText}>
                <Text style={styles.tipBold}>Project Nova </Text>
                works specifically with veterans at every stage of the criminal justice system - from arrest to release.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Dynamic styles using theme colors
const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  content: { flex: 1, padding: 16 },
  
  // Intro Card
  introCard: {
    backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  introTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 16 },
  introText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  
  // Rita AI Card
  ritaCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2563eb',
    ...Platform.select({
      ios: { shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  ritaContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ritaAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#2563eb',
  },
  ritaAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2563eb',
  },
  ritaInfo: {
    flex: 1,
    marginLeft: 14,
  },
  ritaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ritaName: {
    fontSize: 18,
    fontWeight: '700',
  },
  ritaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  ritaBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  ritaDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  ritaBio: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  ritaAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDark ? '#334155' : '#e2e8f0',
  },
  ritaActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  
  // Action Cards
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 4 },
      android: { elevation: isDark ? 0 : 2 },
    }),
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: { flex: 1, marginLeft: 12 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  actionDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  
  // Tip Card
  tipCard: {
    backgroundColor: isDark ? '#451a03' : '#fef3c7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  tipText: { flex: 1, fontSize: 14, color: isDark ? '#fcd34d' : '#92400e', lineHeight: 20 },
  tipBold: { fontWeight: '700' },
  
  // Info Card (for addiction & prison sections)
  infoCard: {
    backgroundColor: isDark ? '#1e3a5f' : '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? '#3b82f6' : '#bae6fd',
  },
  infoText: { flex: 1, fontSize: 14, color: isDark ? '#93c5fd' : '#0369a1', lineHeight: 20 },
  
  // Emergency Card
  emergencyCard: {
    backgroundColor: isDark ? '#450a0a' : '#fee2e2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  emergencyText: { flex: 1, fontSize: 14, color: isDark ? '#fca5a5' : '#dc2626', fontWeight: '600' },
  
  // Section Headers
  sectionTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 8 },
  sectionSubtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 20, lineHeight: 22 },
  
  // Form
  formSection: { marginBottom: 20 },
  formLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  
  // Signs Grid
  signsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  signChipSelected: { backgroundColor: '#2563eb' },
  signChipText: { fontSize: 13, color: colors.textSecondary },
  signChipTextSelected: { color: '#fff' },
  
  // Urgency Buttons
  urgencyButtons: { flexDirection: 'row', gap: 8 },
  urgencyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    alignItems: 'center',
  },
  urgencyBtnSelected: { backgroundColor: '#2563eb' },
  urgencyBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  urgencyBtnTextSelected: { color: '#fff' },
  
  // Checkbox
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
  
  // Submit Button
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: { backgroundColor: '#94a3b8' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Sign Cards (for Signs view)
  signCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
  },
  signIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signLabel: { flex: 1, fontSize: 15, color: colors.text },
  
  additionalSignsCard: {
    backgroundColor: isDark ? '#451a03' : '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  additionalSignsTitle: { fontSize: 16, fontWeight: '600', color: isDark ? '#fcd34d' : '#92400e', marginBottom: 8 },
  additionalSignsText: { fontSize: 14, color: isDark ? '#fcd34d' : '#92400e', marginBottom: 4 },
  
  // Resource Cards
  resourceCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
  },
  resourceContent: { flex: 1 },
  resourceName: { fontSize: 16, fontWeight: '600', color: colors.text },
  resourceDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  resourcePhone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  resourcePhoneText: { fontSize: 14, color: '#16a34a', fontWeight: '600' },
  
  // Covenant Card
  covenantCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 20,
    marginTop: 12,
  },
  covenantTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  covenantText: { fontSize: 14, color: '#b0c4de', lineHeight: 20 },
  covenantLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  covenantLinkText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
});
