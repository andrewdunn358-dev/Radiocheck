import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const MENU_ITEMS = [
  { title:"Need to Talk?", description:"Connect with support now", icon:"❤️", color:"#3b82f6", bgColor:"#dbeafe", route:"/crisis", isPrimary:true },
  { title:"AI Battle Buddies", description:"Talk to a veteran AI companion", icon:"🤖", color:"#8b5cf6", bgColor:"#ede9fe", route:"/buddies" },
  { title:"Talk to a Veteran", description:"Peer support from those who understand", icon:"🪖", color:"#22c55e", bgColor:"#dcfce7", route:"/peer-support" },
  { title:"Warfare on Lawfare", description:"Support for historical investigations", icon:"⚖️", color:"#6366f1", bgColor:"#e0e7ff", route:"/historical-investigations" },
  { title:"Support Organisations", description:"Directory of veteran services", icon:"🏢", color:"#f59e0b", bgColor:"#fef3c7", route:"/organizations" },
  { title:"Self-Care Tools", description:"Journal, grounding, breathing & more", icon:"🌿", color:"#ec4899", bgColor:"#fce7f3", route:"/self-care" },
  { title:"Friends & Family", description:"Worried about a veteran?", icon:"👨‍👩‍👧", color:"#7c3aed", bgColor:"#ede9fe", route:"/family-friends" },
  { title:"Addictions", description:"Alcohol, drugs, gambling & more", icon:"🤲", color:"#d97706", bgColor:"#fef3c7", route:"/substance-support" },
  { title:"Criminal Justice", description:"Help for veterans in or leaving prison", icon:"🛡️", color:"#4f46e5", bgColor:"#e0e7ff", route:"/criminal-justice" },
  { title:"Recommended Podcasts", description:"Veteran stories & mental health support", icon:"🎧", color:"#db2777", bgColor:"#fce7f3", route:"/podcasts" },
  { title:"Request a Callback", description:"We'll call you back", icon:"📞", color:"#22c55e", bgColor:"#dcfce7", route:"/callback" },
];

const AI_TEAM = [
  { name:'Tommy', avatar:'https://customer-assets.emergentagent.com/job_47488e3d-c9ce-4f22-ba89-b000b32c4954/artifacts/slx9i8gj_image.png', route:'/chat/tommy' },
  { name:'Doris', avatar:'https://customer-assets.emergentagent.com/job_47488e3d-c9ce-4f22-ba89-b000b32c4954/artifacts/1cxzxfrj_image.png', route:'/chat/doris' },
  { name:'Bob', avatar:'https://static.prod-images.emergentagent.com/jobs/e42bf70a-a287-4141-b70d-0728db3b1a3c/images/5ccb4f3dba33762dc691a5023cd5a26342d43ef9a7e95308f48f38301df65f8c.png', route:'/chat/bob' },
  { name:'Finch', avatar:'https://static.prod-images.emergentagent.com/jobs/26fef91b-7832-48ee-9b54-6cd204a344d5/images/f2058ae7a5d15ff3f002514d4ada7039eeddf405b897ae4fc1f0a68a1114e1d8.png', route:'/chat/sentry' },
  { name:'Margie', avatar:'https://static.prod-images.emergentagent.com/jobs/fba61e42-5a99-4622-a43b-84a14c5bcf87/images/313a20c933febb69cc523b6b3647ba814a5b9123a3ea7f674f7a87695a8a4789.png', route:'/chat/margie' },
  { name:'Hugo', avatar:'https://static.prod-images.emergentagent.com/jobs/56155002-fa62-4b53-8fda-4baf701ab83f/images/6be1ae886e76d7b380a66ef3eb98c183e26882fe8e9897aab7e8a8ad4320acb9.png', route:'/chat/hugo' },
  { name:'Rita', avatar:'https://static.prod-images.emergentagent.com/jobs/bf7a0a9a-b52d-4db3-b85e-aedfe9959d59/images/fd3c1add3b95c627676f7848bc963c3e1afe0b7c3e1187304df81ea307705318.png', route:'/chat/rita' },
];

