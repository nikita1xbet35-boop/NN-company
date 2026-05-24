/**
 * Одноразовый эндпоинт — переименовывает пользователей в БД и шлёт уведомление Хаслу
 * Вызвать один раз: GET /api/rename
 */

const BOT_TOKEN    = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'

const SB_H = {
  apikey:        SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function updateName(username, display_name) {
  await fetch(`${SUPABASE_URL}/rest/v1/telegram_users?username=eq.${username}`, {
    method:  'PATCH',
    headers: { ...SB_H, Prefer: 'return=minimal' },
    body:    JSON.stringify({ display_name }),
  })
}

async function getUserId(username) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/telegram_users?username=eq.${username}&select=id`, { headers: SB_H })
  const data = await r.json()
  return data?.[0]?.id || null
}

async function sendMsg(chat_id, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id, parse_mode: 'HTML', text }),
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    // Обновляем имена в БД
    await Promise.all([
      updateName('tsvetkovnv', 'Никитос'),
      updateName('haaaaaaav',  'Хасл'),
    ])

    // Находим ID Хасла и шлём ему поздравление
    const haslId = await getUserId('haaaaaaav')
    if (haslId) {
      await sendMsg(haslId,
        `🎉 <b>ОФИЦИАЛЬНОЕ УВЕДОМЛЕНИЕ</b>\n\n` +
        `Гражданин Тритон 🔱,\n` +
        `настоящим сообщаем что с сегодняшнего дня ты официально <b>Хасл</b> 😈\n\n` +
        `Тритон умер. Да здравствует Хасл.\n\n` +
        `С уважением,\nNN Company CRM 🤝`
      )
    }

    // Никитосу тоже скажем
    const nikitosId = await getUserId('tsvetkovnv')
    if (nikitosId) {
      await sendMsg(nikitosId,
        `✅ Готово, Никитос!\n\nИмена обновлены:\n👤 Босс → <b>Никитос</b>\n👤 Тритон → <b>Хасл</b>`
      )
    }

    res.json({ ok: true, updated: ['Никитос', 'Хасл'] })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
