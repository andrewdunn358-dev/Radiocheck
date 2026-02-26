import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../config/api';

interface Message { id: string; text: string; sender: 'user'|'buddy'; }
interface Character { id: string; name: string; description: string; avatar: string; welcomeMessage?: string; accentColor?: string; }

export default function Chat() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [showSafeguarding, setShowSafeguarding] = useState(false);
  const [safeguardingView, setSafeguardingView] = useState<'main'|'callback'|'success'>('main');
  const [callbackName, setCallbackName] = useState('');
  const [callbackPhone, setCallbackPhone] = useState('');
  const [currentAlertId, setCurrentAlertId] = useState<string|null>(null);
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/ai-buddies/characters`)
      .then(r => r.json())
      .then(data => {
        const char = data.characters.find((c: Character) => c.id === characterId);
        if (char) {
          setCharacter(char);
          setMessages([{ id: 'welcome', text: char.welcomeMessage || `Hi, I'm ${char.name}. How are you doing today?`, sender: 'buddy' }]);
        }
      });
  }, [characterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !character) return;
    const userMsg: Message = { id: Date.now().toString(), text: input.trim(), sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    const text = input.trim();
    setInput('');
    setIsLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/ai-buddies/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, character_id: character.id, session_id: sessionId }),
      });
      const data = await r.json();
      if (data.safeguarding_alert) { setCurrentAlertId(data.alert_id); setShowSafeguarding(true); }
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), text: data.response || "I'm here for you.", sender: 'buddy' }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), text: "I'm having trouble connecting right now. Please try again.", sender: 'buddy' }]);
    } finally { setIsLoading(false); }
  };

  const submitCallback = async () => {
    if (!callbackPhone || !callbackName) return;
    setIsSubmittingCallback(true);
    try {
      await fetch(`${API_URL}/api/callbacks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: callbackName, phone: callbackPhone, message: `Safeguarding callback from ${character?.name} chat`, request_type: 'counsellor', is_urgent: true, safeguarding_alert_id: currentAlertId }),
      });
      setSafeguardingView('success');
    } catch { console.error('Callback error'); }
    finally { setIsSubmittingCallback(false); }
  };

  const accentColor = character?.accentColor || '#4a90d9';

  if (!character) return <div style={{minHeight:'100vh',backgroundColor:'#1a2332',display:'flex',alignItems:'center',justifyContent:'center',color:'#8899a6'}}>Loading...</div>;

  return (
    <div style={{height:'100vh',backgroundColor:'#1a2332',display:'flex',flexDirection:'column'}}>
      <div style={{backgroundColor:'#243447',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid #2d4060',flexShrink:0}}>
        <button onClick={() => navigate('/buddies')} style={{background:'none',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>←</button>
        <img src={character.avatar} alt={character.name} style={{width:'40px',height:'40px',borderRadius:'20px',objectFit:'cover'}}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:'700',color:'#fff'}}>{character.name}</div>
          <div style={{fontSize:'12px',color:accentColor}}>AI Battle Buddy</div>
        </div>
        <button onClick={() => setMessages([{ id: 'welcome', text: character.welcomeMessage || `Hi, I'm ${character.name}. How are you doing today?`, sender: 'buddy' }])}
          style={{background:'none',border:'none',color:'#8899a6',fontSize:'20px',cursor:'pointer'}}>↺</button>
      </div>

      {messages.length <= 1 && (
        <div style={{margin:'16px',backgroundColor:'#243447',borderRadius:'16px',padding:'16px',display:'flex',gap:'14px',border:'1px solid #2d4060',flexShrink:0}}>
          <img src={character.avatar} alt={character.name} style={{width:'60px',height:'60px',borderRadius:'30px',objectFit:'cover',border:`2px solid ${accentColor}`}}/>
          <div>
            <div style={{fontWeight:'700',fontSize:'17px',color:'#fff'}}>{character.name}</div>
            <div style={{fontSize:'13px',color:accentColor,marginBottom:'6px'}}>AI Battle Buddy</div>
            <div style={{fontSize:'13px',color:'#8899a6',lineHeight:'1.5'}}>{character.description}</div>
          </div>
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
        {messages.map(msg => (
          <div key={msg.id} style={{display:'flex',flexDirection:'column',alignItems:msg.sender==='user'?'flex-end':'flex-start',maxWidth:'85%',alignSelf:msg.sender==='user'?'flex-end':'flex-start'}}>
            {msg.sender==='buddy' && (
              <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                <img src={character.avatar} style={{width:'20px',height:'20px',borderRadius:'10px',objectFit:'cover'}} alt=""/>
                <span style={{fontSize:'12px',fontWeight:'600',color:accentColor}}>{character.name}</span>
              </div>
            )}
            <div style={{padding:'12px 16px',borderRadius:'16px',backgroundColor:msg.sender==='user'?accentColor:'#243447',color:'#fff',fontSize:'15px',lineHeight:'1.5',border:msg.sender==='buddy'?'1px solid #2d4060':'none',borderBottomRightRadius:msg.sender==='user'?'4px':'16px',borderBottomLeftRadius:msg.sender==='buddy'?'4px':'16px'}}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{display:'flex',alignItems:'center',gap:'6px',alignSelf:'flex-start'}}>
            <img src={character.avatar} style={{width:'20px',height:'20px',borderRadius:'10px',objectFit:'cover'}} alt=""/>
            <div style={{backgroundColor:'#243447',padding:'12px 16px',borderRadius:'16px',border:'1px solid #2d4060',color:'#8899a6',fontSize:'14px'}}>{character.name} is typing...</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{backgroundColor:'#243447',padding:'8px 16px',textAlign:'center',fontSize:'11px',color:'#8899a6',borderTop:'1px solid #2d4060'}}>
        ℹ️ AI companion — not a substitute for professional help
      </div>

      <div style={{backgroundColor:'#243447',padding:'12px 16px',display:'flex',gap:'12px',alignItems:'flex-end',borderTop:'1px solid #2d4060',flexShrink:0}}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
          placeholder="Type a message..." maxLength={1000} rows={1}
          style={{flex:1,backgroundColor:'#1a2332',border:'1px solid #2d4060',borderRadius:'20px',padding:'10px 16px',color:'#fff',fontSize:'15px',outline:'none',resize:'none',fontFamily:'inherit',lineHeight:'1.5'}}/>
        <button onClick={sendMessage} disabled={!input.trim()||isLoading}
          style={{width:'44px',height:'44px',borderRadius:'22px',backgroundColor:(!input.trim()||isLoading)?'#8899a6':accentColor,border:'none',color:'#fff',fontSize:'18px',cursor:(!input.trim()||isLoading)?'not-allowed':'pointer',flexShrink:0}}>
          ➤
        </button>
      </div>

      {showSafeguarding && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',zIndex:1000}}>
          <div style={{backgroundColor:'#243447',borderRadius:'20px',padding:'24px',width:'100%',maxWidth:'460px',maxHeight:'90vh',overflowY:'auto'}}>
            {safeguardingView==='main' && (
              <>
                <div style={{textAlign:'center',marginBottom:'16px'}}>
                  <div style={{fontSize:'40px',marginBottom:'8px'}}>❤️</div>
                  <h2 style={{color:'#fff',margin:'0 0 8px'}}>We're Here For You</h2>
                  <p style={{color:'#8899a6',fontSize:'14px',lineHeight:'1.6',margin:0}}>It sounds like you might be going through something difficult. You don't have to face this alone.</p>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'10px',margin:'20px 0'}}>
                  {[
                    {icon:'📞',title:'Request a Callback',desc:"Leave your number, we'll call you",action:()=>setSafeguardingView('callback')},
                    {icon:'🤝',title:'Samaritans',desc:'Free 24/7 support: 116 123',action:()=>window.open('tel:116123')},
                    {icon:'🛡️',title:'Combat Stress',desc:'Veterans helpline: 0800 138 1619',action:()=>window.open('tel:08001381619')},
                  ].map(opt => (
                    <button key={opt.title} onClick={opt.action}
                      style={{backgroundColor:'#1a2332',border:'1px solid #2d4060',borderRadius:'12px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',textAlign:'left',width:'100%'}}>
                      <span style={{fontSize:'24px'}}>{opt.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:'600',color:'#fff',fontSize:'15px'}}>{opt.title}</div>
                        <div style={{fontSize:'13px',color:'#8899a6'}}>{opt.desc}</div>
                      </div>
                      <span style={{color:'#8899a6'}}>›</span>
                    </button>
                  ))}
                </div>
                <div style={{backgroundColor:'#451a03',border:'1px solid #92400e',borderRadius:'10px',padding:'12px',display:'flex',gap:'8px',alignItems:'center',marginBottom:'16px'}}>
                  <span>⚠️</span><span style={{fontSize:'14px',color:'#fcd34d',fontWeight:'500'}}>In immediate danger? Call 999</span>
                </div>
                <button onClick={() => setShowSafeguarding(false)} style={{width:'100%',background:'none',border:'none',color:'#8899a6',fontSize:'14px',cursor:'pointer',textDecoration:'underline',padding:'8px'}}>
                  Continue chatting with {character.name}
                </button>
              </>
            )}
            {safeguardingView==='callback' && (
              <>
                <button onClick={() => setSafeguardingView('main')} style={{background:'none',border:'none',color:'#8899a6',cursor:'pointer',fontSize:'14px',marginBottom:'16px'}}>← Back</button>
                <h2 style={{color:'#fff',marginBottom:'8px'}}>Request a Callback</h2>
                <p style={{color:'#8899a6',fontSize:'14px',marginBottom:'20px'}}>One of our counsellors will call you back as soon as possible.</p>
                <label style={{color:'#8899a6',fontSize:'14px',fontWeight:'600'}}>Your Name</label>
                <input value={callbackName} onChange={e=>setCallbackName(e.target.value)} placeholder="First name is fine"
                  style={{width:'100%',backgroundColor:'#1a2332',border:'1px solid #2d4060',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',outline:'none',marginBottom:'12px',marginTop:'6px',boxSizing:'border-box'}}/>
                <label style={{color:'#8899a6',fontSize:'14px',fontWeight:'600'}}>Phone Number</label>
                <input value={callbackPhone} onChange={e=>setCallbackPhone(e.target.value)} placeholder="07xxx xxxxxx" type="tel"
                  style={{width:'100%',backgroundColor:'#1a2332',border:'1px solid #2d4060',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',outline:'none',marginBottom:'20px',marginTop:'6px',boxSizing:'border-box'}}/>
                <button onClick={submitCallback} disabled={!callbackName||!callbackPhone||isSubmittingCallback}
                  style={{width:'100%',backgroundColor:(!callbackName||!callbackPhone)?'#8899a6':accentColor,color:'#fff',border:'none',borderRadius:'10px',padding:'14px',fontSize:'16px',fontWeight:'600',cursor:'pointer'}}>
                  {isSubmittingCallback?'Sending...':'Request Callback'}
                </button>
              </>
            )}
            {safeguardingView==='success' && (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:'48px',marginBottom:'16px'}}>✅</div>
                <h2 style={{color:'#fff',marginBottom:'12px'}}>Callback Requested</h2>
                <p style={{color:'#8899a6',fontSize:'15px',marginBottom:'24px'}}>A counsellor will call you back as soon as possible. Please keep your phone nearby.</p>
                <button onClick={() => { setShowSafeguarding(false); setSafeguardingView('main'); }}
                  style={{backgroundColor:accentColor,color:'#fff',border:'none',borderRadius:'10px',padding:'14px 40px',fontSize:'16px',fontWeight:'600',cursor:'pointer'}}>Continue</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