export default function Home() {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 1800);
    const t2 = setTimeout(() => setShowSplash(false), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (showSplash) {
    return (
      <div style={{minHeight:'100vh',backgroundColor:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'20px',opacity:fadeOut?0:1,transition:'opacity 0.4s'}}>
        <img src="/logo.png" alt="Radio Check" style={{width:'100px',height:'100px',objectFit:'contain'}}
          onError={e=>{(e.target as HTMLImageElement).src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📻</text></svg>'}}/>
        <h1 style={{fontSize:'28px',fontWeight:'bold',color:'#1a2332',margin:0}}>Radio Check</h1>
        <p style={{color:'#8899a6',margin:0,fontSize:'14px'}}>Veterans Mental Health Support</p>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',backgroundColor:'#f8fafc',color:'#1a2332'}}>
      {/* Header */}
      <div style={{backgroundColor:'#fff',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <img src="/logo.png" alt="Radio Check" style={{width:'36px',height:'36px',objectFit:'contain'}}
            onError={e=>{(e.target as HTMLImageElement).src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📻</text></svg>'}}/>
          <div>
            <div style={{fontWeight:'700',fontSize:'18px',color:'#1a2332'}}>Radio Check</div>
            <div style={{fontSize:'11px',color:'#8899a6'}}>Veterans Mental Health</div>
          </div>
        </div>
        <button onClick={()=>navigate('/login')}
          style={{background:'none',border:'1px solid #e2e8f0',borderRadius:'8px',color:'#64748b',padding:'6px 12px',fontSize:'13px',cursor:'pointer',backgroundColor:'#f8fafc'}}>
          ⚙️ Staff
        </button>
      </div>

      <div style={{maxWidth:'600px',margin:'0 auto',padding:'20px'}}>
        {/* Tagline */}
        <div style={{textAlign:'center',marginBottom:'24px',padding:'0 16px'}}>
          <p style={{color:'#64748b',fontSize:'14px',fontStyle:'italic',lineHeight:'1.6',margin:0}}>
            "Radio Check" fuses real-time peer support with smart AI insight, creating more than just an app — it's a digital hand on your shoulder when it matters most.
          </p>
        </div>

        {/* AI Team Carousel */}
        <div style={{backgroundColor:'#fff',borderRadius:'16px',padding:'16px',marginBottom:'16px',border:'1px solid #e2e8f0'}}>
          <div style={{fontSize:'12px',fontWeight:'600',color:'#64748b',marginBottom:'12px',textTransform:'uppercase',letterSpacing:'1px'}}>Your AI Battle Buddies</div>
          <div style={{display:'flex',gap:'16px',overflowX:'auto',paddingBottom:'4px',scrollbarWidth:'none'}}>
            {AI_TEAM.map(member => (
              <button key={member.name} onClick={()=>navigate(member.route)}
                style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px',background:'none',border:'none',cursor:'pointer',flexShrink:0}}>
                <div style={{position:'relative'}}>
                  <img src={member.avatar} alt={member.name} style={{width:'56px',height:'56px',borderRadius:'28px',objectFit:'cover',border:'2px solid #e2e8f0'}}/>
                  <div style={{position:'absolute',bottom:'2px',right:'2px',width:'10px',height:'10px',backgroundColor:'#22c55e',borderRadius:'5px',border:'2px solid #fff'}}/>
                </div>
                <span style={{fontSize:'11px',color:'#64748b',fontWeight:'500'}}>{member.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {MENU_ITEMS.map(item => (
            <button key={item.title} onClick={()=>navigate(item.route)}
              style={{backgroundColor:'#fff',border:`${item.isPrimary?'2px':'1px'} solid ${item.isPrimary?item.color:'#e2e8f0'}`,borderRadius:'14px',padding:'14px 16px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',textAlign:'left',width:'100%',transition:'transform 0.1s,box-shadow 0.1s'}}
              onMouseOver={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'}}
              onMouseOut={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
              <div style={{width:'48px',height:'48px',borderRadius:'12px',backgroundColor:item.bgColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',flexShrink:0}}>
                {item.icon}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:'600',fontSize:'15px',color:'#1a2332',marginBottom:'2px'}}>{item.title}</div>
                <div style={{fontSize:'13px',color:'#64748b'}}>{item.description}</div>
              </div>
              <div style={{color:'#94a3b8',fontSize:'18px'}}>›</div>
            </button>
          ))}
        </div>

        <div style={{textAlign:'center',marginTop:'24px',paddingBottom:'20px'}}>
          <p style={{color:'#94a3b8',fontSize:'13px'}}>Built with care for those who served 🇬🇧</p>
        </div>
      </div>
    </div>
  );
}
