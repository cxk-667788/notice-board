import QRCode from 'qrcode';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = `${proto}://${host}`;
    const qr = await QRCode.toDataURL(url, { width: 300, margin: 1 });
    return res.status(200).json({ url, qr });
  } catch {
    return res.status(500).json({ error: '生成二维码失败' });
  }
}
