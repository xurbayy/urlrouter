// ==========================================
// AI Relay - Edge Function
// ==========================================
//
// Meneruskan request AI ke provider lewat Vercel Edge Network.
// IP kamu diganti IP Vercel (ribuan IP di 20+ region) sehingga provider
// tidak bisa memblokir IP lokal kamu.
//
// ENVIRONMENT:
//   AI_API_KEY    - kunci provider (Groq / Gemini / custom)
//   AI_BASE_URL   - endpoint provider (kosong = Groq default)
//   AI_MODEL      - nama model (kosong = openai/gpt-oss-120b)
//   RELAY_SECRET  - token yang diminta dari NEXO web (opsional, keamanan)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function baseUrl() {
  const custom = (process.env.AI_BASE_URL || '').replace(/\/+$/, '');
  return custom ? `${custom}/chat/completions` : GROQ_URL;
}

function daftarKunci() {
  const custom = process.env.AI_API_KEY;
  if (custom && custom.trim()) return custom.split(',').map(k => k.trim()).filter(Boolean);
  return (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
}

function modelAI() {
  return process.env.AI_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
}

function maksToken() {
  return parseInt(process.env.AI_MAX_TOKENS || '2000', 10) || 2000;
}

function bersihkanPesan(teks) {
  let out = String(teks || '');
  for (const k of daftarKunci()) {
    if (k) out = out.split(k).join('[redacted]');
  }
  return out.replace(/gsk_[A-Za-z0-9]{20,}/g, '[redacted]');
}

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);

  // CORS
  const origin = request.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (url.pathname === '/' || url.pathname === '/health') {
    return new Response(JSON.stringify({
      ok: true,
      service: 'nexo-ai-relay',
      provider: process.env.AI_BASE_URL ? new URL(process.env.AI_BASE_URL).hostname : 'groq',
      model: modelAI(),
      kunci: daftarKunci().length,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), { status: 405, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body?.messages) {
    return new Response(JSON.stringify({ ok: false, error: 'messages wajib' }), { status: 400, headers: corsHeaders });
  }

  const kunci = daftarKunci();
  if (!kunci.length) {
    return new Response(JSON.stringify({ ok: false, error: 'AI_API_KEY belum diisi di environment Vercel' }), { status: 500, headers: corsHeaders });
  }

  // Kirim ke provider - IP Vercel yang dipakai, bukan IP lokal.
  let hasil = null;
  for (let i = 0; i < kunci.length; i++) {
    try {
      const res = await fetch(baseUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kunci[i]}` },
        body: JSON.stringify({ model: modelAI(), messages: body.messages, max_tokens: maksToken(), temperature: 0.4 }),
      });

      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/event-stream') || ct.includes('stream')) {
          // SSE - teruskan langsung
          return new Response(res.body, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...corsHeaders },
          });
        }
        const data = await res.json();
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const kode = res.status;
      let pesan = '';
      try { const j = await res.json(); pesan = j?.error?.message || JSON.stringify(j); } catch { pesan = 'HTTP ' + kode; }
      hasil = { ok: false, error: bersihkanPesan(pesan) };
    } catch (e) {
      hasil = { ok: false, error: e?.message || 'gagal' };
    }
  }

  return new Response(JSON.stringify(hasil || { ok: false, error: 'gagal' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
