'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/admin-api';

const LOGO_URL = 'https://static.prod-images.emergentagent.com/jobs/99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/images/19f5131d6075cedaa7d8e2f56005fba0f0ef9bb4d9530fe80d4798a82456c218.png';
const HERO_IMG = 'https://customer-assets.emergentagent.com/job_99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/artifacts/681p6tax_WhatsApp%20Image%202026-04-22%20at%2011.35.55.jpeg';
const SITE_PASSWORD = 'bluelight2026';
const STORAGE_KEY = 'bls_conversations';
const MAX_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 15; // mirrors main app: last 15 messages sent to AI as context
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000;

interface Persona { id: string; name: string; role: string; color: string; avatar: string; desc: string; greeting: string; returningGreetings: string[]; }
interface Msg { role: 'user' | 'assistant'; text: string; ts: string; }

const PERSONAS: Persona[] = [
  {
    id: 'steve', name: 'Steve', role: 'Peer Support', color: '#0057B8',
    avatar: 'https://static.prod-images.emergentagent.com/jobs/99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/images/4576491eca3195744da6499172bdcf312d5fb21dd4be481ac8d9ba7bb4127e02.png',
    desc: "Retired copper, 25 years on the job. Straight-talking support from someone who's been there.",
    greeting: "Alright mate. I'm Steve — 25 years on the job, now retired. What's going on?",
    returningGreetings: [
      "Alright mate, back again. What's occurring?",
      "Ey up, good to see you. How's things since we last spoke?",
      "You're back. How've you been holding up?",
      "Alright mucker. Pick up where we left off or something new on your mind?",
    ],
  },
  {
    id: 'claire', name: 'Claire', role: 'Wellbeing Support', color: '#003078',
    avatar: 'https://static.prod-images.emergentagent.com/jobs/99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/images/f06b560a0e81c6ed1251844fba825a02507c6e776247c99e9dd6a7c642718a92.png',
    desc: 'Wellbeing practitioner, 15 years with emergency services. Understands the job and what it does to people.',
    greeting: "Hi, I'm Claire — I've spent 15 years working with officers. Whatever's on your mind, I've probably heard something like it before. What's going on?",
    returningGreetings: [
      "Good to see you back. How have things been since we spoke?",
      "Hi again. What's on your mind today?",
      "You're back — glad you came in. How are you doing?",
      "Hello again. Want to pick up where we left off, or start somewhere new?",
    ],
  },
];

const CRISIS = [
  { name: 'Emergency Services', phone: '999', desc: 'Immediate danger to life — police, fire, ambulance, coastguard.' },
  { name: 'Samaritans', phone: '116 123', desc: '24/7 free emotional support. Anonymous. Call any time, any reason.' },
  { name: 'Police Care UK', phone: '0300 012 0030', desc: 'National charity for serving & retired officers and families. Counselling, financial grants, trauma support.' },
  { name: 'Police Firearms Officers Association', phone: '0300 131 2789', desc: 'Post-incident and welfare support specifically for firearms officers and their families.' },
  { name: 'Oscar Kilo', url: 'https://oscarkilo.org.uk', desc: 'National Police Wellbeing Service — free resources, trauma support, and force wellbeing leads directory.' },
  { name: 'Mind Blue Light', url: 'https://www.mind.org.uk/news-campaigns/campaigns/blue-light-programme/', desc: 'Mental health charity programme dedicated to emergency services. Info line: 0300 303 5999.' },
  { name: 'Shout 85258', phone: '85258', desc: 'Free 24/7 text messaging support — text SHOUT to 85258 for confidential help.' },
];

const RESOURCES = [
  { name: 'Police Care UK', url: 'https://www.policecare.org.uk', desc: 'Charity offering counselling, financial grants, welfare breaks and carers support for officers, staff, volunteers and families.' },
  { name: 'Oscar Kilo', url: 'https://oscarkilo.org.uk', desc: 'National Police Wellbeing Service. Evidence-based resources, trauma support programmes, and force wellbeing leads.' },
  { name: 'Police Mutual', url: 'https://www.policemutual.co.uk', desc: 'Financial services & wellbeing: savings, insurance, debt help, Open Up wellbeing service — police community only.' },
  { name: 'Mind Blue Light', url: 'https://www.mind.org.uk/news-campaigns/campaigns/blue-light-programme/', desc: 'Dedicated mental health programme for emergency services. Peer support networks and workplace wellbeing training.' },
  { name: 'PFEW Welfare', url: 'https://polfed.org/support/', desc: 'Police Federation welfare support: misconduct/PSD guidance, legal, post-incident and member welfare services.' },
  { name: 'Police Treatment Centres', url: 'https://www.thepolicetreatmentcentres.org', desc: 'Residential physical rehabilitation and psychological wellbeing programmes. Subscribers and donations funded.' },
  { name: 'Flint House', url: 'https://www.flinthouse.co.uk', desc: 'Police rehabilitation charity offering residential physiotherapy and PTSD recovery. Free to serving officers.' },
  { name: 'NARPO', url: 'https://www.narpo.org', desc: 'National Association of Retired Police Officers — welfare, pensions, community and support after service.' },
  { name: 'Blue Light Together', url: 'https://bluelighttogether.org.uk', desc: 'Domestic abuse support designed for emergency services personnel and their families. Safe, understanding, specialist.' },
  { name: 'BackUp Buddy UK', url: 'https://backupbuddy.uk', desc: 'App-based wellbeing and PTSD support designed with emergency services — covers trauma, sleep, diet, exercise and more.' },
  { name: 'Thin Blue Line UK', url: 'https://www.thinbluelineuk.org.uk', desc: 'Charity founded and run by serving and retired officers — free confidential 24/7 mental health support for the police community.' },
  { name: 'UK COPS (Care of Police Survivors)', url: 'https://ukcops.org', desc: 'Supporting families of officers and staff who have died on duty — peer support, counselling (Winston\u2019s Wish for children, Red Arc for adults), respite, and remembrance.' },
  { name: 'Police Firearms Officers Association', url: 'https://www.pfoa.co.uk', desc: 'Post-incident and welfare support specifically for firearms officers and their families.' },
];

type Page = 'splash' | 'gate' | 'consent' | 'home' | 'chat' | 'crisis' | 'resources' | 'wellbeing' | 'wellbeing-topic' | 'callback' | 'privacy' | 'terms';

interface WellbeingTopic {
  id: string;
  title: string;
  tag: string;
  intro: string;
  tips: string[];
  signposts: { name: string; url?: string; phone?: string; note: string }[];
}

