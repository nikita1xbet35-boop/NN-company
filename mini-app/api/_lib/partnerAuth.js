const crypto = require('crypto')

const PARTNER_BOT_TOKEN = '8875702497:AAF1qhqOMAe_JBV0qc2FBtCGe-PekxUTKcM'
const MAIN_BOT_TOKEN    = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const SUPABASE_URL      = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
const SB_H = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
}

const ALLOWED_ADMINS = ['tsvetkovnv', 'haaaaaaav']

/**
 * Верифицирует Telegram initData через HMAC-SHA256
 * Возвращает объект user или null
 */
function verifyInitData(initData, botToken) {
  try {
    if (!initData) return null
    const params = new URLSearchParams(initData)
    const hash   = params.get('hash')
    if (!hash) return null

    params.delete('hash')
    const entries = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const expected = crypto.createHmac('sha256', secret).update(entries).digest('hex')

    if (expected !== hash) return null

    const userStr = params.get('user')
    if (!userStr) return null
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

/**
 * Получает партнёра по telegram_id из БД
 */
async function getPartner(telegramId) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?telegram_id=eq.${telegramId}&is_active=eq.true&limit=1`,
      { headers: SB_H }
    )
    const data = await r.json()
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch {
    return null
  }
}

/**
 * Получает партнёра по username из БД
 */
async function getPartnerByUsername(username) {
  try {
    const clean = (username || '').replace('@', '').toLowerCase()
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?username=eq.${encodeURIComponent(clean)}&limit=1`,
      { headers: SB_H }
    )
    const data = await r.json()
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch {
    return null
  }
}

/**
 * Проверяет что пользователь — admin
 */
function isAdmin(username) {
  if (!username) return false
  return ALLOWED_ADMINS.includes(username.replace('@', '').toLowerCase())
}

module.exports = {
  verifyInitData,
  getPartner,
  getPartnerByUsername,
  isAdmin,
  PARTNER_BOT_TOKEN,
  MAIN_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  SB_H,
  ALLOWED_ADMINS,
}
