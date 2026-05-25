const { verifyInitData, getPartner, isAdmin, PARTNER_BOT_TOKEN, MAIN_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./_lib/partnerAuth')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Init-Data, X-Admin-Init-Data')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    // --- GET: history (partner or admin) ---
    if (req.method === 'GET') {
      const partnerInitData = req.headers['x-init-data']
      const adminInitData   = req.headers['x-admin-init-data']

      let partnerId = req.query.partner_id

      if (partnerInitData) {
        const user = verifyInitData(partnerInitData, PARTNER_BOT_TOKEN)
        if (!user) return res.status(403).json({ error: 'Invalid initData' })
        const partner = await getPartner(user.id)
        if (!partner) return res.status(403).json({ error: 'Not a partner' })
        partnerId = partner.id // always use verified partner id
      } else if (adminInitData) {
        const adminUser = verifyInitData(adminInitData, MAIN_BOT_TOKEN)
        if (!adminUser || !isAdmin(adminUser.username)) return res.status(403).json({ error: 'Forbidden' })
        if (!partnerId) return res.status(400).json({ error: 'Missing partner_id' })
      } else {
        return res.status(400).json({ error: 'Missing auth header' })
      }

      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/partner_payouts?partner_id=eq.${partnerId}&order=paid_at.desc&select=*`,
        { headers: SB_H }
      )
      const data = await r.json()
      return res.status(200).json(Array.isArray(data) ? data : [])
    }

    // --- POST: record payout (admin only) ---
    if (req.method === 'POST') {
      const adminInitData = req.headers['x-admin-init-data']
      if (!adminInitData) return res.status(400).json({ error: 'Missing X-Admin-Init-Data' })
      const adminUser = verifyInitData(adminInitData, MAIN_BOT_TOKEN)
      if (!adminUser || !isAdmin(adminUser.username)) return res.status(403).json({ error: 'Forbidden' })

      const { partner_id, amount, paid_by, notes } = req.body || {}
      if (!partner_id || !amount || !paid_by) {
        return res.status(400).json({ error: 'Missing partner_id, amount or paid_by' })
      }

      const r = await fetch(`${SUPABASE_URL}/rest/v1/partner_payouts`, {
        method:  'POST',
        headers: { ...SB_H, 'Prefer': 'return=representation' },
        body:    JSON.stringify({
          partner_id,
          amount:   Number(amount),
          paid_by:  paid_by.trim(),
          notes:    notes?.trim() || null,
          paid_at:  new Date().toISOString(),
        }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(400).json({ error: JSON.stringify(data) })
      return res.status(200).json(Array.isArray(data) ? data[0] : data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('Partner payouts API error:', e)
    return res.status(500).json({ error: e.message })
  }
}
