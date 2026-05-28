import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTelegramUser, haptic } from '../lib/telegram'
import { getDisplayName } from '../lib/config'

const ACCENT  = '#6366f1'
const CARD    = '#1a1a24'
const BORDER  = '#252535'
const PALE    = '#9ca3af'
const BG      = '#0f0f13'

const STATUS_CFG = {
  'Новая':    { color: '#6366f1', bg: '#6366f122' },
  'В работе': { color: '#fbbf24', bg: '#fbbf2422' },
  'Готово':   { color: '#10b981', bg: '#10b98122' },
}
const PRIORITY_CFG = {
  low:    { label: 'Низкий',   color: '#10b981' },
  medium: { label: 'Средний',  color: '#fbbf24' },
  high:   { label: 'Высокий',  color: '#ef4444' },
}

function getUser() {
  const u = getTelegramUser()
  return u ? getDisplayName(u.username) : 'Неизвестно'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isOverdue(deadline, status) {
  if (!deadline || status === 'Готово') return false
  return new Date(deadline) < new Date()
}

const FILTERS = [
  { key: 'all',       label: 'Все'        },
  { key: 'Новая',     label: '🟣 Новые'   },
  { key: 'В работе',  label: '🟡 В работе' },
  { key: 'Готово',    label: '✅ Готово'   },
]

export default function Tasks() {
  const navigate = useNavigate()
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    try {
      const r = await fetch('/api/tasks')
      const data = await r.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const displayed = filter === 'all'
    ? tasks
    : tasks.filter(t => t.status === filter)

  const counts = {
    Новая:    tasks.filter(t => t.status === 'Новая').length,
    'В работе': tasks.filter(t => t.status === 'В работе').length,
    Готово:   tasks.filter(t => t.status === 'Готово').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#f1f1f1', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Задачи</h1>
          <button
            onClick={() => { haptic('light'); setShowAdd(true) }}
            style={{
              padding: '8px 16px', borderRadius: '10px', border: 'none',
              background: ACCENT, color: '#fff', fontSize: '14px',
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            + Добавить
          </button>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {Object.entries(counts).map(([s, n]) => (
            <div key={s} style={{
              background: STATUS_CFG[s]?.bg,
              border: `1px solid ${STATUS_CFG[s]?.color}44`,
              borderRadius: '8px', padding: '4px 10px',
              fontSize: '12px', color: STATUS_CFG[s]?.color, fontWeight: 600,
            }}>
              {n} {s.toLowerCase()}
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none',
                background: filter === f.key ? ACCENT : CARD,
                color:      filter === f.key ? '#fff'   : PALE,
                fontSize: '12px', fontWeight: filter === f.key ? 700 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: PALE }}>Загружаем...</div>
        ) : displayed.length === 0 ? (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: '12px', padding: '32px', textAlign: 'center', color: PALE,
          }}>
            {filter === 'all' ? 'Задач пока нет' : 'Нет задач в этом статусе'}
          </div>
        ) : (
          displayed.map(task => {
            const overdue = isOverdue(task.deadline, task.status)
            const sc = STATUS_CFG[task.status]
            const pc = PRIORITY_CFG[task.priority]
            return (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                style={{
                  background:   CARD,
                  border:       `1px solid ${overdue ? '#ef444444' : BORDER}`,
                  borderRadius: '12px',
                  padding:      '12px 14px',
                  cursor:       'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: '15px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: task.status === 'Готово' ? 'line-through' : 'none',
                      color: task.status === 'Готово' ? PALE : '#f1f1f1',
                    }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{
                        fontSize: '12px', color: PALE, marginTop: '2px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {task.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        color: sc?.color, background: sc?.bg,
                        padding: '2px 7px', borderRadius: '5px',
                      }}>
                        {task.status}
                      </span>
                      <span style={{ fontSize: '11px', color: pc?.color, fontWeight: 600 }}>
                        {pc?.label}
                      </span>
                      {task.deadline && (
                        <span style={{ fontSize: '11px', color: overdue ? '#ef4444' : PALE }}>
                          📅 {formatDate(task.deadline)}{overdue ? ' — просрочено!' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: PALE, flexShrink: 0, textAlign: 'right' }}>
                    {task.created_by}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {showAdd && (
        <AddTaskModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}

// ── Add task modal ─────────────────────────────────────────────────────────────

function AddTaskModal({ onClose, onCreated }) {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [deadline,    setDeadline]    = useState('')
  const [priority,    setPriority]    = useState('medium')
  const [saving,      setSaving]      = useState(false)

  const inputSt = {
    width: '100%', padding: '11px 12px', borderRadius: '10px',
    border: `1px solid ${BORDER}`, background: '#12121a',
    color: '#f1f1f1', fontSize: '14px', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title,
          description: description.trim() || null,
          deadline:    deadline || null,
          priority,
          created_by:  getUser(),
        }),
      })
      if (!r.ok) throw new Error('Ошибка сервера')
      haptic('success')
      onCreated()
    } catch (e) {
      alert('Ошибка: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: CARD, borderRadius: '20px 20px 0 0',
        padding: '24px', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px' }}>Новая задача</h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ЗАГОЛОВОК *
            </label>
            <input
              autoFocus
              type="text"
              placeholder="Что нужно сделать?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={inputSt}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ОПИСАНИЕ
            </label>
            <textarea
              placeholder="Подробности..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ДЕДЛАЙН
              </label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                style={{ ...inputSt, colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ПРИОРИТЕТ
              </label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={inputSt}>
                <option value="low">🟢 Низкий</option>
                <option value="medium">🟡 Средний</option>
                <option value="high">🔴 Высокий</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '13px', borderRadius: '12px', border: `1px solid ${BORDER}`,
                background: 'transparent', color: PALE, fontSize: '15px', cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              style={{
                padding: '13px', borderRadius: '12px', border: 'none',
                background: saving || !title.trim() ? '#3d3d6b' : ACCENT,
                color: '#fff', fontSize: '15px', fontWeight: 700,
                cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '...' : '✅ Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
