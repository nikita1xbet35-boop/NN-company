const { verifyInitData, getPartner, getPartnerByUsername, PARTNER_BOT_TOKEN, SUPABASE_URL, SB_H } = require('./lib/partnerAuth')

const MINI_APP_URL  = 'https://nn-company-qe1w.vercel.app'
const PARTNER_TG    = `https://api.telegram.org/bot${PARTNER_BOT_TOKEN}`
const WEBHOOK_URL   = `${MINI_APP_URL}/api/partner-telegram`

const REJECT_MSGS = [
  '🚫 Слушай, ты не в списке. Это партнёрский бот, братан, не такси.',
  '⛔️ Ой, незнакомец. Тут только свои, понимаешь?',
  '🙅 Мимо. Буквально мимо. Зайди с другой стороны — нет, не в смысле через другую дверь.',
  '😐 Не-а. Ты кто вообще? Мы незнакомы.',
  '🔒 Клуб закрыт, пропуска нет. Следующий автобус через никогда.',
  '👮 Стоп-стоп-стоп. Куда? Нет, серьёзно, куда ты идёшь?',
  '🤨 Партнёрство — это серьёзно. А ты, похоже, попал сюда случайно.',
  '💀 Да ты хоть знаешь где оказался? Уходи, пока не поздно.',
]

async function tg(method, body) {
  return fetch(`${PARTNER_TG}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

async function registerPartnerTelegramId(username, telegramId) {
  // Update telegram_id for existing partner by username
  await fetch(
    `${SUPABASE_URL}/rest/v1/partners?username=eq.${encodeURIComponent(username)}`,
    {
      method:  'PATCH',
      headers: { ...SB_H, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ telegram_id: telegramId }),
    }
  )
}

async function getPartnerStats(partnerId) {
  const [leadsR, payoutsR] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/partner_leads?partner_id=eq.${partnerId}&select=payout_to_partner,approval_status`, { headers: SB_H }),
    fetch(`${SUPABASE_URL}/rest/v1/partner_payouts?partner_id=eq.${partnerId}&select=amount`, { headers: SB_H }),
  ])
  const leads   = await leadsR.json().catch(() => [])
  const payouts = await payoutsR.json().catch(() => [])

  const approved = Array.isArray(leads) ? leads.filter(l => l.approval_status === 'approved') : []
  const earned   = approved.reduce((s, l) => s + Number(l.payout_to_partner || 0), 0)
  const paid     = Array.isArray(payouts) ? payouts.reduce((s, p) => s + Number(p.amount || 0), 0) : 0
  const pending  = Array.isArray(leads) ? leads.filter(l => l.approval_status === 'pending').reduce((s, l) => s + Number(l.payout_to_partner || 0), 0) : 0

  return { earned, paid, owed: Math.max(0, earned - paid), pending }
}

