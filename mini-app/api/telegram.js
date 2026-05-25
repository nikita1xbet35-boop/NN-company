const BOT_TOKEN    = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const MINI_APP_URL = 'https://nn-company-qe1w.vercel.app'
const SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
const WEBHOOK_URL  = `${MINI_APP_URL}/api/telegram`

const USER_NAMES    = { tsvetkovnv: 'Никитос', haaaaaaav: 'Хасл' }
const ALLOWED_USERS = ['tsvetkovnv', 'haaaaaaav']
const NOTIFY_SECRET = 'nn_notify_secret_x9k2p7m4'

function getDisplayName(username) {
  return USER_NAMES[username] || username || 'Администратор'
}

const REJECT_MSGS = [
  '🚫 Закрытый клуб, братан. Тебя не звали.',
  '⛔️ Эй. Это не твой бот. Иди своей дорогой 👋',
  '🙅 Доступ закрыт. Нет, это не ошибка.',
  '😐 Нет. Просто нет.',
  '🔒 Частная собственность. Проходи мимо.',
  '👮 Стоп. Дальше не пройдёшь. Удачи в жизни 👋',
]
const SB_H = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
const TG   = `https://api.telegram.org/bot${BOT_TOKEN}`

const MSK_OFFSET = 3 * 60 * 60 * 1000 // UTC+3 в миллисекундах

const MONTH_NAMES_RU = [
  'январь','февраль','март','апрель','май','июнь',
  'июль','август','сентябрь','октябрь','ноябрь','декабрь',
]

// ── Утилиты ───────────────────────────────────────────────────────────────────

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

function mskNow() {
  return new Date(Date.now() + MSK_OFFSET)
}

function isoDay(d, hour, min, sec) {
  const c = new Date(d)
  c.setUTCHours(hour - 3, min, sec, 0) // конвертируем МСК → UTC для хранения
  return c.toISOString()
}

async function tg(method, body) {
  return fetch(`${TG}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

// ── Отчёты ────────────────────────────────────────────────────────────────────

async function fetchLeads(startIso, endIso) {
  const params = new URLSearchParams({
    select: 'status,revenue,payout',
  })
  params.append('created_at', `gte.${startIso}`)
  params.append('created_at', `lte.${endIso}`)
  const r = await fetch(`${SUPABASE_URL}/rest/v1/leads?${params}`, { headers: SB_H })
  const data = await r.json()
  return Array.isArray(data) ? data : []
}

function buildReport(leads, title) {
  const active  = leads.filter(l => l.status !== 'Отказ')
  const revenue = active.reduce((s, l) => s + Number(l.revenue || 0), 0)
  const payout  = active.reduce((s, l) => s + Number(l.payout  || 0), 0)
  const profit  = revenue - payout

  const byStatus = {}
  leads.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1 })
  const statusLines = Object.entries(byStatus).map(([s, n]) => `  • ${s}: ${n}`).join('\n')

  const emoji = profit > 500000 ? '🏆' : profit > 50000 ? '🔥' : '📊'

  return (
    `${emoji} <b>${title}</b>\n\n` +
    `👥 Лидов: <b>${leads.length}</b>\n` +
    `${statusLines}\n\n` +
    `💰 Доход: <b>${fmt(revenue)}</b>\n` +
    `💸 Выплаты: <b>${fmt(payout)}</b>\n` +
    `📈 Прибыль: <b>${fmt(profit)}</b>`
  )
}

async function getUsers() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_users?select=id&username=in.(tsvetkovnv,haaaaaaav)`,
    { headers: SB_H }
  )
  const data = await r.json()
  return Array.isArray(data) ? data.map(row => row.id) : []
}

async function sendAll(text) {
  const ids = await getUsers()
  await Promise.allSettled(ids.map(id =>
    tg('sendMessage', { chat_id: id, parse_mode: 'HTML', text })
  ))
}

async function reportToday() {
  const now   = mskNow()
  const start = new Date(now); start.setUTCHours(0 - 3, 0, 0, 0)
  const end   = new Date(now); end.setUTCHours(23 - 3, 59, 59, 0)
  const day   = `${now.getUTCDate()} ${MONTH_NAMES_RU[now.getUTCMonth()]}`

  const leads = await fetchLeads(start.toISOString(), end.toISOString())
  if (!leads.length) return sendAll('😤 <b>Хуевый день, 0 лидов</b>\nЗавтра отыграемся 💪')
  return sendAll(buildReport(leads, `Итоги дня — ${day}`))
}

async function reportWeekly() {
  const now       = mskNow()
  const dayOfWeek = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1 // Пн=0
  const start     = new Date(now - dayOfWeek * 86400000); start.setUTCHours(0 - 3, 0, 0, 0)
  const end       = new Date(now); end.setUTCHours(23 - 3, 59, 59, 0)

  const leads = await fetchLeads(start.toISOString(), end.toISOString())
  if (!leads.length) return sendAll('😤 <b>Пустая неделя — 0 лидов</b>\nНа следующей надо взяться! 💪')
  return sendAll(buildReport(leads, 'Итоги недели'))
}

