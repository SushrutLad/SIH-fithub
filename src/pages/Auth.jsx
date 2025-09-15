import React, { useState } from 'react'
import { apiPost } from '../utils/api'

export default function Auth({ onLogin }){
  const [mode,setMode] = useState('login')
  const [form,setForm] = useState({ username:'', password:'', role:'Newbie' })

  async function submit(){
    try {
      const path = mode==='login' ? '/api/auth/login' : '/api/auth/register'
      const res = await apiPost(path, form)
      if (res.token) {
        onLogin(res.user, res.token)
      }
    } catch (e) { alert('Auth failed: ' + e.message) }
  }

  return (
    <div className="card auth-card">
      <h2>{mode==='login' ? 'Sign In' : 'Register'}</h2>
      <input placeholder="Username" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} />
      <input type="password" placeholder="Password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} />
      {mode==='register' && (
        <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
          <option>Newbie</option>
          <option>Pro</option>
        </select>
      )}
      <button className="btn" onClick={submit}>{mode==='login' ? 'Sign In' : 'Register'}</button>
      <div style={{marginTop:8}}>
        <a href="#" onClick={(e)=>{e.preventDefault(); setMode(m=>m==='login'?'register':'login')}}>
          {mode==='login' ? 'Create account' : 'Have an account? Sign in'}
        </a>
      </div>
    </div>
  )
}
