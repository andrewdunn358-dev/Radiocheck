'use client';

import { useState, useRef, useEffect } from 'react';
import { API_URL } from '@/lib/admin-api';

const LOGO_URL = 'https://static.prod-images.emergentagent.com/jobs/99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/images/19f5131d6075cedaa7d8e2f56005fba0f0ef9bb4d9530fe80d4798a82456c218.png';
const HERO_IMG = 'https://customer-assets.emergentagent.com/job_99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/artifacts/681p6tax_WhatsApp%20Image%202026-04-22%20at%2011.35.55.jpeg';
const SITE_PASSWORD = 'bluelight2025';

const PERSONAS = [
  { id: 'steve', name: 'Steve', role: 'Peer Support', color: '#0057B8', avatar: 'https://static.prod-images.emergentagent.com/jobs/99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/images/4576491eca3195744da6499172bdcf312d5fb21dd4be481ac8d9ba7bb4127e02.png', desc: 'Retired copper, 25 years on the job. Straight-talking support from someone who\'s been there.', greeting: "Alright mate. I'm Steve — 25 years on the job, now retired. What's going on?" },
  { id: 'claire', name: 'Claire', role: 'Wellbeing Support', color: '#003078', avatar: 'https://static.prod-images.emergentagent.com/jobs/99d619d0-b5ae-4aad-8c13-9ad1f0c90dfa/images/f06b560a0e81c6ed1251844fba825a02507c6e776247c99e9dd6a7c642718a92.png', desc: 'Wellbeing practitioner, 15 years with emergency services. Understands the job and what it does to people.', greeting: "Hi, I'm Claire — I've spent 15 years working with officers. Whatever's on your mind, I've probably heard something like it before. What's going on?" },
];

const CRISIS = [
  { name: 'Emergency', phone: '999', desc: 'Immediate danger to life', icon: '🚨' },
  { name: 'Samaritans', phone: '116 123', desc: '24/7 emotional support — free, confidential', icon: '📞' },
  { name: 'Police Care UK', phone: '0300 012 0030', desc: 'Support for police officers and families', icon: '🛡' },
  { name: 'Oscar Kilo', url: 'https://oscarkilo.org.uk', desc: 'National police wellbeing service', icon: '💙' },
  { name: 'Mind Blue Light', url: 'https://www.mind.org.uk/news-campaigns/campaigns/blue-light-programme/', desc: 'Mental health for emergency services', icon: '🧠' },
];

const RESOURCES = [
  { name: 'Police Care UK', url: 'https://www.policecare.org.uk', desc: 'Charity for serving and retired police officers' },
  { name: 'Oscar Kilo', url: 'https://oscarkilo.org.uk', desc: 'National Police Wellbeing Service' },
  { name: 'Police Mutual', url: 'https://www.policemutual.co.uk', desc: 'Financial services and wellbeing' },
  { name: 'Mind Blue Light', url: 'https://www.mind.org.uk/news-campaigns/campaigns/blue-light-programme/', desc: 'Mental health for emergency services' },
  { name: 'PFEW Welfare', url: 'https://www.polfed.org/ourwork/welfare/', desc: 'Police Federation welfare support' },
  { name: 'Police Treatment Centres', url: 'https://www.thepolicetreatmentcentres.org', desc: 'Physical & psychological treatment' },
  { name: 'Flint House', url: 'https://www.flinthouse.co.uk', desc: 'Police rehabilitation centre' },
  { name: 'NARPO', url: 'https://www.narpo.org', desc: 'Retired Police Officers association' },
  { name: 'Blue Light Together', url: 'https://bluelighttogether.org.uk', desc: 'Domestic abuse support for emergency services' },
  { name: 'BackUp Buddy', url: 'https://www.intandem.org.uk', desc: 'Post-trauma support for officers' },
];

