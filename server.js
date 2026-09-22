const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'notifications.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const activeTokens = new Set();

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: '未授权访问' });
  }
  next();
}

/* ===== WebSocket ===== */
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`局域网访问: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`管理员密码: ${ADMIN_PASSWORD}`);
});

const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  }
}

/* ===== API ===== */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = generateToken();
    activeTokens.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

app.get('/api/notifications', (req, res) => {
  const data = loadData();
  res.json(data.sort((a, b) => b.timestamp - a.timestamp));
});

app.get('/api/qrcode', async (req, res) => {
  try {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const url = `${proto}://${host}`;
    const qr = await QRCode.toDataURL(url, { width: 300, margin: 1 });
    res.json({ url, qr });
  } catch {
    res.status(500).json({ error: '生成二维码失败' });
  }
});

app.post('/api/notifications', authMiddleware, (req, res) => {
  const { title, content, level } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }
  const data = loadData();
  const notice = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title.trim(),
    content: content.trim(),
    level: level || 'normal',
    timestamp: Date.now(),
    pinned: false
  };
  data.push(notice);
  saveData(data);
  broadcast({ type: 'update', data: data.sort((a, b) => b.timestamp - a.timestamp) });
  res.json({ success: true, notice });
});

app.delete('/api/notifications/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const data = loadData();
  const idx = data.findIndex(n => n.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: '通知不存在' });
  }
  data.splice(idx, 1);
  saveData(data);
  broadcast({ type: 'update', data: data.sort((a, b) => b.timestamp - a.timestamp) });
  res.json({ success: true });
});

app.put('/api/notifications/:id/pin', authMiddleware, (req, res) => {
  const { id } = req.params;
  const data = loadData();
  const notice = data.find(n => n.id === id);
  if (!notice) {
    return res.status(404).json({ error: '通知不存在' });
  }
  notice.pinned = !notice.pinned;
  saveData(data);
  broadcast({ type: 'update', data: data.sort((a, b) => b.timestamp - a.timestamp) });
  res.json({ success: true, notice });
});
