import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getLead, updateLeadStatus, updateLeadComment, updateLead, getStatusHistory, deleteLead } from '../lib/supabase'
import { notifyStatusChange } from '../lib/api'
import { STATUSES, STATUS_COLORS, OFFERS, fmtMoney, getDisplayName } from '../lib/config'
import { getTelegramUser, haptic } from '../lib/telegram'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead]       = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showStatus, setShowStatus]   = useState(false)
  const [showDelete, setShowDelete]   = useState(false)
  const [showEdit, setShowEdit]       = useState(false)
  const [editComment, setEditComment] = useState(false)
  const [commentVal, setCommentVal]   = useState('')
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({})
  const [editErrors, setEditErrors] = useState({})

  async function load() {
    try {
      const [l, h] = await Promise.all([getLead(id), getStatusHistory(id)])
      setLead(l)
      setHistory(h || [])
      setCommentVal(l.comment || '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  function openEdit() {
    setEditForm({
      full_name:   lead.full_name   || '',
      phone:       lead.phone       || '',
      contact:     lead.contact     || '',
      offer:       lead.offer       || '',
      revenue:     lead.revenue     != null ? String(lead.revenue) : '',
      payout:      lead.payout      != null ? String(lead.payout)  : '',
      referred_by: lead.referred_by || '',
      comment:     lead.comment     || '',
    })
    setEditErrors({})
    setShowEdit(true)
  }

  function setEditField(key, val) {
    setEditForm(f => ({ ...f, [key]: val }))
    if (editErrors[key]) setEditErrors(e => ({ ...e, [key]: '' }))
  }

  function validateEdit() {
    const e = {}
    if (!editForm.full_name.trim()) e.full_name = 'Обязательное поле'
    if (!editForm.phone.trim())     e.phone     = 'Обязательное поле'
    if (!editForm.contact.trim())   e.contact   = 'Обязательное поле'
    if (!editForm.offer)            e.offer     = 'Выберите оффер'
    if (editForm.payout  === '')    e.payout    = 'Введите сумму'
    if (editForm.revenue === '')    e.revenue   = 'Введите сумму'
    return e
  }

  async function saveEdit() {
    const errs = validateEdit()
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs)
      haptic('error')
      return
    }
    setSaving(true)
    try {
      await updateLead(id, {
        full_name:   editForm.full_name.trim(),
        phone:       editForm.phone.trim(),
        contact:     editForm.contact.trim(),
        offer:       editForm.offer,
        revenue:     parseFloat(editForm.revenue)     || 0,
        payout:      parseFloat(editForm.payout)      || 0,
        referred_by: editForm.referred_by.trim() || null,
        comment:     editForm.comment.trim()     || null,
      })
      haptic('success')
      setShowEdit(false)
      await load()
    } catch (e) {
      console.error(e)
      haptic('error')
      alert('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(newStatus) {
    if (newStatus === lead.status) { setShowStatus(false); return }
    setSaving(true)
    try {
      const tgUser    = getTelegramUser()
      const changedBy = tgUser ? getDisplayName(tgUser.username) : 'Неизвестно'
      await updateLeadStatus(id, newStatus, changedBy, lead.status)
      notifyStatusChange({
        full_name:  lead.full_name,
        offer:      lead.offer,
        new_status: newStatus,
        changed_by: changedBy,
        lead_id:    id,
      })
      haptic('success')
      await load()
    } catch (e) {
      console.error(e)
      haptic('error')
    } finally {
      setSaving(false)
      setShowStatus(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteLead(id)
      haptic('success')
      navigate('/leads')
    } catch (e) {
      console.error(e)
      haptic('error')
    } finally {
      setSaving(false)
      setShowDelete(false)
    }
  }

  async function saveComment() {
    setSaving(true)
    try {
      await updateLeadComment(id, commentVal)
      setLead(l => ({ ...l, comment: commentVal }))
      haptic('success')
      setEditComment(false)
    } catch (e) {
      haptic('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!lead)   return <div style={{ padding: '20px', color: '#ef4444' }}>Лид не найден</div>

  return (
    <div style={{ padding: '16px', paddingBottom: '40px' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '15px', cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        ← Назад
      </button>

      {/* Name & Status */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#f1f1f1', margin: '0 0 8px' }}>
          {lead.full_name}
        </h1>
        <StatusBadge status={lead.status} size="lg" />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setShowStatus(true)}
          style={{
            flex: 1, padding: '13px', borderRadius: '12px',
            border: '1px solid #6366f1', background: '#1e1e3a',
            color: '#a5b4fc', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          🔄 Статус
        </button>
        <button
          onClick={openEdit}
          style={{
            flex: 1, padding: '13px', borderRadius: '12px',
            border: '1px solid #374151', background: '#1a1a24',
            color: '#d1d5db', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✏️ Изменить
        </button>
        <button
          onClick={() => setShowDelete(true)}
          style={{
            padding: '13px 16px', borderRadius: '12px',
            border: '1px solid #ef4444', background: '#2d0f0f',
            color: '#f87171', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          🗑
        </button>
      </div>

      {/* Info card */}
      <Card title="Информация о лиде">
        <Row icon="📱" label="Телефон"   value={lead.phone} />
        <Row icon="🔗" label="Контакт"   value={lead.contact} link />
        <Row icon="📋" label="Оффер"     value={lead.offer} />
        <Row icon="💰" label="Доход"     value={fmtMoney(lead.revenue)} color="#10b981" />
        <Row icon="💸" label="Выплата"   value={fmtMoney(lead.payout)}  color="#f59e0b" />
        <Row icon="📈" label="Прибыль"   value={fmtMoney(lead.revenue - lead.payout)} color={lead.revenue - lead.payout >= 0 ? '#6366f1' : '#ef4444'} />
        {lead.referred_by && <Row icon="👥" label="Кто привёл" value={lead.referred_by} />}
        <Row icon="🧑" label="Добавил"  value={lead.added_by} />
        <Row icon="📅" label="Создан"   value={format(new Date(lead.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })} />
      </Card>

      {/* Comment */}
      <Card title="Комментарий">
        {editComment ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea
              value={commentVal}
              onChange={e => setCommentVal(e.target.value)}
              rows={4}
              autoFocus
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                border: '1px solid #252535', background: '#252535',
                color: '#f1f1f1', fontSize: '14px', resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditComment(false)} style={{ ...smallBtn, background: '#252535', color: '#9ca3af' }}>
                Отмена
              </button>
              <button onClick={saveComment} disabled={saving} style={{ ...smallBtn, flex: 2 }}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: lead.comment ? '#d1d5db' : '#4b5563', fontSize: '14px', margin: '0 0 12px', lineHeight: 1.5 }}>
              {lead.comment || 'Нет комментария'}
            </p>
            <button onClick={() => setEditComment(true)} style={{ ...smallBtn, background: '#252535', color: '#9ca3af' }}>
              ✏️ {lead.comment ? 'Редактировать' : 'Добавить'}
            </button>
          </div>
        )}
      </Card>

      {/* Status history */}
      <Card title={`История статусов (${history.length})`}>
        {history.length === 0 ? (
          <p style={{ color: '#4b5563', fontSize: '14px' }}>Нет изменений</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: '1px solid #1e1e2e' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <StatusBadge status={h.old_status} />
                    <span style={{ color: '#4b5563', fontSize: '12px' }}>→</span>
                    <StatusBadge status={h.new_status} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    👤 {h.changed_by}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#4b5563', textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                  {format(new Date(h.changed_at), 'd MMM, HH:mm', { locale: ru })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Change Status Modal */}
      <Modal open={showStatus} onClose={() => setShowStatus(false)} title="Выберите статус">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {STATUSES.map(s => {
            const colors  = STATUS_COLORS[s]
            const current = s === lead.status
            return (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={saving}
                style={{
                  padding:      '14px 16px',
                  borderRadius: '12px',
                  border:       current ? `2px solid ${colors.dot}` : '2px solid transparent',
                  background:   current ? colors.bg : '#252535',
                  color:        colors.text,
                  fontSize:     '15px',
                  fontWeight:   600,
                  cursor:       saving ? 'not-allowed' : 'pointer',
                  textAlign:    'left',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '10px',
                }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors.dot }} />
                {s}
                {current && <span style={{ marginLeft: 'auto', fontSize: '16px' }}>✓</span>}
              </button>
            )
          })}
        </div>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Редактировать лида">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <EditField label="ФИО *" error={editErrors.full_name}>
            <input
              type="text"
              value={editForm.full_name || ''}
              onChange={e => setEditField('full_name', e.target.value)}
              style={eInput(editErrors.full_name)}
            />
          </EditField>

          <EditField label="Телефон *" error={editErrors.phone}>
            <input
              type="tel"
              value={editForm.phone || ''}
              onChange={e => setEditField('phone', e.target.value)}
              style={eInput(editErrors.phone)}
            />
          </EditField>

          <EditField label="Контакт *" error={editErrors.contact}>
            <input
              type="text"
              value={editForm.contact || ''}
              onChange={e => setEditField('contact', e.target.value)}
              style={eInput(editErrors.contact)}
            />
          </EditField>

          <EditField label="Оффер *" error={editErrors.offer}>
            <select
              value={editForm.offer || ''}
              onChange={e => setEditField('offer', e.target.value)}
              style={eInput(editErrors.offer)}
            >
              <option value="">Выберите оффер...</option>
              {OFFERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </EditField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <EditField label="Доход ₽ *" error={editErrors.revenue}>
              <input
                type="number"
                value={editForm.revenue || ''}
                onChange={e => setEditField('revenue', e.target.value)}
                min="0"
                style={eInput(editErrors.revenue)}
              />
            </EditField>
            <EditField label="Выплата ₽ *" error={editErrors.payout}>
              <input
                type="number"
                value={editForm.payout || ''}
                onChange={e => setEditField('payout', e.target.value)}
                min="0"
                style={eInput(editErrors.payout)}
              />
            </EditField>
          </div>

          <EditField label="Кто привёл">
            <input
              type="text"
              value={editForm.referred_by || ''}
              onChange={e => setEditField('referred_by', e.target.value)}
              style={eInput()}
            />
          </EditField>

          <EditField label="Комментарий">
            <textarea
              value={editForm.comment || ''}
              onChange={e => setEditField('comment', e.target.value)}
              rows={3}
              style={{ ...eInput(), resize: 'vertical', fontFamily: 'inherit' }}
            />
          </EditField>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={() => setShowEdit(false)}
              style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#252535', color: '#9ca3af', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
            >
              Отмена
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: saving ? '#3d3d6b' : '#6366f1', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Сохраняем...' : '✅ Сохранить'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Удалить лида?">
        <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.5, marginBottom: '20px' }}>
          <b style={{ color: '#f1f1f1' }}>{lead.full_name}</b> будет удалён из базы безвозвратно.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowDelete(false)}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#252535', color: '#9ca3af', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
          >
            Отмена
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: saving ? '#5a1a1a' : '#ef4444', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Удаляем...' : '🗑 Удалить'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#1a1a24', borderRadius: '16px', padding: '16px', marginBottom: '14px', border: '1px solid #252535' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({ icon, label, value, color, link }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #1e1e2e' }}>
      <span style={{ fontSize: '13px', color: '#6b7280' }}>{icon} {label}</span>
      {link ? (
        <a href={value.startsWith('http') ? value : `https://t.me/${value.replace('@', '')}`} target="_blank" rel="noreferrer"
          style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </a>
      ) : (
        <span style={{ fontSize: '14px', fontWeight: 600, color: color || '#d1d5db', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </span>
      )}
    </div>
  )
}

function EditField({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      {children}
      {error && <span style={{ fontSize: '11px', color: '#ef4444' }}>{error}</span>}
    </div>
  )
}

function eInput(error) {
  return {
    width: '100%', padding: '11px 12px', borderRadius: '10px',
    border: `1px solid ${error ? '#ef4444' : '#2a2a3a'}`,
    background: '#252535', color: '#f1f1f1', fontSize: '14px',
    boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  }
}

const smallBtn = { padding: '10px 16px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #252535', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
