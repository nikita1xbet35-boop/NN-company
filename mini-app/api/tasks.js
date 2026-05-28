const SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
const BOT_TOKEN    = '8991248806:AAF32CAHc4uKgflpkkFp5ZjdgUMJgIsq2KU'
const MINI_APP_URL = 'https://nn-company-qe1w.vercel.app'

const SB_H = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
}
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`

async function getAdminIds() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_users?select=id&username=in.(tsvetkovnv,haaaaaaav)`,
    { headers: SB_H }
  )
  const data = await r.json()
  return Array.isArray(data) ? data.map(row => row.id) : []
}

async function notifyNewTask(task) {
  const ids = await getAdminIds()
  const PRIORITY_EMOJI = { low: '🟢', medium: '🟡', high: '🔴' }
  const emoji = PRIORITY_EMOJI[task.priority] || '🟡'
  const deadline = task.deadline
    ? `\n📅 Дедлайн: ${new Date(task.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
    : ''
  const text =
    `📌 <b>Новая задача от ${task.created_by}</b>\n\n` +
    `${emoji} <b>${task.title}</b>` +
    (task.description ? `\n📝 ${task.description}` : '') +
    deadline

  await Promise.allSettled(ids.map(id =>
    fetch(`${TG}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    id,
        parse_mode: 'HTML',
        text,
        reply_markup: {
          inline_keyboard: [[{
            text:    '👀 Открыть задачу',
            web_app: { url: `${MINI_APP_URL}/#/tasks/${task.id}` },
          }]],
        },
      }),
    })
  ))
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { id, comments, addComment } = req.query || {}

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      // GET ?comments=TASK_ID → comments for a task
      if (comments) {
        const r = await fetch(
          `${SUPABASE_URL}/rest/v1/task_comments?task_id=eq.${comments}&order=created_at.asc&select=*`,
          { headers: SB_H }
        )
        return res.json(await r.json())
      }
      // GET → all tasks
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/tasks?order=created_at.desc&select=*`,
        { headers: SB_H }
      )
      return res.json(await r.json())
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      // POST ?addComment=TASK_ID → add comment
      if (addComment) {
        const { text, author } = req.body || {}
        if (!text || !author) return res.status(400).json({ error: 'Missing text or author' })
        const r = await fetch(`${SUPABASE_URL}/rest/v1/task_comments`, {
          method:  'POST',
          headers: { ...SB_H, 'Prefer': 'return=representation' },
          body:    JSON.stringify({ task_id: addComment, text: text.trim(), author }),
        })
        const data = await r.json()
        return res.json(Array.isArray(data) ? data[0] : data)
      }

      // POST → create task
      const { title, description, deadline, priority, created_by } = req.body || {}
      if (!title || !created_by) {
        return res.status(400).json({ error: 'Missing title or created_by' })
      }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
        method:  'POST',
        headers: { ...SB_H, 'Prefer': 'return=representation' },
        body:    JSON.stringify({
          title:       title.trim(),
          description: description?.trim() || null,
          deadline:    deadline || null,
          priority:    priority || 'medium',
          status:      'Новая',
          created_by,
        }),
      })
      const data = await r.json()
      const task = Array.isArray(data) ? data[0] : data
      if (task?.id) {
        notifyNewTask(task).catch(e => console.error('notify task error:', e))
      }
      return res.json({ ok: true, task })
    }

    // ── PATCH ?id=TASK_ID ─────────────────────────────────────────────────────
    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'Missing id' })
      const ALLOWED = ['title', 'description', 'deadline', 'priority', 'status']
      const body = { updated_at: new Date().toISOString() }
      for (const k of ALLOWED) {
        if ((req.body || {})[k] !== undefined) body[k] = req.body[k]
      }
      await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
        method:  'PATCH',
        headers: { ...SB_H, 'Prefer': 'return=minimal' },
        body:    JSON.stringify(body),
      })
      return res.json({ ok: true })
    }

    // ── DELETE ?id=TASK_ID ────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Missing id' })
      await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
        method:  'DELETE',
        headers: SB_H,
      })
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('Tasks error:', e)
    return res.status(500).json({ error: e.message })
  }
}
