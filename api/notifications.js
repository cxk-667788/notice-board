const crypto = require('crypto');

let notifications = [];
let activeTokens = new Set();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    return res.status(200).json(notifications.sort((a, b) => b.timestamp - a.timestamp));
  }

  function checkAuth() {
    const token = req.headers['x-admin-token'];
    if (!token || !activeTokens.has(token)) {
      res.status(401).json({ error: '未授权访问' });
      return false;
    }
    return true;
  }

  if (req.method === 'POST' && !id) {
    if (!checkAuth()) return;
    const { title, content, level } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }
    const notice = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      content: content.trim(),
      level: level || 'normal',
      timestamp: Date.now(),
      pinned: false
    };
    notifications.push(notice);
    return res.status(200).json({ success: true, notice });
  }

  if (req.method === 'DELETE' && id) {
    if (!checkAuth()) return;
    const idx = notifications.findIndex(n => n.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: '通知不存在' });
    }
    notifications.splice(idx, 1);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT' && id) {
    if (!checkAuth()) return;
    const notice = notifications.find(n => n.id === id);
    if (!notice) {
      return res.status(404).json({ error: '通知不存在' });
    }
    notice.pinned = !notice.pinned;
    return res.status(200).json({ success: true, notice });
  }

  return res.status(405).json({ error: '不支持的方法' });
}
