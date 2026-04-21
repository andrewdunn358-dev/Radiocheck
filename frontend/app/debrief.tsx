import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import { API_URL } from '../src/config/api';

const PERSONAS = [
  'Tommy','Grace','Bob','Frankie','Margie','Megan','Rachel','Finch',
  'Penny','Jack','Rita','Sam','Helen','Alex','Kofi','James',
  'Catherine','Dave','Baz','Mo','Reg'
];

const RatingScale = ({ value, onChange, max = 5, labels }: { value: number | null, onChange: (v: number) => void, max?: number, labels?: [string, string] }) => {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {Array.from({ length: max }, (_, i) => i + (max === 10 ? 0 : 1)).map(n => (
          <TouchableOpacity
            key={n}
            data-testid={`rating-${n}`}
            onPress={() => onChange(n)}
            style={{
              width: max > 5 ? 32 : 40, height: max > 5 ? 32 : 40,
              borderRadius: max > 5 ? 16 : 20,
              backgroundColor: value === n ? '#dc2626' : colors.surface,
              borderWidth: 1, borderColor: value === n ? '#dc2626' : colors.border,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ color: value === n ? '#fff' : colors.text, fontWeight: '600', fontSize: max > 5 ? 12 : 14 }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>{labels[0]}</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>{labels[1]}</Text>
        </View>
      )}
    </View>
  );
};

const Dropdown = ({ value, options, onChange, placeholder }: { value: string | null, options: string[], onChange: (v: string) => void, placeholder: string }) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 8 }}>
      <TouchableOpacity
        data-testid={`dropdown-${placeholder.toLowerCase().replace(/\s/g, '-')}`}
        onPress={() => setOpen(!open)}
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text style={{ color: value ? colors.text : colors.textMuted }}>{value || placeholder}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 4, maxHeight: 200 }}>
          <ScrollView nestedScrollEnabled>
            {options.map(opt => (
              <TouchableOpacity key={opt} onPress={() => { onChange(opt); setOpen(false); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: value === opt ? '#dc2626' : colors.text }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const MultiSelect = ({ selected, options, onChange }: { selected: string[], options: string[], onChange: (v: string[]) => void }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {options.map(opt => {
        const isSelected = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            data-testid={`persona-select-${opt.toLowerCase()}`}
            onPress={() => onChange(isSelected ? selected.filter(s => s !== opt) : [...selected, opt])}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: isSelected ? '#dc2626' : colors.surface, borderWidth: 1, borderColor: isSelected ? '#dc2626' : colors.border }}
          >
            <Text style={{ color: isSelected ? '#fff' : colors.text, fontSize: 13 }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default function Debrief() {
  const router = useRouter();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<Record<string, any>>({
    service_branch: null, service_length: null, time_since_service: null,
    how_heard: null, ease_of_navigation: null, first_impression: '', device_used: null,
    personas_used: [], conversation_natural: null, ai_understood: null,
    ai_response_wrong: null, ai_response_wrong_detail: '', ai_felt_like_talking_to: '',
    how_felt_after: '', ai_personality_fit: null,
    felt_safe: null, felt_private: null, crisis_overlay_experience: null,
    would_open_up: null, trust_with_sensitive: null,
    explored_support_pages: null, resources_useful: null, found_what_needed: '',
    would_use_again: null, would_recommend: null, net_promoter: null,
    what_done_well: '', what_improve: '', missing_feature: '', anything_else: '',
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/debrief/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setSubmitted(true);
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    content: { flex: 1, padding: 20, maxWidth: 700, alignSelf: 'center' as const, width: '100%' as const },
    sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: colors.text, marginBottom: 4 },
    sectionDesc: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
    question: { fontSize: 15, fontWeight: '600' as const, color: colors.text, marginTop: 20 },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text, marginTop: 8, fontSize: 14, minHeight: 44 },
    textArea: { minHeight: 80, textAlignVertical: 'top' as const },
    nav: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
    btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    progress: { height: 3, backgroundColor: colors.surface, marginHorizontal: 20 },
    progressBar: { height: 3, backgroundColor: '#dc2626', borderRadius: 2 },
  });

  const sections = ['About You', 'First Impressions', 'AI Companions', 'Safety & Trust', 'Support & Resources', 'Open Feedback'];

  if (submitted) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Ionicons name="checkmark-circle" size={64} color="#dc2626" />
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 16, textAlign: 'center' }}>Thank You</Text>
          <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            Your feedback will help us make Radio Check better for veterans who need it. Every response matters.
          </Text>
          <TouchableOpacity data-testid="debrief-back-home" onPress={() => router.push('/home')} style={[s.btn, { backgroundColor: '#dc2626', marginTop: 32 }]}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Back to Radio Check</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderSection = () => {
    switch (step) {
      case 0: return (<View>
        <Text style={s.sectionTitle}>About You</Text>
        <Text style={s.sectionDesc}>Completely anonymous. This just helps us understand who's using Radio Check.</Text>
        <Text style={s.question}>Which branch did you serve in?</Text>
        <Dropdown value={form.service_branch} placeholder="Select branch" onChange={v => set('service_branch', v)} options={['Army', 'Royal Navy', 'Royal Marines', 'Royal Air Force', 'Reserves', 'Prefer not to say']} />
        <Text style={s.question}>How long did you serve?</Text>
        <Dropdown value={form.service_length} placeholder="Select length" onChange={v => set('service_length', v)} options={['Less than 4 years', '4-8 years', '8-16 years', '16-22 years', '22+ years', 'Still serving', 'Prefer not to say']} />
        <Text style={s.question}>How long since you left service?</Text>
        <Dropdown value={form.time_since_service} placeholder="Select time" onChange={v => set('time_since_service', v)} options={['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10-20 years', '20+ years', 'Still serving', 'Prefer not to say']} />
      </View>);

      case 1: return (<View>
        <Text style={s.sectionTitle}>First Impressions</Text>
        <Text style={s.sectionDesc}>What was it like when you first used Radio Check?</Text>
        <Text style={s.question}>How did you hear about Radio Check?</Text>
        <Dropdown value={form.how_heard} placeholder="Select" onChange={v => set('how_heard', v)} options={['Word of mouth', 'Social media', 'Veterans organisation', 'Friend or family', 'GP or health professional', 'Search engine', 'Other']} />
        <Text style={s.question}>How easy was it to find your way around?</Text>
        <RatingScale value={form.ease_of_navigation} onChange={v => set('ease_of_navigation', v)} labels={['Very difficult', 'Very easy']} />
        <Text style={s.question}>What device did you use?</Text>
        <Dropdown value={form.device_used} placeholder="Select device" onChange={v => set('device_used', v)} options={['Mobile phone', 'Tablet', 'Laptop', 'Desktop computer']} />
        <Text style={s.question}>What was your first impression of Radio Check?</Text>
        <TextInput style={[s.input, s.textArea]} multiline placeholder="Tell us what you thought when you first opened the app..." placeholderTextColor={colors.textMuted} value={form.first_impression} onChangeText={v => set('first_impression', v)} />
      </View>);

      case 2: return (<View>
        <Text style={s.sectionTitle}>AI Companions</Text>
        <Text style={s.sectionDesc}>About your experience talking to the AI personas.</Text>
        <Text style={s.question}>Which AI persona(s) did you talk to?</Text>
        <MultiSelect selected={form.personas_used} options={PERSONAS} onChange={v => set('personas_used', v)} />
        <Text style={s.question}>How natural did the conversation feel?</Text>
        <RatingScale value={form.conversation_natural} onChange={v => set('conversation_natural', v)} labels={['Not at all', 'Very natural']} />
        <Text style={s.question}>Did the AI feel like it understood what you were saying?</Text>
        <RatingScale value={form.ai_understood} onChange={v => set('ai_understood', v)} labels={['Not at all', 'Completely']} />
        <Text style={s.question}>Did the AI personality feel like a good fit?</Text>
        <RatingScale value={form.ai_personality_fit} onChange={v => set('ai_personality_fit', v)} labels={['Poor fit', 'Perfect fit']} />
        <Text style={s.question}>Was there a moment where an AI response felt wrong or off?</Text>
        <Dropdown value={form.ai_response_wrong} placeholder="Select" onChange={v => set('ai_response_wrong', v)} options={['Yes', 'No', 'Not sure']} />
        {form.ai_response_wrong === 'Yes' && (
          <>
            <Text style={[s.question, { fontSize: 13 }]}>Can you describe what happened?</Text>
            <TextInput style={[s.input, s.textArea]} multiline placeholder="What did the AI say that felt wrong?" placeholderTextColor={colors.textMuted} value={form.ai_response_wrong_detail} onChangeText={v => set('ai_response_wrong_detail', v)} />
          </>
        )}
        <Text style={s.question}>What did talking to the AI feel like? (e.g. "like talking to a mate", "like a chatbot", "surprisingly real")</Text>
        <TextInput style={[s.input, s.textArea]} multiline placeholder="Describe the experience in your own words..." placeholderTextColor={colors.textMuted} value={form.ai_felt_like_talking_to} onChangeText={v => set('ai_felt_like_talking_to', v)} />
        <Text style={s.question}>How did you feel after the conversation?</Text>
        <TextInput style={[s.input, s.textArea]} multiline placeholder="Better, worse, the same? Anything you noticed..." placeholderTextColor={colors.textMuted} value={form.how_felt_after} onChangeText={v => set('how_felt_after', v)} />
      </View>);

      case 3: return (<View>
        <Text style={s.sectionTitle}>Safety & Trust</Text>
        <Text style={s.sectionDesc}>How safe and private did the platform feel?</Text>
        <Text style={s.question}>Did you feel safe using Radio Check?</Text>
        <RatingScale value={form.felt_safe} onChange={v => set('felt_safe', v)} labels={['Not at all', 'Completely safe']} />
        <Text style={s.question}>Did you feel your conversations were private?</Text>
        <RatingScale value={form.felt_private} onChange={v => set('felt_private', v)} labels={['Not at all', 'Completely private']} />
        <Text style={s.question}>Would you feel comfortable opening up about something personal?</Text>
        <RatingScale value={form.would_open_up} onChange={v => set('would_open_up', v)} labels={['Not at all', 'Definitely']} />
        <Text style={s.question}>Would you trust Radio Check with sensitive topics?</Text>
        <RatingScale value={form.trust_with_sensitive} onChange={v => set('trust_with_sensitive', v)} labels={['Not at all', 'Completely']} />
        <Text style={s.question}>If a crisis support overlay appeared, how did you find it?</Text>
        <Dropdown value={form.crisis_overlay_experience} placeholder="Select" onChange={v => set('crisis_overlay_experience', v)} options={['Helpful — I was glad it appeared', 'Intrusive — it interrupted the conversation', 'It appeared but I didn\'t need it', 'I didn\'t see one', 'Prefer not to say']} />
      </View>);

      case 4: return (<View>
        <Text style={s.sectionTitle}>Support & Resources</Text>
        <Text style={s.sectionDesc}>About the resources and support pages on Radio Check.</Text>
        <Text style={s.question}>Did you explore any of the support pages (benefits, housing, crisis, etc.)?</Text>
        <Dropdown value={form.explored_support_pages} placeholder="Select" onChange={v => set('explored_support_pages', v)} options={['Yes, several', 'Yes, one or two', 'No, I stuck with the AI chat', 'I didn\'t know they were there']} />
        <Text style={s.question}>Were the resources relevant and useful?</Text>
        <RatingScale value={form.resources_useful} onChange={v => set('resources_useful', v)} labels={['Not useful', 'Very useful']} />
        <Text style={s.question}>Did you find what you were looking for?</Text>
        <TextInput style={s.input} placeholder="Yes / No / Partly — tell us more..." placeholderTextColor={colors.textMuted} value={form.found_what_needed} onChangeText={v => set('found_what_needed', v)} />
        <Text style={s.question}>Would you use Radio Check again?</Text>
        <Dropdown value={form.would_use_again} placeholder="Select" onChange={v => set('would_use_again', v)} options={['Definitely', 'Probably', 'Unsure', 'Probably not', 'Definitely not']} />
        <Text style={s.question}>Would you recommend Radio Check to another veteran?</Text>
        <RatingScale value={form.would_recommend} onChange={v => set('would_recommend', v)} labels={['Definitely not', 'Definitely']} />
        <Text style={s.question}>On a scale of 0-10, how likely are you to recommend Radio Check?</Text>
        <RatingScale value={form.net_promoter} onChange={v => set('net_promoter', v)} max={10} labels={['Not likely', 'Extremely likely']} />
      </View>);

      case 5: return (<View>
        <Text style={s.sectionTitle}>Open Feedback</Text>
        <Text style={s.sectionDesc}>Your honest thoughts. This is the most valuable part.</Text>
        <Text style={s.question}>What did Radio Check do well?</Text>
        <TextInput style={[s.input, s.textArea]} multiline placeholder="What worked, what stood out, what surprised you..." placeholderTextColor={colors.textMuted} value={form.what_done_well} onChangeText={v => set('what_done_well', v)} />
        <Text style={s.question}>What could be improved?</Text>
        <TextInput style={[s.input, s.textArea]} multiline placeholder="What frustrated you, what was missing, what felt off..." placeholderTextColor={colors.textMuted} value={form.what_improve} onChangeText={v => set('what_improve', v)} />
        <Text style={s.question}>Is there a feature or service you expected but didn't find?</Text>
        <TextInput style={[s.input, s.textArea]} multiline placeholder="Anything you looked for but couldn't find..." placeholderTextColor={colors.textMuted} value={form.missing_feature} onChangeText={v => set('missing_feature', v)} />
        <Text style={s.question}>Anything else you'd like to tell us?</Text>
        <TextInput style={[s.input, s.textArea]} multiline placeholder="Anything at all — good, bad, or in between..." placeholderTextColor={colors.textMuted} value={form.anything_else} onChangeText={v => set('anything_else', v)} />
      </View>);
    }
  };

  return (
    <SafeAreaView style={s.container} data-testid="debrief-page">
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Debrief</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{sections[step]} ({step + 1}/{sections.length})</Text>
        </View>
      </View>

      <View style={s.progress}>
        <View style={[s.progressBar, { width: `${((step + 1) / sections.length) * 100}%` }]} />
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {renderSection()}
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={s.nav}>
        {step > 0 ? (
          <TouchableOpacity data-testid="debrief-back" onPress={() => setStep(step - 1)} style={[s.btn, { backgroundColor: colors.surface }]}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
        ) : <View />}
        {step < sections.length - 1 ? (
          <TouchableOpacity data-testid="debrief-next" onPress={() => setStep(step + 1)} style={[s.btn, { backgroundColor: '#dc2626' }]}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity data-testid="debrief-submit" onPress={submit} disabled={submitting} style={[s.btn, { backgroundColor: submitting ? '#666' : '#dc2626' }]}>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>{submitting ? 'Submitting...' : 'Submit Feedback'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
