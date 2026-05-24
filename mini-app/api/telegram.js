const BOT_TOKEN    = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const MINI_APP_URL = 'https://nn-company-qe1w.vercel.app'
const SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
const WEBHOOK_URL  = `${MINI_APP_URL}/api/telegram`

const USER_NAMES = { tsvetkovnv: 'Босс', haaaaaaav: 'Тритон' }
const SB_H = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
const TG   = `https://api.telegram.org/bot${BOT_TOKEN}`

async function tg(method, body) {
  return fetch(`${TG}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

async function registerUser(user) {
  const username    = (user.username || '').toLowerCase()
  const displayName = USER_NAMES[username] || user.first_name || username || 'Пользователь'
  await fetch(`${SUPABASE_URL}/rest/v1/telegram_users`, {
    method:  'POST',
    headers: { ...SB_H, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify({ id: user.id, username, first_name: user.first_name || '', display_name: displayName }),
  })
  return displayName
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // GET: health check + ensure webhook is set
  if (req.method === 'GET') {
    await tg('setWebhook', { url: WEBHOOK_URL, drop_pending_updates: true })
    return res.json({ ok: true, webhook: WEBHOOK_URL })
  }

  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update  = req.body
    const message = update?.message
    if (!message) return res.json({ ok: true })

    const text = message.text || ''
    const user = message.from

    if (text.startsWith('/start') || text.startsWith('/app')) {
      const displayName = await registerUser(user)

      // Set menu button
      await tg('setChatMenuButton', {
        chat_id:     user.id,
        menu_button: { type: 'web_app', text: '📊 CRM', web_app: { url: MINI_APP_URL } },
      })

      // Welcome message
      await tg('sendMessage', {
        chat_id:      user.id,
        parse_mode:   'HTML',
        text:
          `Привет, <b>${displayName}</b>! 👋\n\n` +
          `Ты зарегистрирован в <b>NN Company CRM</b>.\n` +
          `Теперь будешь получать уведомления о лидах.\n\n` +
          `Нажми кнопку чтобы открыть приложение 👇`,
        reply_markup: {
          inline_keyboard: [[{ text: '📊 Открыть CRM', web_app: { url: MINI_APP_URL } }]],
        },
      })
    }

    if (text.startsWith('/help')) {
      await tg('sendMessage', {
        chat_id:    user.id,
        parse_mode: 'HTML',
        text: '<b>NN Company CRM Bot</b>\n\n/start — зарегистрироваться\n/app — открыть CRM\n/help — справка',
      })
    }
  } catch (e) {
    console.error('Telegram handler error:', e)
  }

  res.status(200).json({ ok: true })
}
