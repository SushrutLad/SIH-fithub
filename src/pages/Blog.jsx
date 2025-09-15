import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../utils/api'

export default function Blog({ user }){
  const [posts, setPosts] = useState([])
  const [newPost, setNewPost] = useState({ title:'', content:'' })

  async function load(){ setPosts(await apiGet('/api/posts')) }
  useEffect(()=>{ load() },[])

  async function submit(){
    if (!newPost.title || !newPost.content) return alert('fill')
    await apiPost('/api/posts', newPost)
    setNewPost({ title:'', content:''}); load()
  }

  return (
    <div className="card blog-page">
      <h2>Community Blog</h2>
      {user ? (
        <div className="new-post">
          <input placeholder="Title" value={newPost.title} onChange={e=>setNewPost(n=>({...n,title:e.target.value}))} />
          <textarea placeholder="Write..." value={newPost.content} onChange={e=>setNewPost(n=>({...n,content:e.target.value}))} />
          <button className="btn" onClick={submit}>Post</button>
        </div>
      ) : <div>Please log in to post comments.</div>}
      <div className="posts">
        {posts.map(p => (
          <article key={p.id} className="post">
            <h4>{p.title}</h4>
            <div className="meta">{p.author} • {p.role} • {p.created_at}</div>
            <p>{p.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
