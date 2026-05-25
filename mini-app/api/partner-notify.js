const { PARTNER_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./lib/partnerAuth')

const NOTIFY_SECRET = 'nn_notify_secret_x9k2p7m4'
const PARTNER_TG    = `https://api.telegram.org/bot${PARTNER_BOT_TOKEN}`

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

async function getAllActivePartnerIds() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?is_active=eq.true&select=telegram_id`,
    { headers: SB_H }
  )
  const data = await r.json()
  return Array.isArray(data) ? data.filter(p => p.telegram_id).map(p => p.telegram_id) : []
}

async function sendToPartner(telegramId, text) {
  return fetch(`${PARTNER_TG}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: telegramId, parse_mode: 'HTML', text }),
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Notify-Secret')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })
  if (req.headers['x-notify-secret'] !== NOTIFY_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const { type } = req.body

    if (type === 'lead_approved' && req.body.lead_approved) {
      const { telegram_id, full_name, payout } = req.body.lead_approved
      await sendToPartner(
        telegram_id,
        `🎉 Твой лид <b>${full_name}</b> одобрен! В работе.\n\n💰 К выплате: <b>${fmt(payout)}</b>`
      )
    }

    else if (type === 'lead_rejected' && req.body.lead_rejected) {
      const { telegram_id, full_name, reason } = req.body.lead_rejected
      const reasonText = reason ? `\n\n📌 Причина: ${reason}` : ''
      await sendToPartner(
        telegram_id,
        `😔 Лид <b>${full_name}</b> отклонён.${reasonText}`
      )
    }

    else if (type === 'offer_updated' && req.body.offer_updated) {
      const { offer_name, new_rate } = req.body.offer_updated
      const ids = await getAllActivePartnerIds()
      await Promise.allSettled(ids.map(id =>
        sendToPartner(id,
          `💎 <b>Обновление ставки</b>\n\nОффер: <b>${offer_name}</b>\nНовая ставка: <b>${fmt(new_rate)}</b>`
        )
      ))
    }

    else if (type === 'broadcast' && req.body.broadcast) {
      const { text } = req.body.broadcast
      const ids = await getAllActivePartnerIds()
      await Promise.allSettled(ids.map(id => sendToPartner(id, text)))
    }

    else {
      return res.status(400).json({ error: 'Unknown type' })
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Partner notify error:', e)
    return res.status(500).json({ error: e.message })
  }
}
