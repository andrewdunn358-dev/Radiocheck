import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MENU_ITEMS = [
  { title:"Need to Talk?", description:"Connect with support now", icon:"❤️", color:"#3b82f6", bgColor:"#dbeafe", route:"/crisis", isPrimary:true },
  { title:"Talk to a Veteran", description:"Peer support from those who understand", icon:"🪖", color:"#22c55e", bgColor:"#dcfce7", route:"/peer-support" },
  { title:"Warfare on Lawfare", description:"Support for historical investigations", icon:"⚖️", color:"#6366f1", bgColor:"#e0e7ff", route:"/historical-investigations" },
  { title:"Support Organisations", description:"Directory of veteran services", icon:"🏢", color:"#f59e0b", bgColor:"#fef3c7", route:"/organizations" },
  { title:"Self-Care Tools", description:"Journal, grounding, breathing & more", icon:"🌿", color:"#ec4899", bgColor:"#fce7f3", route:"/self-care" },
  { title:"Friends & Family", description:"Worried about a veteran?", icon:"👨‍👩‍👧", color:"#7c3aed", bgColor:"#ede9fe", route:"/family-friends" },
  { title:"Addictions", description:"Alcohol, drugs, gambling & more", icon:"🤲", color:"#d97706", bgColor:"#fef3c7", route:"/substance-support" },
  { title:"Criminal Justice Support", description:"Help for veterans in or leaving prison", icon:"🛡️", color:"#4f46e5", bgColor:"#e0e7ff", route:"/criminal-justice" },
  { title:"Recommended Podcasts", description:"Veteran stories & mental health support", icon:"🎧", color:"#db2777", bgColor:"#fce7f3", route:"/podcasts" },
  { title:"Request a Callback", description:"We'll call you back", icon:"📞", color:"#22c55e", bgColor:"#dcfce7", route:"/callback", isPrimary:true },
];

const AI_TEAM = [
  { name:'Tommy', avatar:'/avatars/tommy.png', description:'Your battle buddy', bio:"Tommy is your straightforward battle buddy. A no-nonsense mate who tells it like it is, but always has your back.", route:'/chat/tommy' },
  { name:'Doris', avatar:'/avatars/doris.png', description:'Warm support', bio:"Doris is a nurturing, compassionate presence who creates a safe space to talk.", route:'/chat/doris' },
  { name:'Bob', avatar:'/avatars/bob.png', description:'Ex-Para peer support', bio:"Bob is a down-to-earth ex-Para who keeps things real and offers honest peer support.", route:'/chat/bob' },
  { name:'Finch', avatar:'/avatars/finch.png', description:'Military law & legal', bio:"Finch has expertise in UK military law and helps veterans understand their legal rights.", route:'/chat/sentry' },
  { name:'Margie', avatar:'/avatars/margie.png', description:'Addiction support', bio:"Margie specialises in supporting those dealing with addiction, offering non-judgemental guidance.", route:'/chat/margie' },
  { name:'Hugo', avatar:'/avatars/hugo.png', description:'Self-help & wellness', bio:"Hugo is a wellbeing coach focused on mental health, resilience and daily habits.", route:'/chat/hugo' },
  { name:'Rita', avatar:'/avatars/rita.png', description:'Family support', bio:"Rita is a warm, grounded family-support companion for partners and loved ones of military personnel.", route:'/chat/rita' },
];

