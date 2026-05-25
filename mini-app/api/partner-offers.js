const { verifyInitData, getPartner, isAdmin, PARTNER_BOT_TOKEN, MAIN_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./_lib/partnerAuth')

const PARTNER_TG = `https://api.telegram.org/bot${PARTNER_BOT_TOKEN}`

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

async function broadcastToPartners(text) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?is_active=eq.true&select=telegram_id`,
    { headers: SB_H }
  )
  const partners = await r.json()
  if (!Array.isArray(partners)) return

  await Promise.allSettled(
    partners
      .filter(p => p.telegram_id)
      .map(p =>
        fetch(`${PARTNER_TG}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chat_id: p.telegram_id, parse_mode: 'HTML', text }),
        })
      )
  )
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Init-Data, X-Admin-Init-Data')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    // --- GET: list offers (accessible to partners + admins) ---
    if (req.method === 'GET') {
      // Try partner auth first
      const partnerInitData = req.headers['x-init-data']
      const adminInitData   = req.headers['x-admin-init-data']

      let partnerId = null

      if (partnerInitData) {
        const user = verifyInitData(partnerInitData, PARTNER_BOT_TOKEN)
        if (user) {
          const partner = await getPartner(user.id)
          if (partner) partnerId = partner.id
        }
      }

      // If no partner auth, check admin auth
      if (!partnerId && !adminInitData) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      if (!partnerId && adminInitData) {
        const adminUser = verifyInitData(adminInitData, MAIN_BOT_TOKEN)
        if (!adminUser || !isAdmin(adminUser.username)) {
          return res.status(403).json({ error: 'Forbidden' })
        }
      }

      const offersR = await fetch(
        `${SUPABASE_URL}/rest/v1/partner_offers?order=sort_order.asc&select=*`,
        { headers: SB_H }
      )
      const offers = await offersR.json()
      if (!Array.isArray(offers)) return res.status(500).json({ error: 'DB error' })

      // If partner, also fetch their individual rates
      if (partnerId) {
        const ratesR = await fetch(
          `${SUPABASE_URL}/rest/v1/partner_rates?partner_id=eq.${partnerId}&select=*`,
          { headers: SB_H }
        )
        const rates = await ratesR.json().catch(() => [])
        const rateMap = {}
        if (Array.isArray(rates)) {
          rates.forEach(r => { rateMap[r.offer_id] = Number(r.rate) })
        }

        return res.status(200).json(
          offers.map(o => ({
            ...o,
            effective_rate: rateMap[o.id] !== undefined ? rateMap[o.id] : Number(o.rate),
            has_individual_rate: rateMap[o.id] !== undefined,
          }))
        )
      }

      return res.status(200).json(offers)
    }

    // --- POST / PATCH: admin only ---
    const adminInitData = req.headers['x-admin-init-data']
    if (!adminInitData) return res.status(400).json({ error: 'Missing X-Admin-Init-Data' })
    const adminUser = verifyInitData(adminInitData, MAIN_BOT_TOKEN)
    if (!adminUser || !isAdmin(adminUser.username)) return res.status(403).json({ error: 'Forbidden' })

    // --- POST: add offer ---
    if (req.method === 'POST') {
      const { name, rate, sort_order } = req.body || {}
      if (!name) return res.status(400).json({ error: 'Missing name' })

      const r = await fetch(`${SUPABASE_URL}/rest/v1/partner_offers`, {
        method:  'POST',
        headers: { ...SB_H, 'Prefer': 'return=representation' },
        body:    JSON.stringify({ name, rate: rate || 0, sort_order: sort_order || 0 }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(400).json({ error: JSON.stringify(data) })
      return res.status(200).json(Array.isArray(data) ? data[0] : data)
    }

    // --- PATCH: update offer ---
    if (req.method === 'PATCH') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'Missing id' })

      const { rate, is_active, name, sort_order } = req.body || {}
      const patch = {}
      if (typeof rate !== 'undefined') patch.rate = rate
      if (typeof is_active !== 'undefined') patch.is_active = is_active
      if (name) patch.name = name
      if (typeof sort_order !== 'undefined') patch.sort_order = sort_order

      await fetch(
        `${SUPABASE_URL}/rest/v1/partner_offers?id=eq.${id}`,
        {
          method:  'PATCH',
          headers: { ...SB_H, 'Prefer': 'return=minimal' },
          body:    JSON.stringify(patch),
        }
      )

      // If rate changed — broadcast to all active partners
      if (typeof rate !== 'undefined' && name) {
        broadcastToPartners(
          `💎 <b>Обновление ставки</b>\n\n` +
          `Оффер: <b>${name}</b>\n` +
          `Новая ставка: <b>${fmt(rate)}</b>`
        ).catch(e => console.error('broadcast error:', e))
      }

      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('Partner offers API error:', e)
    return res.status(500).json({ error: e.message })
  }
}
