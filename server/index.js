// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const OPENAI_KEY = process.env.OPENAI_API_KEY || 'sk-5678mnopqrstuvwx5678mnopqrstuvwx5678mnop';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } }); // limit 200MB

// helpers
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing auth' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// AUTH
app.post('/api/auth/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing' });
  const hash = bcrypt.hashSync(password, 8);
  try {
    const info = db.prepare('INSERT INTO users (username,password,role,points) VALUES (?,?,?,0)').run(username, hash, role || 'Newbie');
    const user = db.prepare('SELECT id,username,role,points FROM users WHERE id=?').get(info.lastInsertRowid);
    const token = generateToken(user);
    res.json({ user, token });
  } catch (e) {
    res.status(400).json({ error: 'User exists' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user) return res.status(400).json({ error: 'Invalid' });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Invalid' });
  const safe = { id: user.id, username: user.username, role: user.role, points: user.points };
  const token = generateToken(safe);
  res.json({ user: safe, token });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id,username,role,points FROM users WHERE id=?').get(req.user.id);
  res.json({ user });
});

// POSTS (blog)
app.get('/api/posts', (req, res) => {
  const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  res.json(rows);
});
app.post('/api/posts', authMiddleware, (req, res) => {
  const { title, content } = req.body;
  const user = db.prepare('SELECT username,role FROM users WHERE id=?').get(req.user.id);
  const info = db.prepare('INSERT INTO posts (author, role, title, content) VALUES (?,?,?,?)').run(user.username, user.role, title, content);
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(info.lastInsertRowid);
  res.json(post);
});

// TRACKER (simple meals)
app.get('/api/tracker/meals', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM tracker_meals WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});
app.post('/api/tracker/meals', authMiddleware, (req, res) => {
  const { name, calories } = req.body;
  const info = db.prepare('INSERT INTO tracker_meals (user_id, name, calories) VALUES (?,?,?)').run(req.user.id, name, calories);
  const row = db.prepare('SELECT * FROM tracker_meals WHERE id=?').get(info.lastInsertRowid);
  res.json(row);
});

// UPLOAD video (store file)
app.post('/api/upload-video', authMiddleware, upload.single('video'), (req, res) => {
  res.json({ path: `/uploads/${path.basename(req.file.path)}`, filename: req.file.originalname });
});
app.use('/uploads', express.static(uploadDir));

// FORMS DB: list canonical forms
app.get('/api/forms', (req, res) => {
  const rows = db.prepare('SELECT id,name,description,json FROM canonical_forms').all();
  const parsed = rows.map(r => ({ id: r.id, name: r.name, description: r.description, json: JSON.parse(r.json) }));
  res.json(parsed);
});
app.get('/api/forms/:id', (req, res) => {
  const row = db.prepare('SELECT id,name,description,json FROM canonical_forms WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ id: row.id, name: row.name, description: row.description, json: JSON.parse(row.json) });
});

// EVALUATE: compute similarity between provided keypoints and canonical
function normalizeKeypoints(rawKeypoints) {
  // rawKeypoints: [{x,y,score}, ...] in absolute pixels or normalized 0..1. We assume normalized [0..1].
  // Convert to array of [x,y] for 17 points (fill missing)
  const arr = [];
  for (let i=0;i<17;i++) {
    const k = rawKeypoints[i] || {x:0.5,y:0.5,score:0};
    arr.push([k.x,k.y,k.score || 0]);
  }
  // center at midpoint of hips (indices 11 and 12 in MoveNet ordering)
  const hipL = arr[11], hipR = arr[12];
  const cx = (hipL[0] + hipR[0]) / 2;
  const cy = (hipL[1] + hipR[1]) / 2;
  // scale by shoulder distance
  const shL = arr[5], shR = arr[6];
  const shoulderDist = Math.hypot(shL[0]-shR[0], shL[1]-shR[1]) || 0.5;
  const norm = arr.map(k => [(k[0]-cx)/shoulderDist, (k[1]-cy)/shoulderDist, k[2]]);
  return norm;
}

app.post('/api/evaluate', authMiddleware, (req, res) => {
  const { exerciseId, keypoints } = req.body;
  if (!exerciseId || !keypoints) return res.status(400).json({ error: 'Missing' });
  const row = db.prepare('SELECT json FROM canonical_forms WHERE id=?').get(exerciseId);
  if (!row) return res.status(404).json({ error: 'Unknown exercise' });
  const canonical = JSON.parse(row.json).keypoints;
  // normalize both
  const normCanon = normalizeKeypoints(canonical);
  const normUser = normalizeKeypoints(keypoints);
  // compute average distance across visible keypoints
  let sum = 0; let count=0;
  for (let i=0;i<17;i++) {
    const u = normUser[i], c = normCanon[i];
    if (u[2] > 0.25) {
      const d = Math.hypot(u[0]-c[0], u[1]-c[1]);
      sum += d; count++;
    }
  }
  const avg = count ? (sum / count) : 1.0;
  // score: 100 - clamp(avg*200)
  let score = Math.max(0, Math.round(100 - Math.min(100, avg * 200)));
  // points as 0..10
  const points = Math.round(score / 10);
  // store evaluation
  db.prepare('INSERT INTO evaluations (user_id, exercise_id, score, points) VALUES (?,?,?,?)').run(req.user.id, exerciseId, score, points);
  // add points to user record
  db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(points, req.user.id);
  const user = db.prepare('SELECT id,username,role,points FROM users WHERE id=?').get(req.user.id);
  // optional: use OpenAI to craft feedback (if key available)
  async function craftAdvice() {
    if (!OPENAI_KEY) return null;
    try {
      const prompt = `You are a helpful fitness coach. The user performed exercise ${exerciseId} and scored ${score}/100. Give three brief tips to improve form.`;
      const body = {
        model: "gpt-4o-mini", // or "gpt-4o" / "gpt-4" depending on availability
        messages: [{role:'user',content:prompt}],
        max_tokens: 250
      };
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) return null;
      const j = await r.json();
      const advice = j.choices?.[0]?.message?.content || null;
      return advice;
    } catch(e) { console.error('openai',e); return null; }
  }
  craftAdvice().then(advice => {
    res.json({ score, points, user, advice });
  }).catch(() => {
    res.json({ score, points, user });
  });
});

// CHAT proxy to OpenAI (requires OPENAI_API_KEY)
app.post('/api/chat', authMiddleware, async (req, res) => {
  const { messages } = req.body;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured on server' });
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 800
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Chat failed' });
  }
});

// GET user evaluations & points
app.get('/api/evaluations', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM evaluations WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

// health summary (calories today etc) - simple aggregation
app.get('/api/tracker/summary', authMiddleware, (req, res) => {
  const meals = db.prepare('SELECT SUM(calories) as total FROM tracker_meals WHERE user_id=?').get(req.user.id);
  res.json({ calories: meals.total || 0, points: db.prepare('SELECT points FROM users WHERE id=?').get(req.user.id).points });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Server running on', PORT));