async function getLeadCounts(partnerId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/partner_leads?partner_id=eq.${partnerId}&select=approval_status`, { headers: SB_H })
  const leads = await r.json().catch(() => [])
  if (!Array.isArray(leads)) return { total: 0, pending: 0, approved: 0, rejected: 0 }
  return {
    total:    leads.length,
    pending:  leads.filter(l => l.approval_status === 'pending').length,
    approved: leads.filter(l => l.approval_status === 'approved').length,
    rejected: leads.filter(l => l.approval_status === 'rejected').length,
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // GET: setup webhook + commands
  if (req.method === 'GET') {
    await tg('setWebhook', { url: WEBHOOK_URL, drop_pending_updates: true })
    await tg('setMyCommands', {
      commands: [
        { command: 'start',   description: 'Начало работы'      },
        { command: 'balance', description: 'Мой баланс'         },
        { command: 'leads',   description: 'Мои лиды'           },
        { command: 'help',    description: 'Список команд'       },
      ],
    })
    return res.json({ ok: true, webhook: WEBHOOK_URL })
  }

  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update   = req.body
    const message  = update?.message
    if (!message) return res.json({ ok: true })

    const text     = (message.text || '').split(' ')[0].toLowerCase()
    const user     = message.from
    const username = (user.username || '').replace('@', '').toLowerCase()

    // Whitelist check
    const partner = await getPartnerByUsername(username)

    if (!partner || !partner.is_active) {
      const msg = REJECT_MSGS[Math.floor(Math.random() * REJECT_MSGS.length)]
      await tg('sendMessage', { chat_id: user.id, text: msg })
      return res.json({ ok: true })
    }

    // Register telegram_id if missing
    if (!partner.telegram_id) {
      await registerPartnerTelegramId(username, user.id)
    }

    if (text === '/start') {
      await tg('sendMessage', {
        chat_id:    user.id,
        parse_mode: 'HTML',
        text:
          `Привет, <b>${partner.display_name}</b>! 🤝\n\n` +
          `Добро пожаловать в партнёрскую программу <b>NN Company</b>.\n\n` +
          `Здесь ты можешь:\n` +
          `• Добавлять лиды через приложение\n` +
          `• Отслеживать статус и выплаты\n` +
          `• Смотреть актуальные офферы\n\n` +
          `Жми кнопку 👇`,
        reply_markup: {
          inline_keyboard: [[{
            text:    '💎 Открыть партнёрский кабинет',
            web_app: { url: `${MINI_APP_URL}/#/partner` },
          }]],
        },
      })
    }

    else if (text === '/balance') {
      const stats = await getPartnerStats(partner.id)
      await tg('sendMessage', {
        chat_id:    user.id,
        parse_mode: 'HTML',
        text:
          `💰 <b>Баланс: ${partner.display_name}</b>\n\n` +
          `✅ Заработано: <b>${fmt(stats.earned)}</b>\n` +
          `💸 Выплачено:  <b>${fmt(stats.paid)}</b>\n` +
          `⏳ К выплате:  <b>${fmt(stats.owed)}</b>\n` +
          `🟡 На проверке: <b>${fmt(stats.pending)}</b>`,
      })
    }

    else if (text === '/leads') {
      const counts = await getLeadCounts(partner.id)
      await tg('sendMessage', {
        chat_id:    user.id,
        parse_mode: 'HTML',
        text:
          `📋 <b>Твои лиды</b>\n\n` +
          `Всего: <b>${counts.total}</b>\n` +
          `🟡 На проверке: <b>${counts.pending}</b>\n` +
          `✅ Одобрено: <b>${counts.approved}</b>\n` +
          `❌ Отклонено: <b>${counts.rejected}</b>\n\n` +
          `Подробнее — в партнёрском кабинете 👇`,
        reply_markup: {
          inline_keyboard: [[{
            text:    '📋 Открыть кабинет',
            web_app: { url: `${MINI_APP_URL}/#/partner` },
          }]],
        },
      })
    }

    else if (text === '/help') {
      await tg('sendMessage', {
        chat_id:    user.id,
        parse_mode: 'HTML',
        text:
          '🤝 <b>Партнёрский бот NN Company</b>\n\n' +
          '/start — начало работы + кнопка кабинета\n' +
          '/balance — твой баланс (заработано / выплачено)\n' +
          '/leads — количество лидов по статусам\n' +
          '/help — эта справка\n\n' +
          'Всё остальное — через кабинет 😎',
      })
    }

    else {
      await tg('sendMessage', {
        chat_id:    user.id,
        parse_mode: 'HTML',
        text: `Используй команды 👇 или открой кабинет:`,
        reply_markup: {
          inline_keyboard: [[{
            text:    '💎 Партнёрский кабинет',
            web_app: { url: `${MINI_APP_URL}/#/partner` },
          }]],
        },
      })
    }

  } catch (e) {
    console.error('Partner telegram handler error:', e)
  }

  return res.status(200).json({ ok: true })
}
