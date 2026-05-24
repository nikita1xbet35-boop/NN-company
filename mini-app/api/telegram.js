/**
 * Telegram webhook handler — receives updates from Telegram
 * Auto-registered via /api/setup
 */

const BOT_TOKEN   = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const MINI_APP_URL = 'https://nn-company-qe1w.vercel.app'
const SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'

const USER_NAMES = { tsvetkovnv: 'Босс', haaaaaaav: 'Тритон' }

async function supaUpsert(table, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(data),
  })
}

async function tgSend(chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  })
}

async function setMenuButton(chatId) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:     chatId,
      menu_button: { type: 'web_app', text: '📊 CRM', web_app: { url: MINI_APP_URL } },
    }),
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update  = req.body
    const message = update?.message
    if (!message) return res.json({ ok: true })

    const text     = message.text || ''
    const user     = message.from
    const username = (user.username || '').toLowerCase()

    if (text.startsWith('/start') || text.startsWith('/app')) {
      const displayName = USER_NAMES[username] || user.first_name || username || 'Пользователь'

      // Register user in Supabase
      await supaUpsert('telegram_users', {
        id:           user.id,
        username,
        first_name:   user.first_name || '',
        display_name: displayName,
      })

      // Set menu button
      await setMenuButton(user.id)

      // Send welcome message
      await tgSend(user.id,
        `Привет, <b>${displayName}</b>! 👋\n\n` +
        `Ты зарегистрирован в <b>NN Company CRM</b>.\n` +
        `Теперь будешь получать уведомления о лидах.\n\n` +
        `Нажми кнопку ниже чтобы открыть приложение 👇`,
        {
          reply_markup: {
            inline_keyboard: [[{
              text:    '📊 Открыть CRM',
              web_app: { url: MINI_APP_URL },
            }]],
          },
        }
      )
    }

    if (text.startsWith('/help')) {
      await tgSend(user.id,
        '<b>NN Company CRM Bot</b>\n\n' +
        '/start — зарегистрироваться\n' +
        '/app — открыть мини-приложение\n' +
        '/help — справка'
      )
    }
  } catch (e) {
    console.error('Telegram handler error:', e)
  }

  // Always 200 to Telegram
  res.status(200).json({ ok: true })
}
