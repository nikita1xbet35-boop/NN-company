const { verifyInitData, getPartner, PARTNER_BOT_TOKEN } = require('./_lib/partnerAuth')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Init-Data')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  try {
    const initData = req.headers['x-init-data'] || req.body?.initData
    if (!initData) return res.status(400).json({ error: 'Missing initData' })

    const user = verifyInitData(initData, PARTNER_BOT_TOKEN)
    if (!user) return res.status(403).json({ error: 'Invalid initData' })

    const partner = await getPartner(user.id)
    if (!partner) return res.status(403).json({ error: 'Not a partner' })

    return res.status(200).json({ ok: true, partner, user })
  } catch (e) {
    console.error('Partner auth error:', e)
    return res.status(500).json({ error: e.message })
  }
}
