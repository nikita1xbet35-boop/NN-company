const BOT_TOKEN     = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const SUPABASE_URL  = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
const NOTIFY_SECRET = 'nn_notify_secret_x9k2p7m4'
const MINI_APP_URL  = 'https://nn-company-qe1w.vercel.app'

function fmtMoney(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

function leadButton(lead_id) {
  if (!lead_id) return null
  return {
    inline_keyboard: [[{
      text:    '📋 Открыть карточку',
      web_app: { url: `${MINI_APP_URL}/#/leads/${lead_id}` },
    }]],
  }
}

async function getUserIds() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/telegram_users?select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const data = await r.json()
  return Array.isArray(data) ? data.map(row => row.id) : []
}

async function broadcast(text, reply_markup) {
  const ids = await getUserIds()
  const body = { parse_mode: 'HTML', text, ...(reply_markup ? { reply_markup } : {}) }
  await Promise.allSettled(ids.map(id =>
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: id, ...body }),
    })
  ))
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Notify-Secret')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })
  if (req.headers['x-notify-secret'] !== NOTIFY_SECRET)
    return res.status(403).json({ error: 'Forbidden' })

  try {
    const { type, new_lead, status_change } = req.body

    if (type === 'new_lead' && new_lead) {
      const { full_name, offer, revenue, payout, added_by, lead_id } = new_lead
      await broadcast(
        `➕ <b>Новый лид добавлен</b>\n` +
        `👤 ${full_name}\n` +
        `📋 Оффер: ${offer}\n` +
        `💰 Доход: ${fmtMoney(revenue)}\n` +
        `💸 Выплата: ${fmtMoney(payout)}\n` +
        `👥 Добавил: ${added_by}`,
        leadButton(lead_id)
      )
    } else if (type === 'status_change' && status_change) {
      const { full_name, offer, new_status, changed_by, lead_id } = status_change
      await broadcast(
        `🔄 <b>Статус изменён</b>\n` +
        `👤 ${full_name}\n` +
        `📋 Оффер: ${offer}\n` +
        `📌 Новый статус: <b>${new_status}</b>\n` +
        `👥 Изменил: ${changed_by}`,
        leadButton(lead_id)
      )
    } else {
      return res.status(400).json({ error: 'Unknown type' })
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Notify error:', e)
    res.status(500).json({ error: e.message })
  }
}