const WELLBEING: WellbeingTopic[] = [
  {
    id: 'grief',
    title: 'Grief & Bereavement',
    tag: 'When someone you love is gone',
    intro: "Grief in the job looks different. You might have held it together at the scene, at the funeral, at work — and then it ambushes you months later. That\u2019s not weakness. That\u2019s a nervous system that finally has space to feel it.",
    tips: [
      "Name what you\u2019re carrying — say it out loud to one person you trust, even if it\u2019s just \u201CI\u2019m not okay about this.\u201D",
      "Don\u2019t rush the timeline. There are no stages you have to pass through by a date.",
      "Anniversaries and reminders will hit. Plan for them — book leave, tell someone, have a ritual.",
      "Sleep, food and moving your body won\u2019t fix grief, but they keep you functional while it does its work.",
    ],
    signposts: [
      { name: 'Cruse Bereavement Support', phone: '0808 808 1677', note: 'Free confidential helpline, any bereavement.' },
      { name: 'UK COPS', url: 'https://ukcops.org', note: 'Specifically for families bereaved by on-duty death.' },
      { name: 'Samaritans', phone: '116 123', note: '24/7 — if the grief is taking you somewhere dark.' },
    ],
  },
  {
    id: 'trauma',
    title: 'Trauma & PTSD',
    tag: 'Scenes you can\u2019t unsee',
    intro: "Cumulative trauma is the one nobody warned you about in training. Single-event trauma sticks out, but for most officers it\u2019s the stack — fifteen years of RTAs, domestics, sudden deaths, children — that finally tips something over.",
    tips: [
      "Intrusive images, hypervigilance, irritability and numbness are normal responses to abnormal exposure. They\u2019re symptoms, not a character flaw.",
      "Alcohol numbs it tonight and makes it worse tomorrow. Every time.",
      "EMDR and trauma-focused CBT have the strongest evidence base — ask specifically for those, not generic counselling.",
      "A Police Federation or Oscar Kilo referral can bypass long NHS waiting lists and protect your confidentiality.",
    ],
    signposts: [
      { name: 'Police Care UK', phone: '0300 012 0030', note: 'Assessment + funded trauma-focused therapy.' },
      { name: 'Oscar Kilo', url: 'https://oscarkilo.org.uk', note: 'Trauma Impact Prevention Techniques (TIPT) programmes.' },
      { name: 'BackUp Buddy UK', url: 'https://backupbuddy.uk', note: 'App-based PTSD content written for the job.' },
    ],
  },
  {
    id: 'sleep',
    title: 'Sleep & Shift Work',
    tag: 'Switching the brain off',
    intro: "Shift patterns wreck circadian rhythms, and job adrenaline keeps you scanning long after the shift ends. \u201CJust being tired\u201D for years becomes a health problem.",
    tips: [
      "After nights, wear dark glasses on the drive home and black out the bedroom — you\u2019re tricking your brain it\u2019s night.",
      "Caffeine has a 6-hour half-life. A 2pm coffee is still in you at 8pm.",
      "If your mind races when your head hits the pillow, try \u201Cbrain-dump\u201D journaling for 5 minutes before bed — empty it on paper.",
      "Persistent insomnia over 3 months is treatable. CBT-I (sleep CBT) works better than sleeping tablets long-term.",
    ],
    signposts: [
      { name: 'Sleepstation', url: 'https://www.sleepstation.org.uk', note: 'NHS-partnered digital CBT-I — some forces fund it.' },
      { name: 'Oscar Kilo — Sleep', url: 'https://oscarkilo.org.uk', note: 'Shift-specific sleep hygiene guides.' },
    ],
  },
  {
    id: 'exercise',
    title: 'Movement & Exercise',
    tag: 'Why the gym actually helps',
    intro: "You don\u2019t need a bodybuilder split. Movement is one of the few things with real evidence for anxiety, depression, sleep and PTSD — and you can start from any baseline.",
    tips: [
      "Three 30-minute walks a week will move the needle on mood. Start there if everything else feels too much.",
      "Lifting heavy things 2\u20133 times a week protects joints, bone density and confidence through your 40s, 50s and 60s.",
      "Find something you\u2019ll actually do. Boxing, swimming, cycling, yoga, team sport — consistency beats intensity.",
      "If you\u2019re injured or rehabbing post-op, the Police Treatment Centres do residential programmes.",
    ],
    signposts: [
      { name: 'Police Treatment Centres', url: 'https://www.thepolicetreatmentcentres.org', note: 'Residential physical rehabilitation.' },
      { name: 'Flint House', url: 'https://www.flinthouse.co.uk', note: 'Police rehabilitation & physiotherapy — free to serving officers.' },
      { name: 'Couch to 5K', url: 'https://www.nhs.uk/live-well/exercise/running-and-aerobic-exercises/get-running-with-couch-to-5k/', note: 'Proven starter programme. 9 weeks.' },
    ],
  },
  {
    id: 'diet',
    title: 'Food & Nutrition',
    tag: 'Shift food and what to do about it',
    intro: "Refs room food, garage meal deals at 2am, three coffees to get through court. Nobody\u2019s asking you to eat like an athlete — but a few changes compound over a career.",
    tips: [
      "Front-load protein at breakfast (eggs, Greek yoghurt, porridge with nuts). Keeps you full through the shift and stops the 11am crash.",
      "On nights, eat your main meal before the shift, then small snacks through — not one huge 4am takeaway.",
      "Prep one thing on a rest day. Even a pot of chilli or soup beats deciding at 11pm.",
      "Alcohol is calorie-dense and wrecks sleep, appetite signals and mood for 2 days after. If you\u2019re tracking anything, track that.",
    ],
    signposts: [
      { name: 'NHS Better Health', url: 'https://www.nhs.uk/better-health/', note: 'Free weight, food and activity tools.' },
      { name: 'BackUp Buddy UK', url: 'https://backupbuddy.uk', note: 'Nutrition section written for shift workers.' },
    ],
  },
  {
    id: 'alcohol',
    title: 'Alcohol & Self-Medication',
    tag: 'The shift drink that becomes the daily drink',
    intro: "Drinking to come down from a shift is normal in the culture. That\u2019s the problem — it\u2019s normalised. No judgement here, just the straight science: alcohol is a short-acting depressant. It switches off the threat response for a few hours and then rebounds it higher.",
    tips: [
      "Count honestly for a week. Not for anyone else — for you. Most people under-count by about a third.",
      "Two alcohol-free days in a row gives your liver and sleep a chance to recover.",
      "If you can\u2019t sleep without it, that\u2019s the drink talking — not you. Get help before it gets worse.",
      "Cutting down is harder than stopping for some people. No shame in asking for proper support.",
    ],
    signposts: [
      { name: 'Drinkaware', url: 'https://www.drinkaware.co.uk', note: 'Self-assessment + unit tracker.' },
      { name: 'Police Care UK', phone: '0300 012 0030', note: 'Confidential assessment if alcohol is tied to the job.' },
      { name: 'NHS alcohol support', url: 'https://www.nhs.uk/live-well/alcohol-advice/', note: 'Local service finder.' },
    ],
  },
  {
    id: 'menopause',
    title: 'Menopause',
    tag: 'Serving through it, or living with someone who is',
    intro: "Policing through peri-menopause and menopause is brutal if nobody\u2019s named what\u2019s happening. Brain fog on a statement, rage at a custody sergeant who\u2019d normally just annoy you, night sweats on a nights rota, anxiety from nowhere. It\u2019s hormones, not breakdown.",
    tips: [
      "Symptoms can start 10+ years before periods stop. It\u2019s not \u201Ctoo early\u201D.",
      "HRT is safe for most women and, for many, life-changing. NICE guidance is clear — get a GP who\u2019s up to date.",
      "Stock basics: cool uniform layers, sleep-friendly kit, magnesium at bedtime, and honesty with your sergeant about shift adjustments if needed.",
      "Partners — the mood shifts are real, not personal. Read one thing on it. It helps.",
    ],
    signposts: [
      { name: 'Menopause in Policing', url: 'https://oscarkilo.org.uk', note: 'Oscar Kilo has a dedicated menopause toolkit.' },
      { name: 'Balance App', url: 'https://balance-app.com', note: 'Dr Louisa Newson\u2019s free symptom tracker — evidence-based.' },
      { name: 'Henpicked Menopause Hub', url: 'https://henpicked.net/menopause-hub/', note: 'Large free resource library.' },
    ],
  },
  {
    id: 'children',
    title: 'Child Wellbeing',
    tag: 'Kids of officers — and parenting after shift',
    intro: "Children of officers absorb more than they let on. The overheard phone calls, the kit at the door, the parent who sometimes comes home quiet. They don\u2019t need you to pretend the job doesn\u2019t exist — they need age-appropriate honesty and predictability.",
    tips: [
      "Protect rituals: one meal a day together, bedtime story, Saturday pancakes — whatever you can actually keep.",
      "When the job follows you home, name it (\u201Chad a hard shift, I\u2019m quiet tonight, it\u2019s not you\u201D). Kids fill silence with stories worse than the truth.",
      "Screens aren\u2019t the enemy, but 90 minutes before bed is. Hold the line there.",
      "If your child is struggling, schools have pastoral leads, and there are specialist services for emergency services families.",
    ],
    signposts: [
      { name: 'Winston\u2019s Wish', url: 'https://www.winstonswish.org', note: 'Bereavement support for children — partners of UK COPS.' },
      { name: 'Young Minds', url: 'https://www.youngminds.org.uk', note: 'Parents helpline: 0808 802 5544.' },
      { name: 'Blue Light Together', url: 'https://bluelighttogether.org.uk', note: 'Family-aware support if home life is hard.' },
    ],
  },
  {
    id: 'relationships',
    title: 'Relationships & Family',
    tag: 'Holding it together at home',
    intro: "Shift patterns, cancelled plans, black humour nobody else finds funny, coming home tight-jawed. The job is hard on partners and they\u2019re not always sure how to ask about it.",
    tips: [
      "Protect 20 minutes a day where neither of you is on a phone. That\u2019s the anchor.",
      "Your partner is not your debrief. They can hear some of it, but not all of it — that\u2019s what Steve and Claire, peer supporters and counsellors are for.",
      "Rows that keep happening in the same shape are usually about something older. Name it, don\u2019t just refight it.",
      "If things have got physical, controlling, or you\u2019re scared — Blue Light Together exists because this happens in emergency services too. Zero judgement.",
    ],
    signposts: [
      { name: 'Blue Light Together', url: 'https://bluelighttogether.org.uk', note: 'Specialist DA support for ES personnel.' },
      { name: 'Relate', url: 'https://www.relate.org.uk', note: 'Couples and individual counselling — sliding scale available.' },
    ],
  },
  {
    id: 'retirement',
    title: 'Retirement Transition',
    tag: 'From 999 to silence',
    intro: "You hand in the warrant card and the world gets quiet overnight. No radio, no banter, no purpose delivered in a shift rota. The cliff edge is real and it\u2019s the bit nobody prepares you for.",
    tips: [
      "Start talking about it 2 years before you go. Identity shift is slow work.",
      "Have something structured in the diary from week one — a course, volunteering, a part-time role. Unstructured time is the enemy.",
      "Keep one policing connection (NARPO branch, ex-colleagues WhatsApp). You don\u2019t have to leave the community.",
      "Pension, tax, new income streams — get independent financial advice, not just the force one.",
    ],
    signposts: [
      { name: 'NARPO', url: 'https://www.narpo.org', note: 'Retired officers\u2019 association — welfare, pensions, community.' },
      { name: 'Police Mutual', url: 'https://www.policemutual.co.uk', note: 'Financial planning for transition.' },
    ],
  },
  {
    id: 'finances',
    title: 'Money & Financial Pressure',
    tag: 'When the pay doesn\u2019t stretch',
    intro: "Real-terms pay cuts, shift allowance changes, childcare, housing. Financial stress is one of the biggest mental health loads on officers and it\u2019s the one people talk about least.",
    tips: [
      "Look at everything on one page for 20 minutes. Most of the dread is not knowing the actual numbers.",
      "Police Mutual and credit unions (like Serve & Protect) usually beat high-street rates and won\u2019t trigger credit problems.",
      "Debt is fixable. StepChange and Citizens Advice are free, confidential and won\u2019t judge.",
      "Police Care UK has welfare grants for officers in genuine financial crisis — applying is not a weakness.",
    ],
    signposts: [
      { name: 'StepChange', url: 'https://www.stepchange.org', note: 'Free debt advice. Confidential.' },
      { name: 'Police Mutual', url: 'https://www.policemutual.co.uk', note: 'Savings, loans, wellbeing — police only.' },
      { name: 'Serve & Protect Credit Union', url: 'https://serveandprotectcu.co.uk', note: 'Ethical loans & savings for police community.' },
      { name: 'Police Care UK grants', url: 'https://www.policecare.org.uk', note: 'Welfare grants for genuine hardship.' },
    ],
  },
  {
    id: 'hypervigilance',
    title: 'Hypervigilance & Switching Off',
    tag: 'Why you sit facing the door',
    intro: "Your nervous system learned to scan. That kept you safe at work. The problem is it doesn\u2019t stand down when you walk through your front door — and over years, that background alertness costs sleep, digestion, patience and joy.",
    tips: [
      "Slow breathing out for longer than in (e.g. in 4, out 6) for two minutes can switch the parasympathetic nervous system on. Do it in the car before you walk inside.",
      "Cold water on the face, wrists, or a cold shower activates the dive reflex and lowers heart rate fast.",
      "\u201COff-duty rituals\u201D help — change clothes immediately, a 10-minute walk, music in the car. You\u2019re signalling to your body that the shift is over.",
      "If it\u2019s constant, it\u2019s not a personality trait — it\u2019s a trauma response and it\u2019s treatable.",
    ],
    signposts: [
      { name: 'Oscar Kilo — Trauma', url: 'https://oscarkilo.org.uk', note: 'Resources and TIPT programmes.' },
      { name: 'Police Care UK', phone: '0300 012 0030', note: 'Assessment + funded therapy.' },
    ],
  },
];

