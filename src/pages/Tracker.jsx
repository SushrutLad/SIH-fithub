import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../utils/api'

export default function Tracker(){
  const [meals, setMeals] = useState([])
  const [form, setForm] = useState({ name:'', calories:0 })
  const [summary, setSummary] = useState({ calories:0, points:0 })

  async function load() {
    try {
      const m = await apiGet('/api/tracker/meals')
      setMeals(m)
      const s = await apiGet('/api/tracker/summary')
      setSummary(s)
    } catch(e) { console.log(e) }
  }
  useEffect(()=>{ load() },[])

  async function submit() {
    await apiPost('/api/tracker/meals', form)
    setForm({ name:'', calories:0 })
    load()
  }

  return (
    <div className="tracker-page card">
      <h2>Health Tracker</h2>
      <div className="tracker-grid">
        <div className="tracker-card">
          <h3>Calories today</h3>
          <div className="big">{summary.calories} kcal</div>
        </div>
        <div className="tracker-card">
          <h3>Points</h3>
          <div className="big">{summary.points}</div>
        </div>
        <div className="tracker-card">
          <h3>Log Meal</h3>
          <input placeholder="Food name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <input type="number" placeholder="Calories" value={form.calories} onChange={e=>setForm(f=>({...f,calories:+e.target.value}))} />
          <button className="btn" onClick={submit}>Add</button>
        </div>
      </div>

      <h3>Recent meals</h3>
      <ul>
        {meals.map(m => <li key={m.id}>{m.name} — {m.calories} kcal</li>)}
      </ul>
    </div>
  )
}
