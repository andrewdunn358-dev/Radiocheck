import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';

interface Organization {
  id: string;
  name: string;
  description: string;
  phone?: string;
  sms?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  category?: string;
}

export default function Organizations() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/organizations`)
      .then(r => r.json())
      .then(data => setOrgs(data))
      .catch(() => setOrgs([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{minHeight:'100vh',backgroundColor:'#f8fafc',color:'#1a2332'}}>
      {/* Header */}
      <div style={{backgroundColor:'#fff',padding:'16px 20px',display:'flex',alignItems:'center',gap:'12px',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:100}}>
        <button onClick={()=>navigate('/home',{replace:true})} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#64748b'}}>←</button>
        <h1 style={{margin:0,fontSize:'20px',fontWeight:'700'}}>Support Organisations</h1>
      </div>

      <div style={{maxWidth:'600px',margin:'0 auto',padding:'20px 16px'}}>
        <p style={{color:'#64748b',fontSize:'14px',lineHeight:'1.6',marginBottom:'16px',textAlign:'center'}}>
          A directory of trusted organisations offering free support to UK veterans and their families.
        </p>

        {/* Search */}
        <div style={{position:'relative',marginBottom:'20px'}}>
          <span style={{position:'absolute',left:'14px',top:'50%',transform:'translateY(-50%)',fontSize:'16px'}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search organisations..."
            style={{width:'100%',backgroundColor:'#fff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'12px 14px 12px 42px',fontSize:'15px',color:'#1a2332',outline:'none',boxSizing:'border-box'}}/>
        </div>

        {isLoading ? (
          <div style={{textAlign:'center',padding:'40px',color:'#64748b'}}>Loading organisations...</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {filtered.map(org => (
              <div key={org.id} style={{backgroundColor:'#fff',borderRadius:'14px',border:'1px solid #e2e8f0',padding:'16px'}}>
                <div style={{fontWeight:'700',fontSize:'16px',color:'#1a2332',marginBottom:'6px'}}>{org.name}</div>
                <p style={{fontSize:'13px',color:'#64748b',lineHeight:'1.6',margin:'0 0 14px'}}>{org.description}</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                  {org.phone && (
                    <a href={`tel:${org.phone.replace(/\s/g,'')}`}
                      style={{display:'flex',alignItems:'center',gap:'6px',backgroundColor:'#dbeafe',color:'#1d4ed8',borderRadius:'20px',padding:'7px 14px',fontSize:'13px',fontWeight:'600',textDecoration:'none'}}>
                      📞 {org.phone}
                    </a>
                  )}
                  {org.sms && (
                    <a href={`sms:${org.sms}`}
                      style={{display:'flex',alignItems:'center',gap:'6px',backgroundColor:'#dcfce7',color:'#15803d',borderRadius:'20px',padding:'7px 14px',fontSize:'13px',fontWeight:'600',textDecoration:'none'}}>
                      💬 Text {org.sms}
                    </a>
                  )}
                  {org.whatsapp && (
                    <a href={`https://wa.me/${org.whatsapp}`} target="_blank" rel="noopener noreferrer"
                      style={{display:'flex',alignItems:'center',gap:'6px',backgroundColor:'#dcfce7',color:'#15803d',borderRadius:'20px',padding:'7px 14px',fontSize:'13px',fontWeight:'600',textDecoration:'none'}}>
                      💚 WhatsApp
                    </a>
                  )}
                  {org.email && (
                    <a href={`mailto:${org.email}`}
                      style={{display:'flex',alignItems:'center',gap:'6px',backgroundColor:'#fef3c7',color:'#92400e',borderRadius:'20px',padding:'7px 14px',fontSize:'13px',fontWeight:'600',textDecoration:'none'}}>
                      ✉️ Email
                    </a>
                  )}
                  {org.website && (
                    <a href={org.website} target="_blank" rel="noopener noreferrer"
                      style={{display:'flex',alignItems:'center',gap:'6px',backgroundColor:'#f1f5f9',color:'#475569',borderRadius:'20px',padding:'7px 14px',fontSize:'13px',fontWeight:'600',textDecoration:'none'}}>
                      🌐 Website
                    </a>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{textAlign:'center',padding:'40px',color:'#64748b'}}>
                No organisations found for "{search}"
              </div>
            )}
          </div>
        )}

        <div style={{textAlign:'center',marginTop:'24px',paddingBottom:'24px'}}>
          <p style={{color:'#94a3b8',fontSize:'12px'}}>All services listed are free and confidential 🇬🇧</p>
        </div>
      </div>
    </div>
  );
}
