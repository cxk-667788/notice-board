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
  'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token'
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  const { request } = context;
  const token = request.headers.get('X-Admin-Token');
  if (!await verifyToken(token)) {
    return new Response(JSON.stringify({ error: '未授权访问' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const id = params.id;
  const raw = await env.NOTICES.get('notifications');
  const list = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex(n => n.id === id);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: '通知不存在' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  list.splice(idx, 1);
  await env.NOTICES.put('notifications', JSON.stringify(list));
  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
