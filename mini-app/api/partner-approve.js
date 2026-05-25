const { PARTNER_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./lib/partnerAuth')

const NOTIFY_SECRET  = 'nn_notify_secret_x9k2p7m4'
const PARTNER_TG     = `https://api.telegram.org/bot${PARTNER_BOT_TOKEN}`

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

async function notifyPartner(telegramId, text) {
  if (!telegramId) return
  await fetch(`${PARTNER_TG}/sendMessage`, {
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
    const { action, partner_lead_id, rejection_reason, reviewer, revenue } = req.body || {}

    if (!action || !partner_lead_id) {
      return res.status(400).json({ error: 'Missing action or partner_lead_id' })
    }

    // Fetch partner lead
    const leadR = await fetch(
      `${SUPABASE_URL}/rest/v1/partner_leads?id=eq.${partner_lead_id}&select=*&limit=1`,
      { headers: SB_H }
    )
    const leads = await leadR.json()
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(404).json({ error: 'Partner lead not found' })
    }
    const partnerLead = leads[0]

    // Fetch partner info
    const partnerR = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?id=eq.${partnerLead.partner_id}&select=*&limit=1`,
      { headers: SB_H }
    )
    const partners = await partnerR.json()
    const partner  = Array.isArray(partners) && partners.length > 0 ? partners[0] : null

    if (action === 'approve') {
      // Create CRM lead
      const crmLeadBody = {
        full_name: partnerLead.full_name,
        phone:     partnerLead.contact,
        contact:   partnerLead.contact,
        offer:     partnerLead.offer,
        payout:    partnerLead.payout_to_partner,
        revenue:   typeof revenue === 'number' ? revenue : 0,
        added_by:  partner ? `Партнёр: ${partner.display_name}` : 'Партнёр',
        status:    'В работе',
      }
      const crmR = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method:  'POST',
        headers: { ...SB_H, 'Prefer': 'return=representation' },
        body:    JSON.stringify(crmLeadBody),
      })
      const crmLeads = await crmR.json()
      const crmLead  = Array.isArray(crmLeads) && crmLeads.length > 0 ? crmLeads[0] : null

      // Update partner_lead
      await fetch(
        `${SUPABASE_URL}/rest/v1/partner_leads?id=eq.${partner_lead_id}`,
        {
          method:  'PATCH',
          headers: { ...SB_H, 'Prefer': 'return=minimal' },
          body:    JSON.stringify({
            approval_status: 'approved',
            crm_lead_id:     crmLead ? crmLead.id : null,
            reviewed_by:     reviewer || 'Администратор',
            reviewed_at:     new Date().toISOString(),
          }),
        }
      )

      // Notify partner
      if (partner?.telegram_id) {
        await notifyPartner(
          partner.telegram_id,
          `🎉 Твой лид <b>${partnerLead.full_name}</b> одобрен! В работе.\n\n` +
          `💰 К выплате: <b>${fmt(partnerLead.payout_to_partner)}</b>`
        )
      }

      return res.status(200).json({ ok: true, action: 'approved', crm_lead_id: crmLead?.id })
    }

    if (action === 'reject') {
      await fetch(
        `${SUPABASE_URL}/rest/v1/partner_leads?id=eq.${partner_lead_id}`,
        {
          method:  'PATCH',
          headers: { ...SB_H, 'Prefer': 'return=minimal' },
          body:    JSON.stringify({
            approval_status:  'rejected',
            rejection_reason: rejection_reason || null,
            reviewed_by:      reviewer || 'Администратор',
            reviewed_at:      new Date().toISOString(),
          }),
        }
      )

      // Notify partner
      if (partner?.telegram_id) {
        const reason = rejection_reason ? `\n\n📌 Причина: ${rejection_reason}` : ''
        await notifyPartner(
          partner.telegram_id,
          `😔 Лид <b>${partnerLead.full_name}</b> отклонён.${reason}`
        )
      }

      return res.status(200).json({ ok: true, action: 'rejected' })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    console.error('Partner approve error:', e)
    return res.status(500).json({ error: e.message })
  }
}
