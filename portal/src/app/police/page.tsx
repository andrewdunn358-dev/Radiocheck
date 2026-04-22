'use client';

import { useState, useRef, useEffect } from 'react';
import { API_URL } from '@/lib/admin-api';

const PERSONAS = [
  { id: 'sgt_cooper', name: 'Sgt Cooper', role: 'Peer Support', greeting: "Alright mate. Sgt Cooper — 25 years on the job, now retired. What's going on?" },
  { id: 'dr_hayes', name: 'Dr Hayes', role: 'Welfare Specialist', greeting: "Hello. I'm Dr Hayes — I've spent 15 years working with officers. Whatever's on your mind, I've probably heard something like it before. What's going on?" },
];

const CRISIS = [
  { name: 'Samaritans', phone: '116 123', desc: '24/7 emotional support — free, confidential' },
  { name: 'Police Care UK', phone: '0300 012 0030', desc: 'Support for police officers and families' },
  { name: 'Oscar Kilo', phone: '', url: 'https://oscarkilo.org.uk', desc: 'National police wellbeing service' },
  { name: 'Mind Blue Light', phone: '', url: 'https://www.mind.org.uk/news-campaigns/campaigns/blue-light-programme/', desc: 'Mental health for emergency services' },
  { name: 'Emergency', phone: '999', desc: 'Immediate danger to life' },
];

const RESOURCES = [
  { name: 'Police Care UK', url: 'https://www.policecare.org.uk', desc: 'Charity for serving and retired police officers, staff, and volunteers' },
  { name: 'Oscar Kilo', url: 'https://oscarkilo.org.uk', desc: 'National Police Wellbeing Service' },
  { name: 'Police Mutual', url: 'https://www.policemutual.co.uk', desc: 'Financial services and wellbeing for police' },
  { name: 'Mind Blue Light Programme', url: 'https://www.mind.org.uk/news-campaigns/campaigns/blue-light-programme/', desc: 'Mental health support for emergency services' },
  { name: 'PFEW Welfare', url: 'https://www.polfed.org/ourwork/welfare/', desc: 'Police Federation welfare support' },
  { name: 'The Police Treatment Centres', url: 'https://www.thepolicetreatmentcentres.org', desc: 'Physical and psychological treatment for officers' },
  { name: 'Flint House', url: 'https://www.flinthouse.co.uk', desc: 'Police rehabilitation centre' },
  { name: 'NARPO', url: 'https://www.narpo.org', desc: 'National Association of Retired Police Officers' },
  { name: 'Blue Light Together', url: 'https://bluelighttogether.org.uk', desc: 'Domestic abuse support for emergency services' },
  { name: 'BackUp Buddy', url: 'https://www.intandem.org.uk', desc: 'Post-trauma support for officers' },
];

type Page = 'home' | 'chat' | 'crisis' | 'resources' | 'callback';

