import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';

interface Character {
  id: string;
  name: string;
  description: string;
  avatar: string;
}

export default function AiBuddies() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [about, setAbout] = useState<{title:string;description:string}|null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/api/ai-buddies/characters`)
      .then(r => r.json())
      .then(data => { setCharacters(data.characters); setAbout(data.about); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div style={{minHeight:'100vh',backgroundColor:'#1a2332',color:'#fff'}}>
      {/* Header */}
      <div style={{backgroundColor:'#243447',padding:'16px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid #2d4060'}}>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>←</button>
        <h1 style={{margin:0,fontSize:'20px',fontWeight:'700'}}>AI Battle Buddies</h1>
      </div>

      <div style={{maxWidth:'600px',margin:'0 auto',padding:'20px'}}>
        {/* About section */}
        {about && (
          <div style={{backgroundColor:'#243447',borderRadius:'16px',padding:'20px',marginBottom:'24px',border:'1px solid #2d4060'}}>
            <h2 style={{fontSize:'18px',fontWeight:'700',marginBottom:'12px',color:'#4a90d9'}}>{about.title}</h2>
            <p style={{fontSize:'14px',color:'#8899a6',lineHeight:'1.6',margin:0,whiteSpace:'pre-line'}}>{about.description}</p>
          </div>
        )}

        {/* Characters */}
        {isLoading ? (
          <div style={{textAlign:'center',padding:'40px',color:'#8899a6'}}>Loading companions...</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {characters.map(char => (
              <button key={char.id} onClick={() => navigate(`/chat/${char.id}`)}
                style={{backgroundColor:'#243447',border:'1px solid #2d4060',borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'16px',cursor:'pointer',textAlign:'left',transition:'border-color 0.2s'}}
                onMouseOver={e => (e.currentTarget.style.borderColor='#4a90d9')}
                onMouseOut={e => (e.currentTarget.style.borderColor='#2d4060')}>
                <img src={char.avatar} alt={char.name} style={{width:'64px',height:'64px',borderRadius:'32px',objectFit:'cover',border:'2px solid #4a90d9'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:'17px',fontWeight:'700',color:'#fff',marginBottom:'4px'}}>{char.name}</div>
                  <div style={{fontSize:'13px',color:'#8899a6',lineHeight:'1.4'}}>{char.description}</div>
                </div>
                <div style={{color:'#4a90d9',fontSize:'20px'}}>›</div>
              </button>
            ))}
          </div>
        )}

        {/* Crisis note */}
        <div style={{backgroundColor:'#2d1f1f',border:'1px solid #7f1d1d',borderRadius:'12px',padding:'16px',marginTop:'24px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
          <span style={{fontSize:'20px'}}>⚠️</span>
          <div>
            <div style={{fontWeight:'600',color:'#fca5a5',marginBottom:'4px'}}>In immediate danger?</div>
            <div style={{fontSize:'13px',color:'#f87171'}}>Call 999 immediately. For crisis support call Samaritans on <strong>116 123</strong> (free, 24/7)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