async function reportMonthly() {
  const now   = mskNow()
  const start = new Date(now); start.setUTCDate(1); start.setUTCHours(0 - 3, 0, 0, 0)
  const end   = new Date(now); end.setUTCHours(23 - 3, 59, 59, 0)
  const month = MONTH_NAMES_RU[now.getUTCMonth()]

  const leads = await fetchLeads(start.toISOString(), end.toISOString())
  if (!leads.length) return sendAll(`😤 <b>Месяц ${month} — 0 лидов</b>\nЭто вообще как?? 💀`)
  return sendAll(buildReport(leads, `Итоги месяца — ${month}`))
}

// ── Регистрация пользователя ──────────────────────────────────────────────────

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

// ── Webhook handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // GET: health check + ensure webhook + register commands
  if (req.method === 'GET') {
    await tg('setWebhook', { url: WEBHOOK_URL, drop_pending_updates: true })
    await tg('setMyCommands', {
      commands: [
        { command: 'today',   description: 'Отчёт за сегодня'  },
        { command: 'weekly',  description: 'Отчёт за неделю'   },
        { command: 'monthly', description: 'Отчёт за месяц'    },
        { command: 'app',     description: 'Открыть CRM'        },
        { command: 'help',    description: 'Справка'            },
      ],
    })
    return res.json({ ok: true, webhook: WEBHOOK_URL })
  }

  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update = req.body

    // ── Callback query (inline buttons) ──────────────────────────────────────
    const callback = update?.callback_query
    if (callback) {
      const data     = callback.data || ''
      const from     = callback.from
      const username = (from.username || '').toLowerCase()

      if (!ALLOWED_USERS.includes(username)) {
        await tg('answerCallbackQuery', { callback_query_id: callback.id, text: 'Нет доступа' })
        return res.json({ ok: true })
      }

      if (data.startsWith('pa:')) {
        const plid = data.slice(3)
        await fetch(`${MINI_APP_URL}/api/partner-approve`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Notify-Secret': NOTIFY_SECRET },
          body:    JSON.stringify({ action: 'approve', partner_lead_id: plid, reviewer: getDisplayName(username) }),
        })
        await tg('answerCallbackQuery', { callback_query_id: callback.id, text: '✅ Одобрено!' })
        await tg('editMessageReplyMarkup', {
          chat_id:     callback.message.chat.id,
          message_id:  callback.message.message_id,
          reply_markup: { inline_keyboard: [] },
        })
      }

      if (data.startsWith('pr:')) {
        const plid = data.slice(3)
        await fetch(`${MINI_APP_URL}/api/partner-approve`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Notify-Secret': NOTIFY_SECRET },
          body:    JSON.stringify({ action: 'reject', partner_lead_id: plid, reviewer: getDisplayName(username) }),
        })
        await tg('answerCallbackQuery', { callback_query_id: callback.id, text: '❌ Отклонено' })
        await tg('editMessageReplyMarkup', {
          chat_id:     callback.message.chat.id,
          message_id:  callback.message.message_id,
          reply_markup: { inline_keyboard: [] },
        })
      }

      return res.json({ ok: true })
    }

    const message = update?.message
    if (!message) return res.json({ ok: true })

    const text     = (message.text || '').split(' ')[0].toLowerCase()
    const user     = message.from
    const username = (user.username || '').toLowerCase()

    // ── Проверка доступа ──────────────────────────────────────────────────────
    if (!ALLOWED_USERS.includes(username)) {
      const rejects = [
        '🚫 Закрытый клуб, братан. Тебя не звали. Удачи в жизни 👋',
        '⛔️ Эй. Это не твой бот. Проходи мимо, не задерживайся.',
        '🙅 Доступа нет. Нет, это не баг. Нет, не пиши ещё раз.',
        '😐 Нет. Просто нет. Иди.',
        '🔒 Частная собственность. Посторонним вход воспрещён.',
        '👮 Стоп. Дальше не пройдёшь. Это не публичный бот 👋',
      ]
      const msg = rejects[Math.floor(Math.random() * rejects.length)]
      await tg('sendMessage', { chat_id: user.id, text: msg })
      return res.json({ ok: true })
    }

    // /start или /app
    if (text === '/start' || text === '/app') {
      const displayName = await registerUser(user)

      await tg('setChatMenuButton', {
        chat_id:     user.id,
        menu_button: { type: 'web_app', text: '📊 CRM', web_app: { url: MINI_APP_URL } },
      })

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

    // /today — отчёт за день
    else if (text === '/today') {
      await reportToday()
    }

    // /weekly — отчёт за неделю
    else if (text === '/weekly') {
      await reportWeekly()
    }

    // /monthly — отчёт за месяц
    else if (text === '/monthly') {
      await reportMonthly()
    }

    // /help
    else if (text === '/help') {
      await tg('sendMessage', {
        chat_id:    user.id,
        parse_mode: 'HTML',
        text:
          '<b>NN Company CRM</b>\n\n' +
          '/today — отчёт за сегодня\n' +
          '/weekly — отчёт за неделю\n' +
          '/monthly — отчёт за месяц\n' +
          '/app — открыть CRM\n' +
          '/help — эта справка',
      })
    }

  } catch (e) {
    console.error('Telegram handler error:', e)
  }

  res.status(200).json({ ok: true })
}
