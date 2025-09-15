import React, { useState } from 'react'
import { apiPost } from '../utils/api'

export default function Chat({ user }){
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState([{ from:'bot', text:'Welcome to FitPortal coach — ask me anything about fitness or medicine (powered by ChatGPT).' }])
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim()) return
    const userMsg = { from: 'user', text: input }
    setMsgs(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    try {
      // send to backend to proxy to OpenAI
      const messages = msgs.filter(Boolean).map(m => ({ role: m.from==='user'?'user':'assistant', content: m.text }))
      messages.push({ role: 'user', content: input })
      const reply = await apiPost('/api/chat', { messages })
      const text = reply.choices?.[0]?.message?.content || 'Sorry, no reply from model.'
      setMsgs(m => [...m, { from:'bot', text }])
    } catch (e) {
      setMsgs(m => [...m, { from:'bot', text: 'Chat failed: ' + e.message }])
    } finally { setLoading(false) }
  }

  return (
    <div className="chat-shell">
      <h3>Coach Chat</h3>
      <div className="chat-window">
        {msgs.map((m,i)=>(
          <div key={i} className={`bubble ${m.from}`}>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about workouts or medicine..." />
        <button className="btn" onClick={send} disabled={loading}>{loading? '...' : 'Send'}</button>
      </div>
    </div>
  )
}