const MENU_ITEMS = [
  { title: 'Talk to Someone', desc: 'Chat with someone who gets the job', icon: '💬', page: 'chat' as const },
  { title: 'Crisis Support', desc: 'Need help right now', icon: '🆘', page: 'crisis' as const },
  { title: 'Resources', desc: 'Police support organisations', icon: '📋', page: 'resources' as const },
  { title: 'Request Callback', desc: "We'll call you back", icon: '📱', page: 'callback' as const },
];

type Page = 'splash' | 'gate' | 'consent' | 'home' | 'chat' | 'crisis' | 'resources' | 'callback' | 'privacy' | 'terms';

export default function PolicePage() {
  const [page, setPage] = useState<Page>('splash');
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [messages, setMessages] = useState<{role: string; text: string}[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState('bls_' + Math.random().toString(36).substr(2, 12));
  const [cbSent, setCbSent] = useState(false);
  const msgEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Check stored state
  useEffect(() => {
    const unlocked = localStorage.getItem('bls_unlocked');
    const consent = localStorage.getItem('bls_consent');
    if (unlocked === 'true' && consent === 'true') setPage('home');
    else if (unlocked === 'true') setPage('consent');
    else setTimeout(() => setPage('gate'), 2500);
  }, []);

  const handleGate = () => {
    if (gatePassword === SITE_PASSWORD) {
      localStorage.setItem('bls_unlocked', 'true');
      setPage('consent');
      setGateError('');
    } else {
      setGateError('Incorrect password');
      setGatePassword('');
    }
  };

  const handleConsent = () => {
    localStorage.setItem('bls_consent', 'true');
    setConsentGiven(true);
    setPage('home');
  };

  const openChat = (p?: typeof PERSONAS[0]) => {
    const selected = p || persona;
    if (p && p.id !== persona.id) {
      setPersona(selected);
      setMessages([{ role: 'assistant', text: selected.greeting }]);
      setSessionId('bls_' + Math.random().toString(36).substr(2, 12));
    } else if (messages.length === 0) {
      setMessages([{ role: 'assistant', text: selected.greeting }]);
    }
    setPage('chat');
  };

  const switchPersona = (p: typeof PERSONAS[0]) => {
    setPersona(p);
    setMessages([{ role: 'assistant', text: p.greeting }]);
    setSessionId('bls_' + Math.random().toString(36).substr(2, 12));
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId, character: persona.id, tenant: 'bluelight' }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'assistant', text: data.reply || 'Sorry, something went wrong.' }]);
    } catch { setMessages(m => [...m, { role: 'assistant', text: 'Connection error. Please try again.' }]); }
    setSending(false);
  };

  const submitCallback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await fetch(`${API_URL}/api/callbacks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') || undefined, request_type: 'counsellor', preferred_time: fd.get('time'), message: fd.get('message'), tenant: 'bluelight' }),
      });
      setCbSent(true);
    } catch { alert('Failed to submit. Please try again.'); }
  };

  const goBack = () => setPage('home');

  // Phone frame wrapper
  const PhoneFrame = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: '100vh', background: '#060e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ display: 'none' }} className="mobile-direct">{children}</div>
      <div className="desktop-frame" style={{ width: 430, height: '90vh', maxHeight: 932, borderRadius: 40, overflow: 'hidden', border: '8px solid #1a1a2e', boxShadow: '0 0 60px rgba(0,87,184,0.3), inset 0 0 0 2px #2a2a4e', position: 'relative', display: 'flex', flexDirection: 'column', background: '#0a1628' }}>
        <div style={{ height: 28, background: '#0d1b2e', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 10 }}>
          <div style={{ width: 120, height: 5, borderRadius: 3, background: '#1a2744' }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
        <div style={{ height: 5, background: '#0d1b2e', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: 8 }}>
          <div style={{ width: 140, height: 5, borderRadius: 3, background: '#1a2744' }} />
        </div>
      </div>
      <style>{`
        @media (max-width: 500px) {
          .desktop-frame { display: none !important; }
          .mobile-direct { display: flex !important; flex-direction: column; min-height: 100vh; }
        }
        @media (min-width: 501px) {
          .mobile-direct { display: none !important; }
        }
      `}</style>
    </div>
  );

  const Header = ({ title, showBack }: { title?: string; showBack?: boolean }) => (
    <div style={{ background: '#0d1b2e', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #1a2744', flexShrink: 0 }}>
      {showBack && <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#8b9dc3', cursor: 'pointer', fontSize: 20, padding: 0 }}>&#8592;</button>}
      <img src={LOGO_URL} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
      <div><div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title || 'Blue Light Support'}</div></div>
    </div>
  );

  // SPLASH
  if (page === 'splash') return (
    <PhoneFrame>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, #0a1628 0%, #0d2a5e 100%)`, padding: 40 }}>
        <img src={HERO_IMG} alt="Blue Light Support" style={{ width: 200, height: 200, borderRadius: 24, objectFit: 'cover', marginBottom: 24, boxShadow: '0 0 40px rgba(0,87,184,0.4)' }} />
        <div style={{ fontSize: 12, color: '#4a9eff', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Blue Light Support</div>
        <div style={{ fontSize: 10, color: '#8b9dc3' }}>Loading...</div>
      </div>
    </PhoneFrame>
  );

  // PASSWORD GATE
  if (page === 'gate') return (
    <PhoneFrame>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a1628', padding: 32 }}>
        <img src={LOGO_URL} alt="" style={{ width: 80, height: 80, marginBottom: 24 }} />
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Blue Light Support</div>
        <div style={{ fontSize: 13, color: '#8b9dc3', marginBottom: 24, textAlign: 'center' }}>This app is currently in beta testing.<br/>Enter your access code to continue.</div>
        <input type="password" value={gatePassword} onChange={e => setGatePassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGate()} placeholder="Access code" style={{ width: '100%', maxWidth: 280, padding: 14, borderRadius: 12, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 15, textAlign: 'center', outline: 'none', marginBottom: 12 }} />
        {gateError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{gateError}</div>}
        <button onClick={handleGate} style={{ width: '100%', maxWidth: 280, padding: 14, borderRadius: 12, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Enter</button>
      </div>
    </PhoneFrame>
  );

  // CONSENT / AGREEMENTS
  if (page === 'consent') return (
    <PhoneFrame>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a1628', padding: 24, overflow: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src={LOGO_URL} alt="" style={{ width: 56, height: 56, marginBottom: 12 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Before You Begin</div>
        </div>
        <div style={{ background: '#1a2744', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #243656' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>This is a support tool, not an emergency service</div>
          <div style={{ fontSize: 12, color: '#8b9dc3', lineHeight: 1.5 }}>If you are in immediate danger, call 999. This app provides peer support through AI companions and is not a replacement for professional help.</div>
        </div>
        <div style={{ background: '#1a2744', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #243656' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Your conversations are private</div>
          <div style={{ fontSize: 12, color: '#8b9dc3', lineHeight: 1.5 }}>We do not share your conversations with anyone. If our safety system detects you may be in crisis, it will show you support resources — but your identity remains anonymous.</div>
        </div>
        <div style={{ background: '#1a2744', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #243656' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>You are talking to AI companions</div>
          <div style={{ fontSize: 12, color: '#8b9dc3', lineHeight: 1.5 }}>Sgt Cooper and Dr Hayes are AI personas designed to understand police culture. They are not real people, but they are built to listen like one.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12, color: '#8b9dc3', justifyContent: 'center' }}>
          <button onClick={() => setPage('privacy')} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: 12 }}>Privacy Policy</button>
          <span>|</span>
          <button onClick={() => setPage('terms')} style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', fontSize: 12 }}>Terms of Service</button>
        </div>
        <button onClick={handleConsent} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 16 }}>I Understand — Continue</button>
      </div>
    </PhoneFrame>
  );

  // PRIVACY
  if (page === 'privacy') return (
    <PhoneFrame>
      <Header title="Privacy Policy" showBack />
      <div style={{ flex: 1, overflow: 'auto', padding: 20, color: '#8b9dc3', fontSize: 13, lineHeight: 1.6 }}>
        <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>Privacy Policy</h2>
        <p>Blue Light Support is committed to protecting your privacy. This app is designed to be used anonymously — we do not require your name, email, or any identifying information to use the AI chat feature.</p>
        <h3 style={{ color: '#fff', fontSize: 15, marginTop: 16, marginBottom: 8 }}>What we collect</h3>
        <p>Conversation data is processed by our AI system to provide responses. Conversations are stored temporarily for session continuity and safeguarding purposes only. No personal identifiers are attached to conversations.</p>
        <h3 style={{ color: '#fff', fontSize: 15, marginTop: 16, marginBottom: 8 }}>Safeguarding</h3>
        <p>Our multi-layered safety system monitors conversations for signs of crisis. If detected, crisis resources will be displayed. In cases of imminent risk, an anonymous safeguarding alert may be created to notify support staff. IP-based approximate location may be used solely for welfare purposes.</p>
        <h3 style={{ color: '#fff', fontSize: 15, marginTop: 16, marginBottom: 8 }}>Your rights</h3>
        <p>You can clear all local data at any time through your device settings. We do not sell, share, or monetise your data.</p>
      </div>
    </PhoneFrame>
  );

  // TERMS
  if (page === 'terms') return (
    <PhoneFrame>
      <Header title="Terms of Service" showBack />
      <div style={{ flex: 1, overflow: 'auto', padding: 20, color: '#8b9dc3', fontSize: 13, lineHeight: 1.6 }}>
        <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>Terms of Service</h2>
        <p>By using Blue Light Support, you agree to the following:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 8 }}>This is a peer support tool, not a medical or emergency service.</li>
          <li style={{ marginBottom: 8 }}>AI companions (Sgt Cooper, Dr Hayes) are artificial intelligence — not real people.</li>
          <li style={{ marginBottom: 8 }}>In an emergency, always call 999.</li>
          <li style={{ marginBottom: 8 }}>We reserve the right to modify the service at any time during the beta period.</li>
          <li style={{ marginBottom: 8 }}>Misuse of the platform may result in access being revoked.</li>
        </ul>
        <p style={{ marginTop: 16 }}>Blue Light Support is developed by the Radio Check team as part of a multi-service support initiative.</p>
      </div>
    </PhoneFrame>
  );

  // HOME
  if (page === 'home') return (
    <PhoneFrame>
      <Header />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Hero */}
        <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
          <img src={HERO_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, background: 'linear-gradient(transparent, #0a1628)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>You protect everyone else.</div>
            <div style={{ fontSize: 14, color: '#8b9dc3', marginTop: 4 }}>Who&apos;s got your back?</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {MENU_ITEMS.map(item => (
              <button key={item.page} onClick={() => item.page === 'chat' ? openChat() : setPage(item.page)} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 14, padding: 16, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: '#8b9dc3', marginTop: 2 }}>{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Meet the Team */}
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Your Support Team</div>
          {PERSONAS.map(p => (
            <button key={p.id} onClick={() => openChat(p)} style={{ width: '100%', background: '#1a2744', border: '1px solid #243656', borderRadius: 14, padding: 16, marginBottom: 10, display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{p.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: p.color, marginBottom: 2 }}>{p.role}</div>
                <div style={{ fontSize: 11, color: '#8b9dc3' }}>{p.desc}</div>
              </div>
              <div style={{ color: '#4a9eff', fontSize: 20 }}>&#8250;</div>
            </button>
          ))}
        </div>

        {/* Emergency Banner */}
        <div style={{ margin: '0 16px 16px', background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>In an emergency, call 999</div>
          <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>If you or someone else is in immediate danger</div>
        </div>
      </div>
    </PhoneFrame>
  );

  // CHAT
  if (page === 'chat') return (
    <PhoneFrame>
      <Header title={persona.name} showBack />
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#0d1b2e', borderBottom: '1px solid #1a2744', flexShrink: 0 }}>
        {PERSONAS.map(p => (
          <button key={p.id} onClick={() => switchPersona(p)} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `2px solid ${persona.id === p.id ? '#0057B8' : '#243656'}`, background: persona.id === p.id ? '#0d2a5e' : '#1a2744', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
            {p.name}<span style={{ display: 'block', fontSize: 10, color: '#8b9dc3', fontWeight: 400 }}>{p.role}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 12px 0' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 8 }}>
            <div style={{ maxWidth: '80%' }}>
              <div style={{ fontSize: 10, color: '#8b9dc3', marginBottom: 2, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.role === 'user' ? 'You' : persona.name}</div>
              <div style={{ padding: '10px 14px', borderRadius: 16, fontSize: 13, lineHeight: 1.5, background: m.role === 'user' ? '#0057B8' : '#1a2744', border: m.role === 'user' ? 'none' : '1px solid #243656', borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'user' ? 16 : 4 }}>{m.text}</div>
            </div>
          </div>
        ))}
        {sending && <div style={{ color: '#8b9dc3', fontSize: 12, padding: 8, fontStyle: 'italic' }}>{persona.name} is typing...</div>}
        <div ref={msgEnd} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #1a2744', flexShrink: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 13, outline: 'none' }} />
        <button onClick={send} disabled={sending} style={{ padding: '10px 16px', borderRadius: 20, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, opacity: sending ? 0.5 : 1 }}>Send</button>
      </div>
    </PhoneFrame>
  );

  // CRISIS
  if (page === 'crisis') return (
    <PhoneFrame>
      <Header title="Crisis Support" showBack />
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius: 14, padding: 20, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>If you&apos;re in immediate danger</div>
          <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 4 }}>Call 999 now</div>
        </div>
        {CRISIS.map(c => (
          <div key={c.name} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 14, padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: '#8b9dc3' }}>{c.desc}</div>
            </div>
            {c.phone ? <a href={`tel:${c.phone.replace(/\s/g,'')}`} style={{ padding: '8px 12px', borderRadius: 8, background: '#0057B8', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Call</a>
            : c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', borderRadius: 8, background: '#243656', color: '#4a9eff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Visit</a> : null}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );

  // RESOURCES
  if (page === 'resources') return (
    <PhoneFrame>
      <Header title="Support Organisations" showBack />
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {RESOURCES.map(r => (
          <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#1a2744', border: '1px solid #243656', borderRadius: 14, padding: 14, marginBottom: 8, textDecoration: 'none' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{r.name}</div>
            <div style={{ fontSize: 12, color: '#8b9dc3', marginTop: 2 }}>{r.desc}</div>
            <div style={{ fontSize: 11, color: '#4a9eff', marginTop: 6 }}>Visit &#8250;</div>
          </a>
        ))}
      </div>
    </PhoneFrame>
  );

  // CALLBACK
  if (page === 'callback') return (
    <PhoneFrame>
      <Header title="Request Callback" showBack />
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!cbSent ? (
          <>
            <div style={{ fontSize: 13, color: '#8b9dc3', marginBottom: 16, lineHeight: 1.5 }}>Leave your details and someone will call you back. Completely confidential.</div>
            <form onSubmit={submitCallback}>
              <input name="name" placeholder="Your name (or alias)" required style={inputStyle} />
              <input name="phone" type="tel" placeholder="Phone number" required style={inputStyle} />
              <input name="email" type="email" placeholder="Email (optional)" style={inputStyle} />
              <select name="time" style={inputStyle}><option>Anytime</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select>
              <textarea name="message" placeholder="Anything you'd like us to know..." rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
              <button type="submit" style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>Request Callback</button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#0057B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28, color: '#fff' }}>&#10003;</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Callback Requested</div>
            <div style={{ fontSize: 13, color: '#8b9dc3', marginTop: 8 }}>Someone will be in touch. Stay safe.</div>
          </div>
        )}
      </div>
    </PhoneFrame>
  );

  return null;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box' };
