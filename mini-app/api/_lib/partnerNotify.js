const { PARTNER_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./partnerAuth')

const PARTNER_TG = `https://api.telegram.org/bot${PARTNER_BOT_TOKEN}`

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

async function sendToPartner(telegramId, text) {
  return fetch(`${PARTNER_TG}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: telegramId, parse_mode: 'HTML', text }),
  })
}

async function getAllActivePartnerIds() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?is_active=eq.true&select=telegram_id`,
    { headers: SB_H }
  )
  const data = await r.json()
  return Array.isArray(data) ? data.filter(p => p.telegram_id).map(p => p.telegram_id) : []
}

async function notifyLeadApproved({ telegram_id, full_name, payout }) {
  if (!telegram_id) return
  await sendToPartner(telegram_id,
    `🎉 Твой лид <b>${full_name}</b> одобрен! В работе.\n\n💰 К выплате: <b>${fmt(payout)}</b>`)
}

async function notifyLeadRejected({ telegram_id, full_name, reason }) {
  if (!telegram_id) return
  const reasonText = reason ? `\n\n📌 Причина: ${reason}` : ''
  await sendToPartner(telegram_id, `😔 Лид <b>${full_name}</b> отклонён.${reasonText}`)
}

async function notifyOfferUpdated({ offer_name, new_rate }) {
  const ids = await getAllActivePartnerIds()
  await Promise.allSettled(ids.map(id =>
    sendToPartner(id, `💎 <b>Обновление ставки</b>\n\nОффер: <b>${offer_name}</b>\nНовая ставка: <b>${fmt(new_rate)}</b>`)
  ))
}

async function broadcast(text) {
  const ids = await getAllActivePartnerIds()
  await Promise.allSettled(ids.map(id => sendToPartner(id, text)))
}

module.exports = { notifyLeadApproved, notifyLeadRejected, notifyOfferUpdated, broadcast, sendToPartner }
