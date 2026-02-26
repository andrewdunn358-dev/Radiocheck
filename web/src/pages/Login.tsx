import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function Login() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [isLoading,setIsLoading]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  const {login}=useAuth();
  const handleLogin=async()=>{
    if(!email||!password){setError('Please enter email and password');return;}
    setError('');setIsLoading(true);
    const result=await login(email,password);
    setIsLoading(false);
    if(result.success){navigate('/portal');}else{setError(result.error||'Invalid credentials');}
  };
  return (
    <div style={{minHeight:'100vh',backgroundColor:'#1a2332',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:'420px',padding:'20px',display:'flex',flexDirection:'column',gap:'16px'}}>
        <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:'#fff',fontSize:'16px',cursor:'pointer',textAlign:'left'}}>← Back</button>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:'24px'}}>
          <div style={{fontSize:'60px'}}>🛡️</div>
          <h1 style={{fontSize:'28px',fontWeight:'bold',color:'#fff',margin:'12px 0 4px'}}>Staff Portal</h1>
          <p style={{fontSize:'16px',color:'#8899a6',margin:'0'}}>Login to manage your availability</p>
        </div>
        {error&&<div style={{backgroundColor:'#ff4444',color:'#fff',padding:'12px',borderRadius:'8px',fontSize:'14px'}}>{error}</div>}
        <div style={{display:'flex',alignItems:'center',backgroundColor:'#243447',borderRadius:'12px',padding:'0 16px',height:'56px'}}>
          <span style={{marginRight:'12px'}}>✉️</span>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{flex:1,background:'none',border:'none',color:'#fff',fontSize:'16px',outline:'none'}}/>
        </div>
        <div style={{display:'flex',alignItems:'center',backgroundColor:'#243447',borderRadius:'12px',padding:'0 16px',height:'56px'}}>
          <span style={{marginRight:'12px'}}>🔒</span>
          <input type={showPassword?'text':'password'} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{flex:1,background:'none',border:'none',color:'#fff',fontSize:'16px',outline:'none'}}/>
          <button onClick={()=>setShowPassword(!showPassword)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'18px'}}>{showPassword?'🙈':'👁️'}</button>
        </div>
        <button onClick={handleLogin} disabled={isLoading} style={{backgroundColor:'#4a90d9',color:'#fff',border:'none',borderRadius:'12px',height:'56px',fontSize:'18px',fontWeight:'600',cursor:'pointer',opacity:isLoading?0.7:1}}>
          {isLoading?'Logging in...':'Login'}
        </button>
        <button onClick={()=>navigate('/forgot-password')} style={{background:'none',border:'none',color:'#4a90d9',fontSize:'14px',cursor:'pointer'}}>Forgot Password?</button>
        <p style={{color:'#8899a6',fontSize:'14px',textAlign:'center'}}>For Admin, Counsellors & Peer Supporters</p>
      </div>
    </div>
  );
}
