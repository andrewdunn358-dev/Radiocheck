import React from 'react';
import { useNavigate } from 'react-router-dom';

const TOOLS = [
  { id:'screening', title:'Mental Health Check', description:'PHQ-9 & GAD-7 assessments', icon:'📋', color:'#3b82f6', bgColor:'#dbeafe', route:'/mental-health-screening' },
  { id:'journal', title:'My Journal', description:'Write down your thoughts', icon:'📔', color:'#3b82f6', bgColor:'#dbeafe', route:'/journal' },
  { id:'mood', title:'Daily Check-in', description:"Track how you're feeling", icon:'😊', color:'#f59e0b', bgColor:'#fef3c7', route:'/mood' },
  { id:'grounding', title:'Grounding Tools', description:'5-4-3-2-1 and more techniques', icon:'🤚', color:'#22c55e', bgColor:'#dcfce7', route:'/grounding' },
  { id:'breathing', title:'Breathing Exercises', description:'Box breathing & relaxation', icon:'🌬️', color:'#06b6d4', bgColor:'#cffafe', route:'/breathing' },
  { id:'buddy-finder', title:'Buddy Finder', description:'Connect with veterans near you', icon:'🤝', color:'#10b981', bgColor:'#d1fae5', route:'/buddy-finder' },
  { id:'regimental', title:'Regimental Associations', description:'Find your regiment network', icon:'🚩', color:'#ef4444', bgColor:'#fee2e2', route:'/regimental-associations' },
  { id:'local-services', title:'Find Local Support', description:'Services near you', icon:'📍', color:'#8b5cf6', bgColor:'#ede9fe', route:'/local-services' },
  { id:'resources', title:'Resources Library', description:'Helpful information', icon:'📚', color:'#ec4899', bgColor:'#fce7f3', route:'/resources' },
];

export default function SelfCare() {
  const navigate = useNavigate();

  return (
    <div style={{minHeight:'100vh',backgroundColor:'#f8fafc',color:'#1a2332'}}>
      {/* Header */}
      <div style={{backgroundColor:'#fff',padding:'16px 20px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:100}}>
        <button onClick={()=>navigate('/home',{replace:true})} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#64748b'}}>←</button>
        <h1 style={{margin:0,fontSize:'20px',fontWeight:'700'}}>Self-Care Tools</h1>
      </div>

      <div style={{maxWidth:'500px',margin:'0 auto',padding:'20px 16px'}}>

        {/* Catherine AI card */}
        <button onClick={()=>navigate('/chat/catherine')}
          style={{width:'100%',backgroundColor:'#1a2332',borderRadius:'16px',padding:'20px',marginBottom:'20px',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'16px'}}>
          <img src="/avatars/catherine.png" alt="Catherine"
            style={{width:'64px',height:'64px',borderRadius:'32px',objectFit:'cover',border:'2px solid #4a90d9',flexShrink:0}}
            onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:'700',fontSize:'16px',color:'#fff',marginBottom:'4px'}}>Talk to Catherine</div>
            <div style={{fontSize:'13px',color:'#8899a6',lineHeight:'1.5'}}>Your AI self-care companion — available 24/7 for wellbeing support, coping strategies and daily check-ins.</div>
          </div>
          <span style={{color:'#4a90d9',fontSize:'20px'}}>›</span>
        </button>

        {/* Tools grid */}
        <div style={{fontSize:'13px',fontWeight:'600',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'12px'}}>Tools & Resources</div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {TOOLS.map(tool => (
            <button key={tool.id} onClick={()=>navigate(tool.route)}
              style={{backgroundColor:'#fff',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',textAlign:'left',width:'100%'}}
              onMouseOver={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'}}
              onMouseOut={e=>{e.currentTarget.style.boxShadow='none'}}>
              <div style={{width:'44px',height:'44px',borderRadius:'12px',backgroundColor:tool.bgColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',flexShrink:0}}>
                {tool.icon}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:'600',fontSize:'15px',color:'#1a2332',marginBottom:'2px'}}>{tool.title}</div>
                <div style={{fontSize:'13px',color:'#64748b'}}>{tool.description}</div>
              </div>
              <div style={{color:'#94a3b8',fontSize:'20px'}}>›</div>
            </button>
          ))}
        </div>

        <div style={{textAlign:'center',marginTop:'24px',paddingBottom:'24px'}}>
          <p style={{color:'#94a3b8',fontSize:'12px'}}>Small steps every day make a big difference 🌱</p>
        </div>
      </div>
    </div>
  );
}