// Local storage helpers
function loadConversations(): Record<string, Msg[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveConversations(data: Record<string, Msg[]>) {
  const trimmed: Record<string, Msg[]> = {};
  for (const [k, v] of Object.entries(data)) trimmed[k] = v.slice(-MAX_MESSAGES);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch {}
}

// Build the [RETURNING MATE...] context block the backend AI uses (mirrors frontend/app/chat/[characterId].tsx)
function buildConversationContext(history: Msg[], personaName: string): string {
  if (history.length === 0) return '';
  const recent = history.slice(-MAX_CONTEXT_MESSAGES);
  const transcript = recent.map(m => `${m.role === 'user' ? 'User' : personaName}: ${m.text}`).join('\n');
  return `\n\n[RETURNING MATE - You've chatted with this person before. Here's what you talked about last time:\n\n${transcript}\n\nTalk to them like an old mate you're catching up with. Be natural - maybe ask "how'd that thing go?" or "you still dealing with that?" based on what they told you. No formal "welcome back" rubbish - just pick up like mates do. If they mentioned something was bothering them, check in on it. Keep it relaxed and genuine.]`;
}

function pickReturningGreeting(p: Persona): string {
  return p.returningGreetings[Math.floor(Math.random() * p.returningGreetings.length)];
}

// Module-scoped so React doesn't remount it on every parent render (was causing input focus loss)
const DesktopShell = ({ children }: { children: React.ReactNode }) => (
  <>
    <style>{`
      .bls-desktop{min-height:100vh;background:#060e1a;display:flex;align-items:center;justify-content:center;gap:50px;padding:40px}
      .bls-brand{width:260px;flex-shrink:0}
      .bls-brand h2{font-size:26px;font-weight:800;color:#fff;margin:12px 0 6px}
      .bls-brand p{font-size:14px;color:#8b9dc3;line-height:1.5}
      .bls-feature{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:13px;color:#8b9dc3}
      .bls-feature-dot{width:8px;height:8px;border-radius:4px;background:#0057B8;flex-shrink:0}
      .bls-phone{width:430px;height:850px;border-radius:40px;border:6px solid #1a1a2e;box-shadow:0 0 60px rgba(0,87,184,0.2);overflow:hidden;display:flex;flex-direction:column;background:#0a1628;flex-shrink:0}
      .bls-phone-inner{flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative}
      .bls-right{width:220px;flex-shrink:0}
      .bls-right h3{font-size:17px;font-weight:700;color:#fff;margin-bottom:14px}
      .bls-emer{margin-bottom:12px}
      .bls-emer-label{font-size:11px;color:#8b9dc3}
      .bls-emer-num{font-size:15px;font-weight:600;color:#fff}
      .bls-emer-primary{border:2px solid #0057B8;border-radius:12px;padding:12px;margin-bottom:16px;background:#0d2a5e}
      .bls-emer-primary .bls-emer-num{color:#60a5fa;font-size:18px}
      .bls-hint{font-size:11px;color:#4a5568;margin-top:24px;line-height:1.5}
      @media(max-width:900px){.bls-brand,.bls-right{display:none}.bls-desktop{padding:0;gap:0}.bls-phone{width:100%;height:100vh;border-radius:0;border:none;box-shadow:none}}
    `}</style>
    <div className="bls-desktop">
      <div className="bls-brand">
        <img src={LOGO_URL} alt="" style={{ width: 60, height: 60, borderRadius: 12 }} />
        <h2>Blue Light Support</h2>
        <p>Confidential peer support for serving and retired police officers</p>
        <div style={{ marginTop: 20 }}>
          <div className="bls-feature"><div className="bls-feature-dot" />24/7 AI Support</div>
          <div className="bls-feature"><div className="bls-feature-dot" />Understands The Job</div>
          <div className="bls-feature"><div className="bls-feature-dot" />Completely Anonymous</div>
          <div className="bls-feature"><div className="bls-feature-dot" />Request Callbacks</div>
        </div>
      </div>
      <div className="bls-phone"><div className="bls-phone-inner">{children}</div></div>
      <div className="bls-right">
        <h3>Need Help Now?</h3>
        <div className="bls-emer-primary"><div className="bls-emer-label" style={{color:'#60a5fa',fontWeight:600}}>Police Care UK</div><div className="bls-emer-num">0300 012 0030</div><div className="bls-emer-label">Support for officers &amp; families</div></div>
        <div className="bls-emer"><div className="bls-emer-label">Samaritans</div><div className="bls-emer-num">116 123</div></div>
        <div className="bls-emer"><div className="bls-emer-label">Oscar Kilo</div><div className="bls-emer-num" style={{fontSize:13,color:'#60a5fa'}}>oscarkilo.org.uk</div></div>
        <div className="bls-emer"><div className="bls-emer-label">Mind Blue Light</div><div className="bls-emer-num" style={{fontSize:13,color:'#60a5fa'}}>mind.org.uk</div></div>
        <div className="bls-emer"><div className="bls-emer-label">Emergency</div><div className="bls-emer-num">999</div></div>
        <div className="bls-hint">Optimised for mobile.<br/>Use your phone for the best experience.</div>
      </div>
    </div>
  </>
);

export default function PolicePage() {
  const [page, setPage] = useState<Page>('splash');
  const [gateError, setGateError] = useState('');
  const [showGatePwd, setShowGatePwd] = useState(false);
  const [gateValue, setGateValue] = useState('');
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState('bls_' + Math.random().toString(36).substr(2, 12));
  const [cbSent, setCbSent] = useState(false);
  const [showSafeguardModal, setShowSafeguardModal] = useState(false);
  const [wellbeingTopic, setWellbeingTopic] = useState<WellbeingTopic | null>(null);
  // PWA install — Android/Chrome fires beforeinstallprompt; iOS Safari needs manual instructions.
  const [installPromptEvent, setInstallPromptEvent] = useState<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const msgEnd = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLInputElement>(null);
  const lastUserMsgTime = useRef<number>(Date.now());
  const inactivitySent = useRef<boolean>(false);
  const hasUserSent = useRef<boolean>(false);
  const pageRef = useRef<Page>(page);

  useEffect(() => { pageRef.current = page; }, [page]);

  // Android/browser back button: navigate within the app instead of leaving it.
  // Mirrors the in-app back arrow: wellbeing-topic -> wellbeing; anything else -> home.
  // On home/splash/gate/consent, back exits the page (expected Android behaviour).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SENTINEL = { __blsBack: true };
    window.history.pushState(SENTINEL, '', window.location.href);
    const onPop = () => {
      const current = pageRef.current;
      const rootPages: Page[] = ['splash', 'gate', 'consent', 'home'];
      if (rootPages.includes(current)) return; // let browser exit
      if (current === 'wellbeing-topic') setPage('wellbeing');
      else setPage('home');
      window.history.pushState(SENTINEL, '', window.location.href);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // PWA: register the service worker, listen for the install prompt event,
  // detect iOS (which has no programmatic install — Safari requires the
  // user to tap Share → Add to Home Screen manually) and detect whether
  // the app is already running standalone (i.e. previously installed).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register service worker. SW lives at /sw.js (root) so its max scope
    // is the origin; we restrict it to /police via the scope option so it
    // does not interfere with admin/staff routes on the same domain.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/police' })
        .catch(() => { /* registration failure is non-fatal */ });
    }

    // Detect iOS Safari (only path on iOS; Chrome on iOS shares the same engine).
    const ua = window.navigator.userAgent;
    const iosDetected = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(iosDetected);

    // Detect whether the app is already running standalone (installed).
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as unknown as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> });
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
      if (choice?.outcome === 'accepted') setIsInstalled(true);
    } else if (isIos) {
      setShowIosInstall(true);
    }
  };

  const canShowInstallButton = !isInstalled && (installPromptEvent !== null || isIos);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const unlocked = localStorage.getItem('bls_unlocked');
    const consent = localStorage.getItem('bls_consent');
    if (unlocked === 'true' && consent === 'true') setPage('home');
    else if (unlocked === 'true') setPage('consent');
    else setTimeout(() => setPage('gate'), 2000);
  }, []);

  // Inactivity check-in — mirrors main app 3-minute behaviour
  useEffect(() => {
    if (page !== 'chat') return;
    const interval = setInterval(() => {
      if (!hasUserSent.current || inactivitySent.current) return;
      if ((chatRef.current?.value || '').trim().length > 0) return;
      if (Date.now() - lastUserMsgTime.current >= INACTIVITY_TIMEOUT_MS) {
        inactivitySent.current = true;
        const checkIn: Msg = {
          role: 'assistant',
          text: persona.id === 'steve' ? "Still there, mate?" : "Still with me? No pressure — take your time.",
          ts: new Date().toISOString(),
        };
        setMessages(prev => {
          const updated = [...prev, checkIn];
          const stored = loadConversations();
          stored[persona.id] = updated;
          saveConversations(stored);
          return updated;
        });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [page, persona]);

  const handleGate = () => {
    const val = gateValue.trim();
    if (val === SITE_PASSWORD) { localStorage.setItem('bls_unlocked', 'true'); setPage('consent'); setGateError(''); setGateValue(''); }
    else { setGateError('Incorrect password'); setGateValue(''); }
  };

  const handleConsent = () => { localStorage.setItem('bls_consent', 'true'); setPage('home'); };

  const openChat = useCallback((p?: Persona) => {
    const selected = p || persona;
    if (p) setPersona(selected);
    const stored = loadConversations();
    const history = stored[selected.id] || [];
    if (history.length > 0) {
      // Show prior messages + a natural returning-user greeting (in-character)
      const returning: Msg = { role: 'assistant', text: pickReturningGreeting(selected), ts: new Date().toISOString() };
      setMessages([...history, returning]);
    } else {
      setMessages([{ role: 'assistant', text: selected.greeting, ts: new Date().toISOString() }]);
    }
    setSessionId('bls_' + Math.random().toString(36).substr(2, 12));
    hasUserSent.current = false;
    inactivitySent.current = false;
    lastUserMsgTime.current = Date.now();
    setPage('chat');
  }, [persona]);

  const send = async () => {
    const msg = chatRef.current?.value?.trim() || '';
    if (!msg || sending) return;
    if (chatRef.current) chatRef.current.value = '';
    hasUserSent.current = true;
    inactivitySent.current = false;
    lastUserMsgTime.current = Date.now();
    const userMsg: Msg = { role: 'user', text: msg, ts: new Date().toISOString() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setSending(true);
    try {
      // Build conversation context from stored history so AI actually remembers previous sessions
      const stored = loadConversations();
      const priorHistory = stored[persona.id] || [];
      const conversation_context = buildConversationContext(priorHistory, persona.name);

      const res = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          sessionId,
          character: persona.id,
          conversation_context,
        }),
      });
      const data = await res.json();
      const aiMsg: Msg = { role: 'assistant', text: data.reply || 'Sorry, something went wrong.', ts: new Date().toISOString() };
      const updated = [...newMsgs, aiMsg];
      setMessages(updated);

      // Safeguarding modal — mirrors main app behaviour
      if (data.safeguardingTriggered) {
        setShowSafeguardModal(true);
      }

      // Save to local storage
      const freshStored = loadConversations();
      freshStored[persona.id] = updated;
      saveConversations(freshStored);
    } catch {
      const errMsg: Msg = { role: 'assistant', text: 'Connection error. Please try again.', ts: new Date().toISOString() };
      setMessages(m => [...m, errMsg]);
    }
    setSending(false);
    setTimeout(() => chatRef.current?.focus(), 100);
  };

  const clearChat = () => {
    const fresh: Msg[] = [{ role: 'assistant', text: persona.greeting, ts: new Date().toISOString() }];
    setMessages(fresh);
    const stored = loadConversations();
    stored[persona.id] = fresh;
    saveConversations(stored);
    setSessionId('bls_' + Math.random().toString(36).substr(2, 12));
    hasUserSent.current = false;
    inactivitySent.current = false;
  };

  const submitCallback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fetch(`${API_URL}/api/callbacks`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') || undefined, request_type: 'counsellor', preferred_time: fd.get('time'), message: fd.get('message'), tenant: 'bluelight' }) });
      setCbSent(true);
    } catch { alert('Failed to submit.'); }
  };

  const goBack = () => setPage('home');

  const Header = ({ title, showBack, rightAction }: { title?: string; showBack?: boolean; rightAction?: React.ReactNode }) => (
    <div style={{ background: '#0d1b2e', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #1a2744', flexShrink: 0 }}>
      {showBack && <button data-testid="back-button" onClick={goBack} style={{ background: 'none', border: 'none', color: '#8b9dc3', cursor: 'pointer', fontSize: 20, padding: 0 }}>&#8592;</button>}
      <img src={persona.avatar || LOGO_URL} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover' }} />
      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title || 'Blue Light Support'}</div></div>
      {rightAction}
    </div>
  );

  const is = inputStyle;

  // Safeguarding modal — police-appropriate contacts only
  const SafeguardModal = () => !showSafeguardModal ? null : (
    <div data-testid="safeguard-modal" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d1b2e', border: '1px solid #243656', borderRadius: 16, padding: 18, maxWidth: 360, width: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>You&apos;re not on your own</div>
        <div style={{ fontSize: 12, color: '#8b9dc3', marginBottom: 14, lineHeight: 1.5 }}>A real person is available if you&apos;d rather talk. Everything below is confidential.</div>
        <a data-testid="safeguard-call-policecare" href="tel:03000120030" style={{ display: 'block', background: '#0057B8', color: '#fff', padding: 12, borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Call Police Care UK · 0300 012 0030</a>
        <a data-testid="safeguard-call-samaritans" href="tel:116123" style={{ display: 'block', background: '#243656', color: '#fff', padding: 12, borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Call Samaritans · 116 123</a>
        <a data-testid="safeguard-text-shout" href="sms:85258&body=SHOUT" style={{ display: 'block', background: '#243656', color: '#fff', padding: 12, borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>Text SHOUT to 85258</a>
        <button data-testid="safeguard-callback" onClick={() => { setShowSafeguardModal(false); setPage('callback'); }} style={{ display: 'block', width: '100%', background: 'transparent', border: '1px solid #243656', color: '#60a5fa', padding: 12, borderRadius: 10, fontWeight: 600, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>Request a callback</button>
        <a data-testid="safeguard-999" href="tel:999" style={{ display: 'block', background: '#7f1d1d', color: '#fff', padding: 12, borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 13, marginBottom: 10, textAlign: 'center' }}>In immediate danger — Call 999</a>
        <button data-testid="safeguard-dismiss" onClick={() => setShowSafeguardModal(false)} style={{ width: '100%', background: 'transparent', border: 'none', color: '#8b9dc3', fontSize: 12, cursor: 'pointer', padding: 6 }}>Keep chatting with {persona.name}</button>
      </div>
    </div>
  );

  // SPLASH
  if (page === 'splash') return (<DesktopShell><div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#0a1628,#0d2a5e)', padding: 40 }}><img src={HERO_IMG} alt="" style={{ width: 180, height: 180, borderRadius: 24, objectFit: 'cover', marginBottom: 24, boxShadow: '0 0 40px rgba(0,87,184,0.4)' }} /><div style={{ fontSize: 12, color: '#4a9eff', letterSpacing: 3, textTransform: 'uppercase' }}>Blue Light Support</div></div></DesktopShell>);

  // GATE
  if (page === 'gate') return (<DesktopShell><div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a1628', padding: 32 }}><img src={LOGO_URL} alt="" style={{ width: 72, height: 72, marginBottom: 20 }} /><div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Blue Light Support</div><div style={{ fontSize: 13, color: '#8b9dc3', marginBottom: 24, textAlign: 'center' }}>Beta testing. Enter your access code.</div>
    <div style={{ position: 'relative', width: '100%', maxWidth: 260, marginBottom: 12 }}>
      <input data-testid="gate-password-input" ref={gateRef} type={showGatePwd ? 'text' : 'password'} value={gateValue} onChange={e => setGateValue(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} onKeyDown={e => e.key === 'Enter' && handleGate()} placeholder="Access code" style={{ width: '100%', padding: '14px 56px 14px 14px', borderRadius: 12, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 15, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
      <button data-testid="gate-toggle-visibility" type="button" onClick={() => setShowGatePwd(v => !v)} aria-label={showGatePwd ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#8b9dc3', cursor: 'pointer', padding: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>{showGatePwd ? 'HIDE' : 'SHOW'}</button>
    </div>
    {gateError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{gateError}</div>}
    <button data-testid="gate-enter-button" onClick={handleGate} style={{ width: '100%', maxWidth: 260, padding: 14, borderRadius: 12, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Enter</button>
  </div></DesktopShell>);

  // CONSENT
  if (page === 'consent') return (<DesktopShell><div style={{ flex: 1, overflow: 'auto', background: '#0a1628', padding: 20 }}><div style={{ textAlign: 'center', marginBottom: 16 }}><img src={LOGO_URL} alt="" style={{ width: 48, height: 48, marginBottom: 8 }} /><div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Before You Begin</div></div>{[['This is a support tool, not an emergency service','If you are in immediate danger, call 999. This app provides peer support through AI companions.'],['Your conversations are private','Chats are stored on your device only. If our safety system detects crisis, support resources will be offered.'],['You are talking to AI companions','Steve and Claire are AI personas designed to understand police culture. They are not real people.']].map(([t,d],i)=>(<div key={i} style={{ background: '#1a2744', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #243656' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{t}</div><div style={{ fontSize: 12, color: '#8b9dc3', lineHeight: 1.5 }}>{d}</div></div>))}<div style={{ display: 'flex', gap: 8, justifyContent: 'center', fontSize: 12, marginTop: 4 }}><button onClick={() => setPage('privacy')} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: 12 }}>Privacy Policy</button><span style={{ color: '#4a5568' }}>|</span><button onClick={() => setPage('terms')} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: 12 }}>Terms</button></div><button data-testid="consent-accept-button" onClick={handleConsent} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 12 }}>I Understand — Continue</button></div></DesktopShell>);

  // PRIVACY
  if (page === 'privacy') return (<DesktopShell><Header title="Privacy Policy" showBack /><div style={{ flex: 1, overflow: 'auto', padding: 18, color: '#8b9dc3', fontSize: 13, lineHeight: 1.6 }}><h2 style={{ color: '#fff', fontSize: 17, marginBottom: 10 }}>Privacy Policy</h2><p>Blue Light Support is committed to protecting your privacy. No name, email, or identifying information is required.</p><h3 style={{ color: '#fff', fontSize: 14, marginTop: 14, marginBottom: 6 }}>What we collect</h3><p>Conversations are stored locally on your device so Steve and Claire can remember previous chats. Messages are also processed by our AI and safeguarding system. No personal identifiers are attached.</p><h3 style={{ color: '#fff', fontSize: 14, marginTop: 14, marginBottom: 6 }}>Safeguarding</h3><p>If our safety system detects crisis, support resources will be displayed. In cases of imminent risk, an anonymous alert may be created to welfare teams.</p><h3 style={{ color: '#fff', fontSize: 14, marginTop: 14, marginBottom: 6 }}>Your rights</h3><p>Tap &quot;New Chat&quot; inside any conversation to wipe its local memory. We do not sell or share your data.</p></div></DesktopShell>);

  // TERMS
  if (page === 'terms') return (<DesktopShell><Header title="Terms of Service" showBack /><div style={{ flex: 1, overflow: 'auto', padding: 18, color: '#8b9dc3', fontSize: 13, lineHeight: 1.6 }}><h2 style={{ color: '#fff', fontSize: 17, marginBottom: 10 }}>Terms of Service</h2><p>By using Blue Light Support you agree:</p><ul style={{ paddingLeft: 18, marginTop: 6 }}><li style={{ marginBottom: 6 }}>This is peer support, not medical or emergency service.</li><li style={{ marginBottom: 6 }}>AI companions are artificial intelligence — not real people.</li><li style={{ marginBottom: 6 }}>In an emergency, always call 999.</li><li style={{ marginBottom: 6 }}>We may modify the service during beta.</li></ul></div></DesktopShell>);

  // HOME
  if (page === 'home') return (<DesktopShell>
    <Header />
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}><img src={HERO_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.35)' }} /><div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, background: 'linear-gradient(transparent,#0a1628)' }}><div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>You protect everyone else.</div><div style={{ fontSize: 13, color: '#8b9dc3', marginTop: 2 }}>Who&apos;s got your back?</div></div></div>
      <div style={{ padding: '12px 14px 0' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Your Support Team</div>{PERSONAS.map(p => (<button data-testid={`persona-card-${p.id}`} key={p.id} onClick={() => openChat(p)} style={{ width: '100%', background: '#1a2744', border: '1px solid #243656', borderRadius: 14, padding: 14, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}><img src={p.avatar} alt={p.name} style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover', flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{p.name}</div><div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 1 }}>{p.role}</div><div style={{ fontSize: 11, color: '#8b9dc3' }}>{p.desc}</div></div><div style={{ color: '#4a9eff', fontSize: 18 }}>&#8250;</div></button>))}</div>
      <div style={{ padding: '4px 14px 0' }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{([['crisis','Crisis Support','Urgent contacts'],['wellbeing','Wellbeing Hub','Sleep, trauma, grief, family & more'],['resources','Resources','Police charities & wellbeing'],['callback','Request Callback','Speak to a real person'],['terms','About','Privacy & terms']] as const).map(([pg,label,sub]) => (<button data-testid={`nav-${pg}`} key={pg} onClick={() => setPage(pg as Page)} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 12, padding: 12, textAlign: 'left', cursor: 'pointer' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{label}</div><div style={{ fontSize: 10, color: '#8b9dc3', lineHeight: 1.3 }}>{sub}</div></button>))}</div></div>
      <div style={{ margin: '12px 14px', background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius: 12, padding: 14, textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>In an emergency, call 999</div></div>
      {canShowInstallButton && (
        <button data-testid="install-app-button" onClick={triggerInstall} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: 'calc(100% - 28px)', margin: '0 14px 14px', background: 'transparent', border: '1px dashed #4a9eff', borderRadius: 12, padding: 12, cursor: 'pointer', color: '#60a5fa', fontWeight: 600, fontSize: 13 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>&#x2B07;</span>
          Install Blue Light Support on this phone
        </button>
      )}
    </div>
    {showIosInstall && (
      <div data-testid="ios-install-modal" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#0d1b2e', border: '1px solid #243656', borderRadius: 16, padding: 18, maxWidth: 360, width: '100%' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Install on iPhone</div>
          <div style={{ fontSize: 12, color: '#8b9dc3', lineHeight: 1.5, marginBottom: 14 }}>iOS doesn&apos;t allow apps to install themselves. To add Blue Light Support to your home screen:</div>
          <ol style={{ paddingLeft: 18, marginBottom: 14 }}>
            <li style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.55, marginBottom: 8 }}>Tap the <strong>Share</strong> button at the bottom of Safari (the square with the up arrow).</li>
            <li style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.55, marginBottom: 8 }}>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.55, marginBottom: 8 }}>Tap <strong>Add</strong> in the top right.</li>
          </ol>
          <div style={{ fontSize: 11, color: '#8b9dc3', lineHeight: 1.5, marginBottom: 14 }}>It will appear on your home screen with the Blue Light icon. It opens like a normal app — no browser bars, fully confidential.</div>
          <button data-testid="ios-install-dismiss" onClick={() => setShowIosInstall(false)} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Got it</button>
        </div>
      </div>
    )}
  </DesktopShell>);

  // CHAT
  if (page === 'chat') return (<DesktopShell>
    <Header title={persona.name} showBack rightAction={<button data-testid="chat-new-button" onClick={clearChat} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: 11 }}>New Chat</button>} />
    <div data-testid="chat-messages" style={{ flex: 1, overflow: 'auto', padding: '8px 12px 0' }}>
      {messages.map((m, i) => (
        <div key={i} style={{ marginBottom: 8, display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
          {m.role === 'assistant' && <img src={persona.avatar} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />}
          <div style={{ maxWidth: '78%' }}>
            <div style={{ padding: '10px 14px', borderRadius: 16, fontSize: 13, lineHeight: 1.5, color: '#fff', background: m.role === 'user' ? '#0057B8' : '#1a2744', border: m.role === 'user' ? 'none' : '1px solid #243656', borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'user' ? 16 : 4 }}>{m.text}</div>
          </div>
        </div>
      ))}
      {sending && <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}><img src={persona.avatar} alt="" style={{ width: 28, height: 28, borderRadius: 14 }} /><div style={{ color: '#8b9dc3', fontSize: 12, fontStyle: 'italic' }}>{persona.name} is typing...</div></div>}
      <div ref={msgEnd} />
    </div>
    <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #1a2744', flexShrink: 0 }}>
      <input data-testid="chat-input" ref={chatRef} defaultValue="" onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 13, outline: 'none' }} />
      <button data-testid="chat-send-button" onClick={send} disabled={sending} style={{ padding: '10px 16px', borderRadius: 20, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: sending ? 0.5 : 1 }}>Send</button>
    </div>
    <SafeguardModal />
  </DesktopShell>);

  // CRISIS
  if (page === 'crisis') return (<DesktopShell><Header title="Crisis Support" showBack /><div style={{ flex: 1, overflow: 'auto', padding: 14 }}><div style={{ background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius: 12, padding: 18, marginBottom: 12, textAlign: 'center' }}><div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>If you&apos;re in immediate danger</div><div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>Call 999 now</div></div>{CRISIS.map(c => (<div key={c.name} data-testid={`crisis-${c.name.replace(/\s+/g,'-').toLowerCase()}`} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{c.name}</div><div style={{ fontSize: 11, color: '#8b9dc3', lineHeight: 1.4 }}>{c.desc}</div>{c.phone && <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', marginTop: 4 }}>{c.phone}</div>}</div>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g,'')}`} style={{ padding: '6px 12px', borderRadius: 8, background: '#0057B8', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>Call</a> : c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: 8, background: '#243656', color: '#4a9eff', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>Visit</a> : null}</div>))}</div></DesktopShell>);

  // RESOURCES
  if (page === 'resources') return (<DesktopShell><Header title="Support Organisations" showBack /><div style={{ flex: 1, overflow: 'auto', padding: 14 }}><div style={{ fontSize: 11, color: '#8b9dc3', marginBottom: 10, lineHeight: 1.5 }}>Charities and specialist services built for the police community. Tap any card to visit.</div>{RESOURCES.map(r => (<a data-testid={`resource-${r.name.replace(/\s+/g,'-').toLowerCase()}`} key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#1a2744', border: '1px solid #243656', borderRadius: 12, padding: 12, textDecoration: 'none', marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{r.name}</div><div style={{ fontSize: 11, color: '#4a9eff' }}>Visit &#8250;</div></div><div style={{ fontSize: 11, color: '#8b9dc3', lineHeight: 1.45 }}>{r.desc}</div></a>))}</div></DesktopShell>);

  // WELLBEING HUB (list of topics)
  if (page === 'wellbeing') return (<DesktopShell><Header title="Wellbeing Hub" showBack />
    <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
      <div style={{ fontSize: 12, color: '#8b9dc3', marginBottom: 12, lineHeight: 1.5 }}>Short, honest guides on the stuff that actually weighs on officers. Practical tips and where to get proper help.</div>
      {WELLBEING.map(t => (
        <button data-testid={`wellbeing-card-${t.id}`} key={t.id} onClick={() => { setWellbeingTopic(t); setPage('wellbeing-topic'); }} style={{ width: '100%', background: '#1a2744', border: '1px solid #243656', borderRadius: 12, padding: 12, marginBottom: 8, textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{t.title}</div>
            <div style={{ fontSize: 16, color: '#4a9eff' }}>&#8250;</div>
          </div>
          <div style={{ fontSize: 11, color: '#60a5fa', marginBottom: 3 }}>{t.tag}</div>
          <div style={{ fontSize: 11, color: '#8b9dc3', lineHeight: 1.4 }}>{t.intro.slice(0, 120)}{t.intro.length > 120 ? '\u2026' : ''}</div>
        </button>
      ))}
    </div>
  </DesktopShell>);

  // WELLBEING TOPIC DETAIL
  if (page === 'wellbeing-topic' && wellbeingTopic) {
    const t = wellbeingTopic;
    return (<DesktopShell>
      <Header title={t.title} showBack rightAction={<button data-testid="wellbeing-back-to-hub" onClick={() => setPage('wellbeing')} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: 11 }}>All topics</button>} />
      <div data-testid={`wellbeing-topic-${t.id}`} style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        <div style={{ fontSize: 11, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{t.tag}</div>
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 14 }}>{t.intro}</div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Try this</div>
        <ul style={{ paddingLeft: 18, marginBottom: 18 }}>
          {t.tips.map((tip, i) => (
            <li key={i} style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.55, marginBottom: 8 }}>{tip}</li>
          ))}
        </ul>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Where to get help</div>
        {t.signposts.map((s, i) => (
          <div key={i} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 10, padding: 10, marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#8b9dc3', lineHeight: 1.4 }}>{s.note}</div>
              {s.phone && <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', marginTop: 3 }}>{s.phone}</div>}
            </div>
            {s.phone ? <a href={`tel:${s.phone.replace(/\s/g,'')}`} style={{ padding: '5px 10px', borderRadius: 7, background: '#0057B8', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>Call</a> : s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', borderRadius: 7, background: '#243656', color: '#4a9eff', fontSize: 11, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>Visit</a> : null}
          </div>
        ))}

        <div style={{ marginTop: 18, padding: 10, background: 'rgba(127,29,29,0.3)', border: '1px solid #7f1d1d', borderRadius: 10, fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>
          If things feel too heavy right now, you don&apos;t have to go through it alone. Call <strong>999</strong> in an emergency, Samaritans on <strong>116 123</strong>, or tap Request a Callback.
        </div>
      </div>
    </DesktopShell>);
  }

  // CALLBACK
  if (page === 'callback') return (<DesktopShell><Header title="Request Callback" showBack /><div style={{ flex: 1, overflow: 'auto', padding: 14 }}>{!cbSent ? (<><div style={{ fontSize: 13, color: '#8b9dc3', marginBottom: 14, lineHeight: 1.5 }}>Leave your details. Completely confidential.</div><form onSubmit={submitCallback}><input data-testid="cb-name" name="name" placeholder="Your name (or alias)" required style={is} /><input data-testid="cb-phone" name="phone" type="tel" placeholder="Phone number" required style={is} /><input data-testid="cb-email" name="email" type="email" placeholder="Email (optional)" style={is} /><select data-testid="cb-time" name="time" style={is}><option>Anytime</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select><textarea data-testid="cb-message" name="message" placeholder="Anything you'd like us to know..." rows={3} style={{...is,resize:'vertical' as const}} /><button data-testid="cb-submit" type="submit" style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>Request Callback</button></form></>) : (<div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 48, height: 48, borderRadius: 24, background: '#0057B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, color: '#fff' }}>&#10003;</div><div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Callback Requested</div><div style={{ fontSize: 13, color: '#8b9dc3', marginTop: 6 }}>Someone will be in touch. Stay safe.</div></div>)}</div></DesktopShell>);

  return null;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box' };
