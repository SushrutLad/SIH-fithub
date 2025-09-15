// helper for API calls
export async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('token')
  const headers = opts.headers || {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch((window.APP_API_URL || '') + path, { ...opts, headers })
  if (!res.ok) {
    const body = await res.json().catch(()=>({}))
    throw new Error(body.error || 'API error')
  }
  return res.json()
}
export const apiGet = (p) => apiFetch(p, { method:'GET' })
export const apiPost = (p, body) => apiFetch(p, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
