// ==========================================
// NEXO API Proxy
// ==========================================
//
// Server sederhana yang meneruskan request AI ke 9router lokal.
// Dipakai supaya Vercel (cloud) bisa mengakses AI provider yang hanya
// berjalan di komputer lokal (localhost:20128).
//
// CARA KERJA:
//   Vercel -> https://api.kamu.com/v1/chat/completions
//            -> server.js -> http://localhost:20128/v1/chat/completions
//            -> 9router -> Gemini/Groq/dll
//
// CARA JALAN:
//   npm install  (tanpa dependensi - pakai Node.js built-in)
//   node server.js
//
// ENVIRONMENT:
//   PORT           - port server ini (default: 3001)
//   TARGET_URL     - URL 9router lokal (default: http://localhost:20128/v1)
//   ALLOWED_ORIGIN - origin yang boleh akses (default: https://nexogames.site)

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const PORT = parseInt(process.env.PORT, 10) || 3001;
const TARGET = (process.env.TARGET_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
const ALLOWED = (process.env.ALLOWED_ORIGIN || 'https://nexogames.site')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const izin = ALLOWED.includes(origin) || ALLOWED.includes('*');
  return {
    'Access-Control-Allow-Origin': izin ? origin : ALLOWED[0] || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

const server = http.createServer((req, res) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  // Health check
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    return res.end(JSON.stringify({ ok: true, service: 'nexo-api-proxy', target: TARGET }));
  }

  // Proxy request ke 9router
  const targetUrl = new URL(TARGET + req.url);
  const isHttps = targetUrl.protocol === 'https:';
  const modul = isHttps ? https : http;

  const headers = { ...req.headers };
  delete headers.host; // supaya 9router menerima request dengan benar
  delete headers['content-length']; // biar proxy yang set ulang

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers,
  };

  const proxyReq = modul.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, { ...proxyRes.headers, ...corsHeaders(req) });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('[PROXY] Gagal:', e.message);
    res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    res.end(JSON.stringify({ ok: false, error: 'Gagal menghubungi AI provider. Pastikan 9router berjalan.' }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`[PROXY] Berjalan di port ${PORT}`);
  console.log(`[PROXY] Target: ${TARGET}`);
  console.log(`[PROXY] Allowed origins: ${ALLOWED.join(', ')}`);
  console.log('');
  console.log('Contoh penggunaan dari Vercel:');
  console.log(`  AI_BASE_URL = https://api-kamu.com/v1`);
});
