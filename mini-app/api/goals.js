/**
 * Goals API — хранит цели по месяцам в Supabase Storage
 * GET  /api/goals?month=2026-05  → { month, target_profit }
 * POST /api/goals                → { month, target_profit } → { ok: true }
 */

const SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
const BUCKET       = 'nn-goals'

const SH = {
  Authorization: `Bearer ${SUPABASE_KEY}`,
  apikey:        SUPABASE_KEY,
}

async function ensureBucket() {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method:  'POST',
      headers: { ...SH, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    })
  } catch (_) {}
  // Если бакет уже существует — ошибка игнорируется
}

async function getFile(path) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { headers: SH })
  if (!r.ok) return null
  try { return await r.json() } catch (_) { return null }
}

async function putFile(path, data) {
  const body = JSON.stringify(data)
  // Upsert через x-upsert: true
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method:  'POST',
    headers: { ...SH, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body,
  })
  if (!r.ok) {
    // Fallback — PUT
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method:  'PUT',
      headers: { ...SH, 'Content-Type': 'application/json' },
      body,
    })
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const month = (req.query && req.query.month) || new Date().toISOString().slice(0, 7)
  const path  = `${month}.json`

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const data = await getFile(path)
      return res.status(200).json(data || { month, target_profit: 0 })
    } catch (e) {
      return res.status(200).json({ month, target_profit: 0 })
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      await ensureBucket()
      const target_profit = Number(req.body && req.body.target_profit) || 0
      await putFile(path, { month, target_profit })
      return res.status(200).json({ ok: true })
    } catch (e) {
      console.error('Goals error:', e)
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
