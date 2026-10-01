# NEXO AI API

Server AI yang bisa di-deploy ke Vercel. Memanggil Groq API langsung — tanpa perlu 9router lokal.

## Deploy ke Vercel

1. Import repo ini di Vercel
2. Set **Framework**: Other
3. Set **Build Command**: (kosongkan)
4. Set **Output Directory**: (kosongkan)
5. Tambah environment variable: `GROQ_API_KEY`
6. Deploy

## Setelah Deploy

Di project NEXO (nexogames.site), set:
```
AI_BASE_URL = https://urlrouter.vercel.app/v1
AI_API_KEY = <kunci_Groq_sama_dengan_Vercel_NEXO>
AI_MODEL = openai/gpt-oss-120b
```

## Testing Lokal

```bash
GROQ_API_KEY="gsk_..." STANDALONE=1 node server.js
# Buka http://localhost:3001/health
```
