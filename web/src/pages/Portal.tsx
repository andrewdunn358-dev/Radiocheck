import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function Portal() {
  const {user,logout}=useAuth();
  const navigate=useNavigate();
  return (
    <div style={{minHeight:'100vh',backgroundColor:'#1a2332',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'24px'}}>
        <h1 style={{color:'#fff'}}>Welcome, {user?.name||'Staff Member'}</h1>
        <p style={{color:'#8899a6'}}>Role: {user?.role}</p>
        <p style={{color:'#8899a6'}}>More screens coming soon...</p>
        <button onClick={()=>{logout();navigate('/login');}} style={{backgroundColor:'#ff4444',color:'#fff',border:'none',borderRadius:'12px',height:'48px',padding:'0 32px',fontSize:'16px',cursor:'pointer'}}>Logout</button>
      </div>
    </div>
  );
}
