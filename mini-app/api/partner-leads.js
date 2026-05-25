const { verifyInitData, getPartner, PARTNER_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./_lib/partnerAuth')

const MINI_APP_URL  = 'https://nn-company-qe1w.vercel.app'
const MAIN_BOT_TOKEN = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const MAIN_TG        = `https://api.telegram.org/bot${MAIN_BOT_TOKEN}`

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

async function getAdminIds() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_users?select=id&username=in.(tsvetkovnv,haaaaaaav)`,
    { headers: SB_H }
  )
  const data = await r.json()
  return Array.isArray(data) ? data.map(row => row.id) : []
}

async function notifyAdmins(partnerLead, partnerName) {
  const ids = await getAdminIds()
  await Promise.allSettled(ids.map(id =>
    fetch(`${MAIN_TG}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:      id,
        parse_mode:   'HTML',
        text:
          `🤝 <b>Новый лид от партнёра</b>\n\n` +
          `👤 Лид: <b>${partnerLead.full_name}</b>\n` +
          `📞 Контакт: ${partnerLead.contact}\n` +
          `📋 Оффер: ${partnerLead.offer}\n` +
          `💰 Выплата партнёру: <b>${fmt(partnerLead.payout_to_partner)}</b>\n` +
          `🤝 Партнёр: <b>${partnerName}</b>`,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Одобрить', callback_data: `pa:${partnerLead.id}` },
            { text: '❌ Отклонить', callback_data: `pr:${partnerLead.id}` },
          ]],
        },
      }),
    })
  ))
}

async function getRate(partnerId, offerName) {
  // 1. Find offer by name
  const offerR = await fetch(
    `${SUPABASE_URL}/rest/v1/partner_offers?name=eq.${encodeURIComponent(offerName)}&is_active=eq.true&limit=1`,
    { headers: SB_H }
  )
  const offers = await offerR.json()
  if (!Array.isArray(offers) || offers.length === 0) return 0
  const offer = offers[0]

  // 2. Check individual rate
  const rateR = await fetch(
    `${SUPABASE_URL}/rest/v1/partner_rates?partner_id=eq.${partnerId}&offer_id=eq.${offer.id}&limit=1`,
    { headers: SB_H }
  )
  const rates = await rateR.json()
  if (Array.isArray(rates) && rates.length > 0) return Number(rates[0].rate)

  return Number(offer.rate)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Init-Data')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    // --- GET: list partner's own leads ---
    if (req.method === 'GET') {
      const initData = req.headers['x-init-data']
      if (!initData) return res.status(400).json({ error: 'Missing X-Init-Data' })

      const user = verifyInitData(initData, PARTNER_BOT_TOKEN)
      if (!user) return res.status(403).json({ error: 'Invalid initData' })

      const partner = await getPartner(user.id)
      if (!partner) return res.status(403).json({ error: 'Not a partner' })

      // Fetch leads with optional crm lead info
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/partner_leads?partner_id=eq.${partner.id}&order=created_at.desc&select=*`,
        { headers: SB_H }
      )
      const leads = await r.json()
      if (!Array.isArray(leads)) return res.status(500).json({ error: 'DB error' })

      // Enrich with CRM lead status for approved leads
      const enriched = await Promise.all(leads.map(async lead => {
        if (lead.crm_lead_id) {
          const lr = await fetch(
            `${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.crm_lead_id}&select=status`,
            { headers: SB_H }
          )
          const crmLeads = await lr.json().catch(() => [])
          if (Array.isArray(crmLeads) && crmLeads.length > 0) {
            return { ...lead, crm_status: crmLeads[0].status }
          }
        }
        return lead
      }))

      return res.status(200).json(enriched)
    }

    // --- POST: add new lead ---
    if (req.method === 'POST') {
      const initData = req.headers['x-init-data']
      if (!initData) return res.status(400).json({ error: 'Missing X-Init-Data' })

      const user = verifyInitData(initData, PARTNER_BOT_TOKEN)
      if (!user) return res.status(403).json({ error: 'Invalid initData' })

      const partner = await getPartner(user.id)
      if (!partner) return res.status(403).json({ error: 'Not a partner' })

      const { full_name, contact, offer } = req.body || {}
      if (!full_name || !contact || !offer) {
        return res.status(400).json({ error: 'Missing fields: full_name, contact, offer' })
      }

      // Get payout rate
      const payout_to_partner = await getRate(partner.id, offer)

      // Insert lead
      const insertR = await fetch(`${SUPABASE_URL}/rest/v1/partner_leads`, {
        method:  'POST',
        headers: { ...SB_H, 'Prefer': 'return=representation' },
        body:    JSON.stringify({
          partner_id:       partner.id,
          full_name:        full_name.trim(),
          contact:          contact.trim(),
          offer,
          payout_to_partner,
          approval_status:  'pending',
        }),
      })
      const inserted = await insertR.json()
      if (!Array.isArray(inserted) || inserted.length === 0) {
        return res.status(500).json({ error: 'Failed to insert lead' })
      }
      const newLead = inserted[0]

      // Notify admins (non-blocking)
      notifyAdmins(newLead, partner.display_name).catch(e => console.error('notify admins error:', e))

      return res.status(200).json({ ok: true, lead: newLead })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('Partner leads error:', e)
    return res.status(500).json({ error: e.message })
  }
}