export default function Home() {
  const navigate = useNavigate();
  const [showAITeam, setShowAITeam] = useState(false);
  const [selectedMember, setSelectedMember] = useState<typeof AI_TEAM[0]|null>(null);

  return (
    <div style={{minHeight:'100vh',backgroundColor:'#f8fafc',color:'#1a2332'}}>
      <div style={{backgroundColor:'#fff',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:100}}>
        <div style={{width:'32px'}}/>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
          <img src="/logo.png" alt="Radio Check" style={{width:'40px',height:'40px',objectFit:'contain'}}
            onError={e=>{(e.target as HTMLImageElement).src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📻</text></svg>'}}/>
          <span style={{fontSize:'16px',fontWeight:'700',color:'#1a2332'}}>Radio Check</span>
        </div>
        <button onClick={()=>navigate('/login')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'20px'}} title="Settings">⚙️</button>
      </div>

      <div style={{maxWidth:'500px',margin:'0 auto',padding:'16px'}}>
        <p style={{color:'#64748b',fontSize:'13px',fontStyle:'italic',lineHeight:'1.6',textAlign:'center',margin:'0 0 20px',padding:'0 8px'}}>
          "Radio Check" fuses real-time peer support with smart AI insight, creating more than just an app — it's a digital hand on your shoulder when it matters most.
        </p>

        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'20px'}}>
          {MENU_ITEMS.map(item => (
            <button key={item.title} onClick={()=>navigate(item.route)}
              style={{backgroundColor:'#fff',border:`${item.isPrimary?'2px':'1px'} solid ${item.isPrimary?item.color:'#e2e8f0'}`,borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',textAlign:'left',width:'100%'}}
              onMouseOver={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'}}
              onMouseOut={e=>{e.currentTarget.style.boxShadow='none'}}>
              <div style={{width:'44px',height:'44px',borderRadius:'12px',backgroundColor:item.bgColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',flexShrink:0}}>
                {item.icon}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:'600',fontSize:'15px',color:'#1a2332',marginBottom:'2px'}}>{item.title}</div>
                <div style={{fontSize:'13px',color:'#64748b'}}>{item.description}</div>
              </div>
              <div style={{color:'#94a3b8',fontSize:'20px'}}>›</div>
            </button>
          ))}
        </div>

        <div style={{backgroundColor:'#fff',borderRadius:'16px',border:'1px solid #e2e8f0',overflow:'hidden',marginBottom:'20px'}}>
          <button onClick={()=>setShowAITeam(!showAITeam)}
            style={{width:'100%',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
            <div>
              <div style={{fontWeight:'600',fontSize:'16px',color:'#1a2332'}}>Meet the AI Team</div>
              <div style={{fontSize:'13px',color:'#64748b'}}>Available 24/7 to chat</div>
            </div>
            <span style={{color:'#64748b',fontSize:'14px',fontWeight:'500'}}>{showAITeam?'Hide ▲':'Show ▼'}</span>
          </button>
          {showAITeam && (
            <div style={{borderTop:'1px solid #e2e8f0',padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {AI_TEAM.map(member => (
                <button key={member.name} onClick={()=>setSelectedMember(member)}
                  style={{display:'flex',alignItems:'center',gap:'14px',background:'none',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'12px',cursor:'pointer',textAlign:'left',width:'100%',backgroundColor:'#f8fafc'}}>
                  <img src={member.avatar} alt={member.name} style={{width:'48px',height:'48px',borderRadius:'24px',objectFit:'cover',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:'600',color:'#1a2332',fontSize:'15px'}}>{member.name}</div>
                    <div style={{fontSize:'13px',color:'#64748b'}}>{member.description}</div>
                  </div>
                  <span style={{color:'#94a3b8',fontSize:'20px'}}>›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{textAlign:'center',paddingBottom:'24px'}}>
          <p style={{color:'#94a3b8',fontSize:'12px',marginBottom:'12px'}}>This app is not an emergency service. For immediate danger, always call 999.</p>
          <button onClick={()=>navigate('/login')} style={{background:'none',border:'none',color:'#64748b',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',margin:'0 auto'}}>
            🔒 Staff Portal Login
          </button>
        </div>
      </div>

      {selectedMember && (
        <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000}}
          onClick={()=>setSelectedMember(null)}>
          <div style={{backgroundColor:'#fff',borderRadius:'24px 24px 0 0',padding:'24px',width:'100%',maxWidth:'500px'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'12px'}}>
              <img src={selectedMember.avatar} alt={selectedMember.name} style={{width:'64px',height:'64px',borderRadius:'32px',objectFit:'cover'}}/>
              <div>
                <div style={{fontSize:'20px',fontWeight:'700',color:'#1a2332'}}>{selectedMember.name}</div>
                <div style={{fontSize:'14px',color:'#64748b'}}>{selectedMember.description}</div>
              </div>
            </div>
            <p style={{color:'#64748b',fontSize:'14px',lineHeight:'1.6',marginBottom:'20px'}}>{selectedMember.bio}</p>
            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={()=>{navigate(selectedMember.route);setSelectedMember(null);}}
                style={{flex:1,backgroundColor:'#0d9488',color:'#fff',border:'none',borderRadius:'12px',padding:'14px',fontSize:'16px',fontWeight:'600',cursor:'pointer'}}>
                💬 Chat with {selectedMember.name}
              </button>
              <button onClick={()=>setSelectedMember(null)}
                style={{backgroundColor:'#f1f5f9',border:'none',color:'#64748b',borderRadius:'12px',padding:'14px 20px',fontSize:'14px',cursor:'pointer'}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
