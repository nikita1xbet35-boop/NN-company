/**
 * One-time webhook setup — called automatically from App.jsx on first load
 * Sets Telegram webhook to point to this Vercel deployment
 */

const BOT_TOKEN   = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const VERCEL_URL  = 'https://nn-company-qe1w.vercel.app'

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const webhookUrl = `${VERCEL_URL}/api/telegram`

    const r    = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
    })
    const data = await r.json()

    console.log('Webhook setup result:', data)
    res.status(200).json({ ...data, webhook_url: webhookUrl })
  } catch (e) {
    console.error('Setup error:', e)
    res.status(500).json({ error: e.message })
  }
}
