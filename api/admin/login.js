const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SECRET = process.env.JWT_SECRET || 'notice-board-secret-2026';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      const payload = { role: 'admin', iat: Date.now() };
      const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
      const token = `${data}.${sig}`;
      return res.status(200).json({ success: true, token });
    } else {
      return res.status(401).json({ error: '密码错误' });
    }
  }

  return res.status(405).json({ error: '不支持的方法' });
}
