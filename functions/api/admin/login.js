const SECRET = 'notice-board-secret-2026';

async function hmacSign(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

export async function onRequestPost(context) {
  const { request } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  try {
    const { password } = await request.json();
    if (password === 'admin123') {
      const payload = JSON.stringify({ role: 'admin', iat: Date.now() });
      const data = b64urlEncode(payload);
      const sig = await hmacSign(data);
      const token = `${data}.${sig}`;
      return new Response(JSON.stringify({ success: true, token }), { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ error: '密码错误' }), { status: 401, headers: corsHeaders });
  } catch {
    return new Response(JSON.stringify({ error: '请求错误' }), { status: 400, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
