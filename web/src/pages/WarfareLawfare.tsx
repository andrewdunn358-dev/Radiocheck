import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';

const SUPPORT_SERVICES = [
  { name:'Public Law Project', description:'Free legal advice and support for veterans facing historical investigations and public law challenges.', phone:'020 7843 1260' },
  { name:'Veterans Legal Link', description:'Specialist legal referral service connecting veterans with pro bono and affordable legal representation.', phone:'0800 144 8848' },
  { name:'Royal British Legion', description:'Welfare support, legal guidance and advocacy for veterans involved in investigations or legal proceedings.', phone:'0808 802 8080' },
  { name:'SSAFA', description:'Confidential support and advice for veterans and their families navigating legal and welfare issues.', phone:'0800 731 4880' },
];

export default function WarfareLawfare() {
  const navigate = useNavigate();

  return (
    <div style={{minHeight:'100vh',backgroundColor:'#f8fafc',color:'#1a2332'}}>
      <div style={{backgroundColor:'#fff',padding:'16px 20px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:100}}>
        <button onClick={()=>navigate('/home',{replace:true})} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#64748b'}}>←</button>
        <h1 style={{margin:0,fontSize:'20px',fontWeight:'700'}}>Warfare on Lawfare</h1>
      </div>

      <div style={{maxWidth:'600px',margin:'0 auto',padding:'20px 16px'}}>

        {/* Finch AI card */}
        <button onClick={()=>navigate('/chat/sentry')}
          style={{width:'100%',backgroundColor:'#1a2332',borderRadius:'16px',padding:'20px',marginBottom:'20px',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'16px'}}>
          <img src="/avatars/finch.png" alt="Finch"
            style={{width:'64px',height:'64px',borderRadius:'32px',objectFit:'cover',border:'2px solid #6366f1',flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:'700',fontSize:'16px',color:'#fff',marginBottom:'4px'}}>Talk to Finch</div>
            <div style={{fontSize:'13px',color:'#8899a6',lineHeight:'1.5'}}>AI Legal Support Companion — confidential support for veterans facing historical investigations, available 24/7.</div>
          </div>
          <span style={{color:'#6366f1',fontSize:'20px'}}>›</span>
        </button>

        {/* What is it */}
        <div style={{backgroundColor:'#fff',borderRadius:'14px',border:'1px solid #e2e8f0',padding:'20px',marginBottom:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
            <span style={{fontSize:'24px'}}>⚖️</span>
            <div style={{fontWeight:'700',fontSize:'17px',color:'#1a2332'}}>What is Warfare on Lawfare?</div>
          </div>
          <p style={{fontSize:'14px',color:'#64748b',lineHeight:'1.7',margin:0}}>
            Many UK veterans face posthumous or historical investigations into their conduct during service. These investigations can be deeply traumatic, affecting mental health, finances and family life. You are not alone — support is available.
          </p>
        </div>

        {/* Your rights */}
        <div style={{backgroundColor:'#fff',borderRadius:'14px',border:'1px solid #e2e8f0',padding:'20px',marginBottom:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
            <span style={{fontSize:'24px'}}>🛡️</span>
            <div style={{fontWeight:'700',fontSize:'17px',color:'#1a2332'}}>Your Rights</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {[
              'You have the right to legal representation',
              'You do not have to face an investigation alone',
              'You are entitled to mental health support',
              'Your service record speaks for itself',
              'Speak to a solicitor before making any statements',
            ].map(right => (
              <div key={right} style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
                <span style={{color:'#22c55e',flexShrink:0,marginTop:'1px'}}>✓</span>
                <span style={{fontSize:'14px',color:'#475569',lineHeight:'1.5'}}>{right}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Peer support link */}
        <button onClick={()=>navigate('/peer-support')}
          style={{width:'100%',backgroundColor:'#fff',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',marginBottom:'20px',textAlign:'left'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{fontSize:'24px'}}>🪖</span>
            <div>
              <div style={{fontWeight:'600',fontSize:'15px',color:'#1a2332'}}>Find peer supporters</div>
              <div style={{fontSize:'13px',color:'#64748b'}}>Talk to veterans who've been through it</div>
            </div>
          </div>
          <span style={{color:'#3b82f6',fontSize:'20px'}}>›</span>
        </button>

        {/* Support services */}
        <div style={{fontSize:'18px',fontWeight:'700',color:'#1a2332',marginBottom:'16px'}}>Veteran Welfare Organisations</div>
        <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'20px'}}>
          {SUPPORT_SERVICES.map(service => (
            <div key={service.name} style={{backgroundColor:'#fff',borderRadius:'12px',border:'1px solid #e2e8f0',padding:'20px'}}>
              <div style={{fontWeight:'700',fontSize:'16px',color:'#1a2332',marginBottom:'6px'}}>{service.name}</div>
              <p style={{fontSize:'14px',color:'#64748b',lineHeight:'1.6',margin:'0 0 14px'}}>{service.description}</p>
              <a href={`tel:${service.phone.replace(/\s/g,'')}`}
                style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',backgroundColor:'#3b82f6',color:'#fff',borderRadius:'8px',padding:'12px',fontSize:'15px',fontWeight:'600',textDecoration:'none'}}>
                📞 Call Now
              </a>
            </div>
          ))}
        </div>

        {/* Reassurance */}
        <div style={{backgroundColor:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'12px',padding:'20px',marginBottom:'16px',display:'flex',gap:'16px',alignItems:'flex-start'}}>
          <span style={{fontSize:'24px'}}>🛡️</span>
          <div>
            <div style={{fontWeight:'700',fontSize:'16px',color:'#166534',marginBottom:'6px'}}>Non-judgemental support</div>
            <p style={{fontSize:'14px',color:'#15803d',lineHeight:'1.6',margin:0}}>All support services listed here provide confidential, non-judgemental help. We make no assumptions and offer support regardless of circumstances.</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{backgroundColor:'#fff',borderRadius:'8px',border:'1px solid #e2e8f0',padding:'16px',marginBottom:'24px'}}>
          <p style={{fontSize:'12px',color:'#94a3b8',textAlign:'center',lineHeight:'1.6',margin:0}}>
            If you feel at immediate risk of harming yourself or others, call 999 or use the Crisis Support page.
          </p>
        </div>
      </div>
    </div>
  );
}
