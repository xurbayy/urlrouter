// ==========================================
// NEXO AI API Server
// ==========================================
//
// Server AI yang bisa di-deploy ke Vercel (serverless) atau Node.js biasa.
// Memanggil Groq API langsung - tidak perlu 9router lokal.
//
// ENVIRONMENT:
//   GROQ_API_KEY    - kunci Groq (bisa multi dipisah koma)
//   GROQ_MODEL      - model Groq (default: openai/gpt-oss-120b)
//   AI_MAX_TOKENS   - batas output token (default: 2000)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function daftarKunci() {
  return (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
}

function modelAI() {
  return process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
}

function maksToken() {
  const n = parseInt(process.env.AI_MAX_TOKENS || process.env.GROQ_MAX_TOKENS, 10);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

function bersihkanPesan(teks) {
  let out = String(teks || '');
  for (const k of daftarKunci()) {
    if (k) out = out.split(k).join('[kunci-disembunyikan]');
  }
  return out.replace(/gsk_[A-Za-z0-9]{20,}/g, '[kunci-disembunyikan]');
}

async function tanyaAI(pesan) {
  const kunci = daftarKunci();
  if (!kunci.length) return { ok: false, error: 'GROQ_API_KEY belum diisi.' };

  for (let i = 0; i < kunci.length; i++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kunci[i]}` },
        body: JSON.stringify({
          model: modelAI(),
          messages: pesan,
          max_tokens: maksToken(),
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.ok) {
        const data = await res.json();
        const teks = data?.choices?.[0]?.message?.content;
        if (teks) return { ok: true, teks, kunciDipakai: i + 1 };
        return { ok: false, error: 'AI mengirim balasan kosong.' };
      }

      let pesanErr = '';
      try { const j = await res.json(); pesanErr = j?.error?.message || JSON.stringify(j); } catch { pesanErr = ''; }

      const kode = res.status;
      let rangkai = pesanErr || ('HTTP ' + kode);
      if (/too large|TPM|tokens per minute/i.test(rangkai)) {
        rangkai = 'Data terlalu panjang untuk batas kuota. Coba lagi sebentar.';
      } else if (kode === 403) {
        rangkai += ' [kunci ditolak atau nama MODEL salah]';
      } else if (kode === 401) {
        rangkai += ' [kunci ditolak]';
      } else if (kode === 429) {
        rangkai += ' [kuota kunci ini habis]';
      }
      if (kode === 400 || kode === 404) break;
    } catch (e) {
      return { ok: false, error: e?.name === 'TimeoutError' ? 'Timeout 60 detik' : bersihkanPesan(e?.message || e) };
    }
  }
  return { ok: false, error: 'Semua kunci dicoba, tidak ada yang berhasil.' };
}

// Handler utama - mendukung Vercel serverless (export) dan Node.js biasa
export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.url === '/health' || req.url === '/') {
    return res.json({ ok: true, service: 'nexo-ai', model: modelAI(), kunci: daftarKunci().length });
  }
  if (req.method !== 'POST' || !req.url.includes('chat/completions')) {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { body = null; }
  if (!body?.messages) return res.status(400).json({ ok: false, error: 'messages wajib diisi.' });

  const hasil = await tanyaAI(body.messages);
  return res.status(hasil.ok ? 200 : 502).json(hasil);
}

// Node.js standalone mode (untuk testing lokal)
if (process.env.STANDALONE === '1') {
  const http = require('node:http');
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      req.body = Buffer.concat(chunks).toString();
      handler(req, res);
    });
  });
  server.listen(3001, () => console.log('Standalone di port 3001'));
}
