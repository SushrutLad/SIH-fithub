import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import MoveNetPage from './pages/MoveNetPage'
import Blog from './pages/Blog'
import Tracker from './pages/Tracker'
import Auth from './pages/Auth'
import Chat from './components/Chat'
import { apiGet } from './utils/api'

export default function App(){
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(()=>{ document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); },[theme])

  useEffect(async ()=>{
    // try load auth from localStorage (token)
    const t = localStorage.getItem('token')
    if (t) {
      try {
        const res = await apiGet('/api/me', t)
        setUser(res.user)
      } catch(e) { console.log('no auth') }
    }
  },[])

  function onLogin(user, token){
    setUser(user)
    localStorage.setItem('token', token)
    navigate('/')
  }
  function onLogout(){
    setUser(null)
    localStorage.removeItem('token')
    navigate('/auth')
  }

  return (
    <div className="app-root">
      <nav className="topbar">
        <div className="brand">
          <Link to="/"><strong>FitPortal</strong></Link>
        </div>
        <div className="nav-actions">
          <button className="btn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>
            {theme==='dark'? 'Light' : 'Dark'}
          </button>
          {user ? (
            <div className="user-area">
              <span className="user-pill">{user.username} ({user.role})</span>
              <button className="btn" onClick={onLogout}>Logout</button>
            </div>
          ) : (
            <Link to="/auth" className="btn">Sign In</Link>
          )}
        </div>
      </nav>

      <div className="layout">
        <aside className="left-chat">
          <Chat user={user} />
        </aside>

        <main className="main-area">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/movenet" element={<MoveNetPage user={user} />} />
            <Route path="/blog" element={<Blog user={user} />} />
            <Route path="/tracker" element={<Tracker user={user} />} />
            <Route path="/auth" element={<Auth onLogin={onLogin} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
