const SECRET = 'notice-board-secret-2026';

async function hmacSign(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function verifyToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [data, sig] = parts;
  const expectedSig = await hmacSign(data);
  if (sig !== expectedSig) return false;
  try {
    const payload = JSON.parse(b64urlDecode(data));
    return payload.role === 'admin';
  } catch { return false; }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token'
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env } = context;
  const raw = await env.NOTICES.get('notifications');
  const list = raw ? JSON.parse(raw) : [];
  return new Response(JSON.stringify(list.sort((a, b) => b.timestamp - a.timestamp)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const token = request.headers.get('X-Admin-Token');
  if (!await verifyToken(token)) {
    return new Response(JSON.stringify({ error: '未授权访问' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const { title, content, level } = await request.json();
    if (!title || !content) {
      return new Response(JSON.stringify({ error: '标题和内容不能为空' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const raw = await env.NOTICES.get('notifications');
    const list = raw ? JSON.parse(raw) : [];
    const notice = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      content: content.trim(),
      level: level || 'normal',
      timestamp: Date.now(),
      pinned: false
    };
    list.push(notice);
    await env.NOTICES.put('notifications', JSON.stringify(list));
    return new Response(JSON.stringify({ success: true, notice }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: '请求错误' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