export default function PolicePage() {
  const [page, setPage] = useState<Page>('home');
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [messages, setMessages] = useState<{role: string; text: string}[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState('bls_' + Math.random().toString(36).substr(2, 12));
  const [cbSent, setCbSent] = useState(false);
  const msgEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const openChat = (p?: typeof PERSONAS[0]) => {
    if (p && p.id !== persona.id) { setPersona(p); setMessages([{ role: 'assistant', text: p.greeting }]); }
    else if (messages.length === 0) { setMessages([{ role: 'assistant', text: (p || persona).greeting }]); }
    setPage('chat');
  };

  const switchPersona = (p: typeof PERSONAS[0]) => {
    setPersona(p);
    setMessages([{ role: 'assistant', text: p.greeting }]);
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
        body: JSON.stringify({ name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') || undefined, request_type: 'counsellor', preferred_time: fd.get('time'), message: fd.get('message') }),
      });
      setCbSent(true);
    } catch { alert('Failed to submit. Please try again.'); }
  };

  const nav = (p: Page) => { setPage(p); };

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', color: '#fff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#0d1b2e', borderBottom: '2px solid #003078', padding: '16px 20px' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Blue Light Support</div>
        <div style={{ fontSize: 12, color: '#8b9dc3' }}>Support for Those Who Protect</div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 20px', background: '#0d1b2e', borderBottom: '1px solid #1a2744', overflowX: 'auto' }}>
        {([['home','Home'],['chat','Talk to Someone'],['crisis','Crisis Support'],['resources','Resources'],['callback','Request Callback']] as [Page,string][]).map(([id, label]) => (
          <button key={id} onClick={() => id === 'chat' ? openChat() : nav(id)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: page === id ? '#0057B8' : '#1a2744', color: page === id ? '#fff' : '#8b9dc3', cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 900, width: '100%', margin: '0 auto', padding: 20 }}>

        {/* HOME */}
        {page === 'home' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>You protect everyone else.<br/>Who&apos;s got your back?</h2>
            <p style={{ color: '#8b9dc3', fontSize: 15, lineHeight: 1.6, maxWidth: 500, margin: '0 auto 24px' }}>Confidential support for serving and retired police officers. No names, no records, no judgement. Talk to someone who understands the job.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 500, margin: '0 auto' }}>
              {([['chat','Talk Now','Chat with someone who gets it'],['crisis','Crisis Support','Need help right now'],['resources','Resources','Police support organisations'],['callback','Callback',"We'll call you"]] as [Page,string,string][]).map(([id, title, desc]) => (
                <div key={id} onClick={() => id === 'chat' ? openChat() : nav(id)} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 12, color: '#8b9dc3' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT */}
        {page === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
            <div style={{ display: 'flex', gap: 12, padding: '16px 0', justifyContent: 'center' }}>
              {PERSONAS.map(p => (
                <button key={p.id} onClick={() => switchPersona(p)} style={{ padding: '12px 24px', borderRadius: 12, border: `2px solid ${persona.id === p.id ? '#0057B8' : '#243656'}`, background: persona.id === p.id ? '#0d2a5e' : '#1a2744', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  {p.name}<span style={{ fontSize: 11, color: '#8b9dc3', fontWeight: 400, display: 'block' }}>{p.role}</span>
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b9dc3', marginBottom: 2, textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.role === 'user' ? 'You' : persona.name}</div>
                    <div style={{ maxWidth: '75%', padding: '12px 16px', borderRadius: 16, fontSize: 14, lineHeight: 1.5, background: m.role === 'user' ? '#0057B8' : '#1a2744', border: m.role === 'user' ? 'none' : '1px solid #243656', borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'user' ? 16 : 4 }}>{m.text}</div>
                  </div>
                </div>
              ))}
              {sending && <div style={{ color: '#8b9dc3', fontSize: 13, padding: '8px 0', fontStyle: 'italic' }}>Typing...</div>}
              <div ref={msgEnd} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '12px 0' }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 14, outline: 'none' }} />
              <button onClick={send} disabled={sending} style={{ padding: '12px 20px', borderRadius: 24, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14, opacity: sending ? 0.5 : 1 }}>Send</button>
            </div>
          </div>
        )}

        {/* CRISIS */}
        {page === 'crisis' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius: 12, padding: 24, marginBottom: 16, textAlign: 'center' }}>
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>If you&apos;re in immediate danger, call 999</h3>
              <p style={{ color: '#fca5a5', fontSize: 14 }}>These services understand what you&apos;re going through</p>
            </div>
            {CRISIS.map(c => (
              <div key={c.name} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 12, padding: 16, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 12, color: '#8b9dc3' }}>{c.desc}</div></div>
                {c.phone ? <a href={`tel:${c.phone.replace(/\s/g,'')}`} style={{ background: '#0057B8', padding: '8px 16px', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Call {c.phone}</a> 
                : c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ background: '#0057B8', padding: '8px 16px', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Visit Site</a> : null}
              </div>
            ))}
          </div>
        )}

        {/* RESOURCES */}
        {page === 'resources' && (
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Police Support Organisations</h3>
            {RESOURCES.map(r => (
              <div key={r.name} style={{ background: '#1a2744', border: '1px solid #243656', borderRadius: 12, padding: 16, marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 13, color: '#8b9dc3', marginBottom: 8 }}>{r.desc}</div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff', fontSize: 13 }}>Visit →</a>
              </div>
            ))}
          </div>
        )}

        {/* CALLBACK */}
        {page === 'callback' && (
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Request a Callback</h3>
            <p style={{ color: '#8b9dc3', marginBottom: 20, fontSize: 14 }}>Leave your details and someone will call you back. Completely confidential.</p>
            {!cbSent ? (
              <form onSubmit={submitCallback}>
                <input name="name" placeholder="Your name (or alias)" required style={inputStyle} />
                <input name="phone" type="tel" placeholder="Phone number" required style={inputStyle} />
                <input name="email" type="email" placeholder="Email (optional)" style={inputStyle} />
                <select name="time" style={inputStyle}><option>Anytime</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select>
                <textarea name="message" placeholder="Anything you'd like us to know..." rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
                <button type="submit" style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#0057B8', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>Request Callback</button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
                <h3>Callback Requested</h3>
                <p style={{ color: '#8b9dc3', marginTop: 8 }}>Someone will be in touch. Stay safe.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid #243656', background: '#1a2744', color: '#fff', fontSize: 14, marginBottom: 12, outline: 'none', boxSizing: 'border-box' };
