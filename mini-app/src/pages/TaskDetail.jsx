import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTelegramUser, haptic } from '../lib/telegram'
import { getDisplayName } from '../lib/config'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const ACCENT = '#6366f1'
const CARD   = '#1a1a24'
const BORDER = '#252535'
const PALE   = '#9ca3af'
const BG     = '#0f0f13'

const STATUS_CFG = {
  'Новая':    { color: '#6366f1', bg: '#6366f122' },
  'В работе': { color: '#fbbf24', bg: '#fbbf2422' },
  'Готово':   { color: '#10b981', bg: '#10b98122' },
}
const STATUSES   = ['Новая', 'В работе', 'Готово']
const PRIORITY_CFG = {
  low:    { label: 'Низкий',  color: '#10b981', emoji: '🟢' },
  medium: { label: 'Средний', color: '#fbbf24', emoji: '🟡' },
  high:   { label: 'Высокий', color: '#ef4444', emoji: '🔴' },
}

function getUser() {
  const u = getTelegramUser()
  return u ? getDisplayName(u.username) : 'Неизвестно'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function TaskDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [task,     setTask]     = useState(null)
  const [comments, setComments] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [commentText, setCommentText] = useState('')
  const [sending,  setSending]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  async function load() {
    try {
      const [taskR, commentsR] = await Promise.all([
        fetch(`/api/tasks`).then(r => r.json()),
        fetch(`/api/tasks?comments=${id}`).then(r => r.json()),
      ])
      const found = Array.isArray(taskR) ? taskR.find(t => t.id === id) : null
      setTask(found || null)
      setComments(Array.isArray(commentsR) ? commentsR : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function changeStatus(newStatus) {
    if (!task || newStatus === task.status || saving) return
    setSaving(true)
    haptic('light')
    try {
      await fetch(`/api/tasks?id=${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      setTask(t => ({ ...t, status: newStatus }))
      haptic('success')
    } catch (e) {
      haptic('error')
    } finally {
      setSaving(false)
    }
  }

  async function addComment() {
    if (!commentText.trim() || sending) return
    setSending(true)
    try {
      const r = await fetch(`/api/tasks?addComment=${id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: commentText.trim(), author: getUser() }),
      })
      const comment = await r.json()
      setComments(prev => [...prev, comment])
      setCommentText('')
      haptic('success')
    } catch (e) {
      haptic('error')
    } finally {
      setSending(false)
    }
  }

  async function deleteTask() {
    setSaving(true)
    try {
      await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      haptic('success')
      navigate('/tasks')
    } catch (e) {
      haptic('error')
    } finally {
      setSaving(false)
      setShowDelete(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', background: BG, minHeight: '100vh' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #252535', borderTop: `3px solid ${ACCENT}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!task) return (
    <div style={{ padding: '20px', color: '#ef4444', background: BG, minHeight: '100vh' }}>
      Задача не найдена
    </div>
  )

  const sc = STATUS_CFG[task.status] || STATUS_CFG['Новая']
  const pc = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium
  const overdue = task.deadline && task.status !== 'Готово' && new Date(task.deadline) < new Date()

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#f1f1f1', padding: '16px', paddingBottom: '40px' }}>
      {/* Back */}
      <button
        onClick={() => navigate('/tasks')}
        style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '15px', cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        ← Назад
      </button>

      {/* Title & status */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <h1 style={{
            fontSize: '20px', fontWeight: 800, margin: 0,
            textDecoration: task.status === 'Готово' ? 'line-through' : 'none',
            color: task.status === 'Готово' ? PALE : '#f1f1f1',
          }}>
            {task.title}
          </h1>
          <button
            onClick={() => setShowDelete(true)}
            style={{
              padding: '6px 10px', borderRadius: '8px', border: `1px solid #ef4444`,
              background: '#2d0f0f', color: '#f87171', fontSize: '14px', cursor: 'pointer', flexShrink: 0,
            }}
          >
            🗑
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: sc.color, background: sc.bg, padding: '3px 9px', borderRadius: '6px' }}>
            {task.status}
          </span>
          <span style={{ fontSize: '12px', color: pc.color, fontWeight: 600 }}>
            {pc.emoji} {pc.label}
          </span>
          {task.deadline && (
            <span style={{ fontSize: '12px', color: overdue ? '#ef4444' : PALE }}>
              📅 {formatDate(task.deadline)}{overdue ? ' — просрочено!' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: '12px', padding: '14px', marginBottom: '14px',
        }}>
          <div style={{ fontSize: '11px', color: PALE, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Описание
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#d1d5db', lineHeight: 1.5 }}>
            {task.description}
          </p>
        </div>
      )}

      {/* Meta */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: '12px', padding: '14px', marginBottom: '14px',
      }}>
        <Row label="Создал" value={task.created_by} />
        <Row label="Создано" value={format(new Date(task.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })} last />
      </div>

      {/* Status switcher */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: '12px', padding: '14px', marginBottom: '14px',
      }}>
        <div style={{ fontSize: '11px', color: PALE, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
          Статус
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {STATUSES.map(s => {
            const cfg     = STATUS_CFG[s]
            const current = s === task.status
            return (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={saving}
                style={{
                  flex: 1, padding: '10px 4px', borderRadius: '10px', border: 'none',
                  background: current ? cfg.bg : '#12121a',
                  color:      current ? cfg.color : PALE,
                  fontSize: '12px', fontWeight: current ? 700 : 400,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  outline: current ? `1px solid ${cfg.color}66` : 'none',
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>

      {/* Comments */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: '12px', padding: '14px', marginBottom: '14px',
      }}>
        <div style={{ fontSize: '11px', color: PALE, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          Комментарии ({comments.length})
        </div>

        {comments.length === 0 ? (
          <p style={{ color: PALE, fontSize: '13px', margin: '0 0 12px' }}>Нет комментариев</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            {comments.map(c => (
              <div key={c.id} style={{
                background: '#12121a', borderRadius: '10px', padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: ACCENT }}>{c.author}</span>
                  <span style={{ fontSize: '11px', color: PALE }}>
                    {format(new Date(c.created_at), 'd MMM, HH:mm', { locale: ru })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#d1d5db', lineHeight: 1.5 }}>{c.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Написать комментарий..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addComment()}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: '10px',
              border: `1px solid ${BORDER}`, background: '#12121a',
              color: '#f1f1f1', fontSize: '13px', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={addComment}
            disabled={sending || !commentText.trim()}
            style={{
              padding: '10px 14px', borderRadius: '10px', border: 'none',
              background: sending || !commentText.trim() ? '#2a2a3a' : ACCENT,
              color: '#fff', fontSize: '13px', fontWeight: 700,
              cursor: sending || !commentText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? '...' : '↑'}
          </button>
        </div>
      </div>

      {/* Delete modal */}
      {showDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => e.target === e.currentTarget && setShowDelete(false)}
        >
          <div style={{ background: CARD, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '360px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700 }}>Удалить задачу?</h3>
            <p style={{ color: PALE, fontSize: '14px', margin: '0 0 20px' }}>
              <b style={{ color: '#f1f1f1' }}>{task.title}</b> и все комментарии будут удалены безвозвратно.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', background: BORDER, color: PALE, fontSize: '15px', cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={deleteTask} disabled={saving} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? '...' : '🗑 Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: last ? 0 : '10px', marginBottom: last ? 0 : '10px',
      borderBottom: last ? 'none' : `1px solid ${BORDER}`,
    }}>
      <span style={{ fontSize: '13px', color: PALE }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#d1d5db' }}>{value}</span>
    </div>
  )
}
