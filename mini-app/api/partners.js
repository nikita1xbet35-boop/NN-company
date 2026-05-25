const { verifyInitData, isAdmin, MAIN_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./_lib/partnerAuth')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Init-Data')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // Auth check
  const initData = req.headers['x-admin-init-data']
  if (!initData) return res.status(400).json({ error: 'Missing X-Admin-Init-Data' })
  const user = verifyInitData(initData, MAIN_BOT_TOKEN)
  if (!user || !isAdmin(user.username)) return res.status(403).json({ error: 'Forbidden' })

  try {
    // --- GET: list all partners with stats ---
    if (req.method === 'GET') {
      const partnersR = await fetch(
        `${SUPABASE_URL}/rest/v1/partners?order=created_at.desc&select=*`,
        { headers: SB_H }
      )
      const partners = await partnersR.json()
      if (!Array.isArray(partners)) return res.status(500).json({ error: 'DB error' })

      // Aggregate stats for each partner
      const enriched = await Promise.all(partners.map(async p => {
        const [leadsR, payoutsR] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/partner_leads?partner_id=eq.${p.id}&select=payout_to_partner,approval_status`, { headers: SB_H }),
          fetch(`${SUPABASE_URL}/rest/v1/partner_payouts?partner_id=eq.${p.id}&select=amount`, { headers: SB_H }),
        ])
        const leads   = await leadsR.json().catch(() => [])
        const payouts = await payoutsR.json().catch(() => [])

        const approved = Array.isArray(leads) ? leads.filter(l => l.approval_status === 'approved') : []
        const earned   = approved.reduce((s, l) => s + Number(l.payout_to_partner || 0), 0)
        const paid     = Array.isArray(payouts) ? payouts.reduce((s, pp) => s + Number(pp.amount || 0), 0) : 0

        return {
          ...p,
          stats: {
            total_leads:    Array.isArray(leads) ? leads.length : 0,
            approved_leads: approved.length,
            earned,
            paid,
            owed: Math.max(0, earned - paid),
          },
        }
      }))

      return res.status(200).json(enriched)
    }

    // --- POST: add partner ---
    if (req.method === 'POST') {
      const { username, display_name, notes } = req.body || {}
      if (!username || !display_name) {
        return res.status(400).json({ error: 'Missing username or display_name' })
      }
      const clean = username.replace('@', '').toLowerCase()
      const r = await fetch(`${SUPABASE_URL}/rest/v1/partners`, {
        method:  'POST',
        headers: { ...SB_H, 'Prefer': 'return=representation' },
        body:    JSON.stringify({
          username:     clean,
          display_name: display_name.trim(),
          notes:        notes?.trim() || null,
          added_by:     user.username,
          is_active:    true,
        }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(400).json({ error: JSON.stringify(data) })
      return res.status(200).json(Array.isArray(data) ? data[0] : data)
    }

    // --- PATCH: update partner ---
    if (req.method === 'PATCH') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'Missing id' })

      const { is_active, display_name, notes } = req.body || {}
      const patch = {}
      if (typeof is_active !== 'undefined') patch.is_active = is_active
      if (display_name) patch.display_name = display_name.trim()
      if (typeof notes !== 'undefined') patch.notes = notes?.trim() || null

      await fetch(
        `${SUPABASE_URL}/rest/v1/partners?id=eq.${id}`,
        {
          method:  'PATCH',
          headers: { ...SB_H, 'Prefer': 'return=minimal' },
          body:    JSON.stringify(patch),
        }
      )
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('Partners API error:', e)
    return res.status(500).json({ error: e.message })
  }
}
