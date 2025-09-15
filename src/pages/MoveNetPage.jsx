import React, { useEffect, useRef, useState } from 'react'
import { apiPost, apiGet } from '../utils/api'

export default function MoveNetPage({ user }){
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const [tfReady, setTfReady] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [exercises, setExercises] = useState([])
  const [selected, setSelected] = useState('')
  const [fps, setFps] = useState(0)
  const [status, setStatus] = useState('')

  useEffect(()=>{
    // load list of canonical forms from backend
    apiGet('/api/forms').then(setExercises).catch(()=>{})
  },[])

  useEffect(()=>{
    let mounted=true
    ;(async ()=>{
      try {
        const tf = await import('@tensorflow/tfjs')
        await import('@tensorflow/tfjs-backend-webgl')
        await tf.setBackend('webgl')
        const poseDetection = await import('@tensorflow-models/pose-detection')
        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, { modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING })
        if (!mounted) { detector.dispose?.(); return }
        detectorRef.current = detector
        setTfReady(true)
      } catch(e){
        console.error('tf load',e); setStatus('Model load failed — check console.')
      }
    })()
    return ()=>{ mounted=false; detectorRef.current?.dispose?.(); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  },[])

  async function startCam(){
    if (!tfReady) return alert('Model loading...')
    if (camOn) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 }, audio:false })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCamOn(true)
      run()
    } catch(e){ alert('Camera error: ' + e.message) }
  }
  function stopCam(){
    if (!camOn) return
    const s = videoRef.current.srcObject
    if (s) s.getTracks().forEach(t=>t.stop())
    videoRef.current.pause()
    videoRef.current.srcObject = null
    setCamOn(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  async function run(){
    if (!detectorRef.current || !videoRef.current) return
    const det = detectorRef.current; const v = videoRef.current; const c = canvasRef.current; const ctx = c.getContext('2d')
    const step = async ()=>{
      const t0 = performance.now()
      try {
        const poses = await det.estimatePoses(v, { maxPoses: 6, flipHorizontal: false })
        // draw
        c.width = v.videoWidth; c.height = v.videoHeight
        ctx.clearRect(0,0,c.width,c.height)
        ctx.drawImage(v,0,0,c.width,c.height)
        (poses||[]).forEach((p, idx)=>{
          p.keypoints.forEach(k=>{
            if ((k.score||0) > 0.25) {
              ctx.beginPath(); ctx.arc(k.x, k.y, 4, 0, 2*Math.PI); ctx.fillStyle='lime'; ctx.fill()
            }
          })
        })
      } catch(e){ console.error('estimate',e) }
      const t1 = performance.now(); setFps(Math.round(1000/(t1-t0)||0))
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function handleUpload(e){
    const f = e.target.files?.[0]; if (!f) return
    if (f.type !== 'video/mp4') return alert('Only MP4 supported')
    const url = URL.createObjectURL(f)
    const v = videoRef.current
    stopCam()
    v.srcObject = null
    v.src = url
    v.play().then(()=>{ setCamOn(true); run() })
    // also upload to server (optional)
    const fd = new FormData(); fd.append('video', f)
    fetch('/api/upload-video', { method:'POST', body: fd, headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }})
      .then(r=>r.json()).then(j=>console.log('uploaded',j)).catch(()=>{})
  }

  async function evaluateNow(){
    if (!detectorRef.current || !videoRef.current) return alert('Start camera first')
    if (!selected) return alert('Pick exercise to evaluate')
    setStatus('Collecting keypoints...')
    // take a single frame detection
    const p = await detectorRef.current.estimatePoses(videoRef.current, { maxPoses: 1, flipHorizontal: false })
    const person = p?.[0]
    if (!person) { alert('No person detected'); return }
    // create array of 17 keypoints
    const keypoints = person.keypoints.map(k=>({ x: k.x / videoRef.current.videoWidth, y: k.y / videoRef.current.videoHeight, score: k.score }))
    setStatus('Sending to server for evaluation...')
    try {
      const res = await apiPost('/api/evaluate', { exerciseId: selected, keypoints })
      setStatus(`Score: ${res.score}. Points: ${res.points}.`)
      if (res.advice) setStatus(prev => prev + ' Advice: ' + res.advice)
    } catch(e){ setStatus('Eval failed: ' + e.message) }
  }

  return (
    <div className="card movenet-page">
      <h2>MoveNet Live Form Correction</h2>
      <div className="controls">
        <button className="btn" onClick={camOn?stopCam:startCam}>{camOn? 'Stop Camera':'Start Camera'}</button>
        <label className="btn">Upload MP4<input type="file" accept="video/mp4" onChange={handleUpload} style={{display:'none'}}/></label>
        <select value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">-- pick exercise --</option>
          {exercises.map(x=> <option value={x.id} key={x.id}>{x.name}</option>)}
        </select>
        <button className="btn" onClick={evaluateNow}>Evaluate</button>
        <div className="badge">FPS: {fps}</div>
      </div>

      <div className="video-wrap">
        <video ref={videoRef} playsInline muted style={{width:'100%'}} />
        <canvas ref={canvasRef} style={{position:'absolute', left:0, top:0}}/>
      </div>
      <div className="status">{status}</div>
      <div className="note">Tip: ensure whole body is visible. The server will compare to canonical form and award points.</div>
    </div>
  )
}
