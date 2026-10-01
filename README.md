# NEXO API Proxy

Server proxy sederhana yang meneruskan request AI dari Vercel ke 9router lokal.

## Cara Kerja

```
Vercel -> https://api-kamu.com/v1/chat/completions
       -> server.js -> http://localhost:20128/v1/chat/completions
       -> 9router -> Gemini/Groq/dll
```

## Cara Pakai

```bash
npm install    # tanpa dependensi - pakai Node.js built-in
node server.js
```

## Environment Variables

| Variabel | Default | Keterangan |
|---|---|---|
| PORT | 3001 | Port server proxy |
| TARGET_URL | http://localhost:20128/v1 | URL 9router lokal |
| ALLOWED_ORIGIN | https://nexogames.site | Origin yang boleh akses |

## Hosting

Server ini bisa di-host di:
- **VPS** (DigitalOcean, Linode, dsb)
- **Railway** (gratis tier tersedia)
- **Render** (gratis tier tersedia)
- **Fly.io** (gratis tier tersedia)

Semua platform yang mendukung Node.js bisa menjalankan server ini.
