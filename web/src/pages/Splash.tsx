import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const navigate = useNavigate();
  const [showCookie, setShowCookie] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) setShowCookie(true);
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie_consent', 'true');
    setShowCookie(false);
  };

  return (
    <div style={{minHeight:'100vh',backgroundColor:'#1a2e42',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'40px 24px 32px'}}>
      
      {/* Top section */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'16px',flex:1,justifyContent:'center'}}>
        <img src="/logo.png" alt="Radio Check" style={{width:'100px',height:'100px',objectFit:'contain'}}
          onError={e=>{(e.target as HTMLImageElement).src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📻</text></svg>'}}/>
        <div style={{textAlign:'center'}}>
          <h1 style={{fontSize:'32px',fontWeight:'bold',color:'#fff',margin:'0 0 4px'}}>Radio Check</h1>
          <p style={{color:'#8eb8d4',margin:0,fontSize:'15px'}}>Your Support Network</p>
        </div>

        {/* Tagline box */}
        <div style={{backgroundColor:'rgba(255,255,255,0.08)',borderRadius:'16px',padding:'20px',margin:'8px 0',maxWidth:'380px'}}>
          <p style={{color:'#cbd5e1',fontSize:'14px',fontStyle:'italic',lineHeight:'1.7',textAlign:'center',margin:0}}>
            "Radio Check" fuses real-time peer support with smart AI insight, creating more than just an app — it's a digital hand on your shoulder when it matters most.
          </p>
        </div>

        <button onClick={()=>window.open('https://radiocheck.org.uk/about.html','_blank')}
          style={{background:'none',border:'none',color:'#8eb8d4',fontSize:'14px',cursor:'pointer',textDecoration:'underline',display:'flex',alignItems:'center',gap:'6px'}}>
          ℹ️ Learn more about Radio Check
        </button>

        {/* Main CTA */}
        <div style={{width:'100%',maxWidth:'380px',display:'flex',flexDirection:'column',gap:'12px',marginTop:'16px'}}>
          <p style={{color:'#fff',fontSize:'20px',fontWeight:'600',textAlign:'center',margin:'0 0 8px'}}>
            Do you need to speak with someone right now?
          </p>
          <button onClick={()=>navigate('/crisis')}
            style={{backgroundColor:'#0d9488',color:'#fff',border:'none',borderRadius:'14px',padding:'18px',fontSize:'17px',fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
            💬 Yes, connect me now
          </button>
          <button onClick={()=>navigate('/home')}
            style={{backgroundColor:'transparent',color:'#fff',border:'2px solid rgba(255,255,255,0.3)',borderRadius:'14px',padding:'16px',fontSize:'17px',fontWeight:'500',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
            ⊞ I'm ok, take me to the app
          </button>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'4px'}}>
            <span style={{fontSize:'14px'}}>🛡️</span>
            <span style={{color:'#8eb8d4',fontSize:'13px'}}>In an emergency, always call 999</span>
          </div>
        </div>
      </div>

      {/* Sponsors */}
      <div style={{width:'100%',maxWidth:'380px'}}>
        <p style={{color:'#8eb8d4',fontSize:'11px',textAlign:'center',letterSpacing:'2px',marginBottom:'12px'}}>PROUDLY SUPPORTED BY</p>
        <div style={{display:'flex',gap:'16px',justifyContent:'center',alignItems:'center'}}>
          <img src="/frankies-pod.png" alt="Frankie's Pod" style={{height:'48px',objectFit:'contain',backgroundColor:'#fff',borderRadius:'8px',padding:'4px 8px'}}
            onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
          <img src="/standing-tall.png" alt="Standing Tall" style={{height:'48px',objectFit:'contain',backgroundColor:'#fff',borderRadius:'8px',padding:'4px 8px'}}
            onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
        </div>
      </div>

      {/* Cookie notice */}
      {showCookie && (
        <div style={{position:'fixed',bottom:0,left:0,right:0,backgroundColor:'#243447',padding:'16px 20px',borderTop:'1px solid #2d4060',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px',zIndex:1000}}>
          <p style={{color:'#8899a6',fontSize:'13px',margin:0,flex:1}}>We use cookies to improve your experience.</p>
          <button onClick={acceptCookies} style={{backgroundColor:'#4a90d9',color:'#fff',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',cursor:'pointer',flexShrink:0}}>Accept</button>
        </div>
      )}
    </div>
  );
}
