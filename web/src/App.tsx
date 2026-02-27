import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Splash from './pages/Splash';
import Home from './pages/Home';
import Login from './pages/Login';
import Portal from './pages/Portal';
import AiBuddies from './pages/AiBuddies';
import Chat from './pages/Chat';
import Crisis from './pages/Crisis';
import Callback from './pages/Callback';
import Podcasts from './pages/Podcasts';
import PeerSupport from './pages/PeerSupport';
import Organizations from './pages/Organizations';
import SelfCare from './pages/SelfCare';
import WarfareLawfare from './pages/WarfareLawfare';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const {user,isLoading}=useAuth();
  if(isLoading) return <div style={{color:'#fff',textAlign:'center',marginTop:'40vh'}}>Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login"/>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Splash/>}/>
          <Route path="/home" element={<Home/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/portal" element={<PrivateRoute><Portal/></PrivateRoute>}/>
          <Route path="/buddies" element={<AiBuddies/>}/>
          <Route path="/chat/:characterId" element={<Chat/>}/>
          <Route path="/crisis" element={<Crisis/>}/>
          <Route path="/callback" element={<Callback/>}/>
          <Route path="/podcasts" element={<Podcasts/>}/>
          <Route path="/peer-support" element={<PeerSupport/>}/>
          <Route path="/organizations" element={<Organizations/>}/>
          <Route path="/self-care" element={<SelfCare/>}/>
          <Route path="/historical-investigations" element={<WarfareLawfare/>}/>
          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
