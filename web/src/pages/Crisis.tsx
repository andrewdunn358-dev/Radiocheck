import React from 'react';
import { useNavigate } from 'react-router-dom';

const helplines = [
  { icon:'❤️', name:'Samaritans', desc:'24/7 emotional support for anyone in distress', phone:'116123', phoneDisplay:'116 123', text: null },
  { icon:'🛡️', name:'Combat Stress', desc:"Veterans' mental health charity helpline", phone:'01912704378', phoneDisplay:'0191 270 4378', text:'61212' },
  { icon:'🇬🇧', name:'Veterans UK', desc:'Government welfare and support services', phone:'08081914218', phoneDisplay:'0808 191 4218', text: null },
  { icon:'🤝', name:'SSAFA', desc:'Armed Forces charity supporting veterans and families', phone:'08007314880', phoneDisplay:'0800 731 4880', text: null },
];

export default function Crisis() {
  const navigate = useNavigate();
  return (
    <div style={{minHeight:'100vh',backgroundColor:'#1a2332',color:'#fff'}}>
      {/* Header */}
      <div style={{backgroundColor:'#243447',padding:'16px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid #2d4060'}}>
        <button onClick={() => navigate('/')} style={{background:'none',border:'none',color:'#fff',fontSize:'20px',cursor:'pointer'}}>←</button>
        <h1 style={{margin:0,fontSize:'20px',fontWeight:'700'}}>Crisis Support</h1>
      </div>

      <div style={{maxWidth:'600px',margin:'0 auto',padding:'20px',display:'flex',flexDirection:'column',gap:'16px'}}>

        {/* Emergency Banner */}
        <div style={{backgroundColor:'#cc0000',borderRadius:'12px',padding:'20px',display:'flex',alignItems:'center',gap:'16px'}}>
          <span style={{fontSize:'28px'}}>⚠️</span>
          <div>
            <div style={{fontSize:'20px',fontWeight:'700',marginBottom:'4px'}}>Emergency: Call 999</div>
            <div style={{fontSize:'14px',color:'#ffcccc'}}>For immediate danger, dial 999 directly</div>
          </div>
        </div>

        {/* AI Buddies card */}
        <button onClick={() => navigate('/buddies')}
          style={{backgroundColor:'#243447',border:'1px solid #2d4060',borderRadius:'16px',padding:'16px',display:'flex',alignItems:'center',gap:'16px',cursor:'pointer',textAlign:'left',width:'100%'}}>
          <div style={{display:'flex'}}>
            <img src="/avatars/tommy.png"
              style={{width:'48px',height:'48px',borderRadius:'24px',border:'2px solid #2d4060',objectFit:'cover'}}/>
            <img src="/avatars/doris.png"
              style={{width:'48px',height:'48px',borderRadius:'24px',border:'2px solid #2d4060',objectFit:'cover',marginLeft:'-16px'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:'700',fontSize:'16px',color:'#fff'}}>We're on stag 24/7</div>
            <div style={{fontSize:'14px',color:'#8899a6'}}>Chat with Tommy or Doris</div>
          </div>
          <span style={{color:'#8899a6',fontSize:'20px'}}>›</span>
        </button>

        {/* Helplines */}
        <div style={{fontSize:'16px',fontWeight:'600',color:'#8899a6'}}>Crisis Helplines</div>

        {helplines.map(h => (
          <div key={h.name} style={{backgroundColor:'#243447',borderRadius:'12px',padding:'20px',border:'1px solid #2d4060'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:'16px',marginBottom:'16px'}}>
              <span style={{fontSize:'28px'}}>{h.icon}</span>
              <div>
                <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'4px'}}>{h.name}</div>
                <div style={{fontSize:'14px',color:'#8899a6',lineHeight:'1.5'}}>{h.desc}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:'12px'}}>
              <a href={`tel:${h.phone}`} style={{flex:1,backgroundColor:'#4a90d9',color:'#fff',borderRadius:'8px',padding:'14px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',textDecoration:'none',fontWeight:'600',fontSize:'15px'}}>
                📞 Call {h.phoneDisplay}
              </a>
              {h.text && (
                <a href={`sms:${h.text}`} style={{backgroundColor:'#243447',border:'1px solid #2d4060',color:'#8899a6',borderRadius:'8px',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',textDecoration:'none',fontWeight:'600',fontSize:'14px'}}>
                  💬 Text
                </a>
              )}
            </div>
          </div>
        ))}

        {/* Disclaimer */}
        <div style={{textAlign:'center',fontSize:'12px',color:'#8899a6',padding:'8px'}}>
          ℹ️ All services listed are free and confidential
        </div>
      </div>
    </div>
  );
}
