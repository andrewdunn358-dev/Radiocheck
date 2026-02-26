import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Portal from './pages/Portal';
import AiBuddies from './pages/AiBuddies';
import Chat from './pages/Chat';
import Crisis from './pages/Crisis';

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
          <Route path="/" element={<Home/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/portal" element={<PrivateRoute><Portal/></PrivateRoute>}/>
          <Route path="/buddies" element={<AiBuddies/>}/>
          <Route path="/chat/:characterId" element={<Chat/>}/>
          <Route path="/crisis" element={<Crisis/>}/>
          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
