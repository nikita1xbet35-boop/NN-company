import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTelegramUser, haptic } from '../lib/telegram'

const ACCENT = '#6366f1'
const CARD   = '#1a1a24'
const BORDER = '#252535'
const PALE   = '#9ca3af'

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

function getInitData() {
  return window.Telegram?.WebApp?.initData || ''
}

function inputStyle(err) {
  return {
    width:        '100%',
    padding:      '12px',
    borderRadius: '10px',
    border:       `1px solid ${err ? '#ef4444' : BORDER}`,
    background:   '#12121a',
    color:        '#f1f1f1',
    fontSize:     '14px',
    boxSizing:    'border-box',
    outline:      'none',
    fontFamily:   'inherit',
  }
}

// ─── Add partner modal ────────────────────────────────────────────────────────
function AddPartnerModal({ onClose, onAdded }) {
  const [form,    setForm]    = useState({ username: '', display_name: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState({})

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }))
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const errs = {}
    if (!form.username.trim())     errs.username     = 'Обязательное поле'
    if (!form.display_name.trim()) errs.display_name = 'Обязательное поле'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const r = await fetch('/api/partners', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Init-Data': getInitData() },
        body:    JSON.stringify({
          username:     form.username.trim().replace('@', ''),
          display_name: form.display_name.trim(),
          notes:        form.notes.trim() || null,
        }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Ошибка')
      }
      haptic('success')
      onAdded()
      onClose()
    } catch (e) {
      alert('Ошибка: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position:   'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:   '#1a1a24',
        borderRadius: '20px 20px 0 0',
        padding:      '24px',
        width:        '100%',
        maxWidth:     '480px',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f1f1', marginBottom: '20px' }}>
          Добавить партнёра
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '4px' }}>USERNAME *</label>
            <input
              type="text" placeholder="@username"
              value={form.username}
              onChange={e => setField('username', e.target.value)}
              style={inputStyle(errors.username)}
            />
            {errors.username && <span style={{ fontSize: '11px', color: '#ef4444' }}>{errors.username}</span>}
          </div>
          <div>
            <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '4px' }}>ИМЯ *</label>
            <input
              type="text" placeholder="Иван Иванов"
              value={form.display_name}
              onChange={e => setField('display_name', e.target.value)}
              style={inputStyle(errors.display_name)}
            />
            {errors.display_name && <span style={{ fontSize: '11px', color: '#ef4444' }}>{errors.display_name}</span>}
          </div>
          <div>
            <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '4px' }}>ЗАМЕТКИ</label>
            <textarea
              placeholder="Необязательно..."
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              rows={2}
              style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={{
              padding: '12px', borderRadius: '10px', border: `1px solid ${BORDER}`,
              background: 'transparent', color: PALE, fontSize: '14px', cursor: 'pointer',
            }}>Отмена</button>
            <button type="submit" disabled={loading} style={{
              padding: '12px', borderRadius: '10px', border: 'none',
              background: ACCENT, color: '#fff', fontSize: '14px',
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Partners() {
  const navigate = useNavigate()
  const [partners,  setPartners]  = useState([])
  const [pending,   setPending]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    try {
      const [partnersR, pendingR] = await Promise.all([
        fetch('/api/partners', { headers: { 'X-Admin-Init-Data': getInitData() } }),
        fetch(`https://lkthwgntdaduitqnfvem.supabase.co/rest/v1/partner_leads?approval_status=eq.pending&order=created_at.desc&select=*`, {
          headers: {
            apikey:        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E',
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E',
          },
        }),
      ])
      const partnersData = partnersR.ok ? await partnersR.json() : []
      const pendingData  = pendingR.ok  ? await pendingR.json()  : []

      // Enrich pending with partner name
      const partnerMap = {}
      if (Array.isArray(partnersData)) {
        partnersData.forEach(p => { partnerMap[p.id] = p.display_name })
      }
      const enrichedPending = Array.isArray(pendingData)
        ? pendingData.map(l => ({ ...l, partner_name: partnerMap[l.partner_id] || '?' }))
        : []

      setPartners(Array.isArray(partnersData) ? partnersData : [])
      setPending(enrichedPending)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleApprove(leadId) {
    haptic('success')
    try {
      const tgUser = getTelegramUser()
      const reviewer = tgUser?.username === 'tsvetkovnv' ? 'Никитос' : tgUser?.username === 'haaaaaaav' ? 'Хасл' : 'Админ'
      await fetch('/api/partner-approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Notify-Secret': 'nn_notify_secret_x9k2p7m4' },
        body:    JSON.stringify({ action: 'approve', partner_lead_id: leadId, reviewer }),
      })
      load()
    } catch (e) { alert('Ошибка: ' + e.message) }
  }

  async function handleReject(leadId) {
    haptic('error')
    const reason = prompt('Причина отклонения (необязательно):') ?? undefined
    try {
      const tgUser = getTelegramUser()
      const reviewer = tgUser?.username === 'tsvetkovnv' ? 'Никитос' : tgUser?.username === 'haaaaaaav' ? 'Хасл' : 'Админ'
      await fetch('/api/partner-approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Notify-Secret': 'nn_notify_secret_x9k2p7m4' },
        body:    JSON.stringify({ action: 'reject', partner_lead_id: leadId, reviewer, rejection_reason: reason }),
      })
      load()
    } catch (e) { alert('Ошибка: ' + e.message) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f0f13' }}>
      <div style={{ color: PALE, textAlign: 'center' }}>
        <div style={{ fontSize: '32px' }}>🤝</div>
        <div>Загружаем...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', color: '#f1f1f1', padding: '16px', paddingBottom: '88px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Партнёры</h1>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding:      '8px 16px',
            borderRadius: '10px',
            border:       'none',
            background:   ACCENT,
            color:        '#fff',
            fontSize:     '13px',
            fontWeight:   700,
            cursor:       'pointer',
          }}
        >
          + Добавить
        </button>
      </div>

      {/* Pending queue */}
      {pending.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fbbf24', marginBottom: '12px' }}>
            ⏳ Очередь на проверку ({pending.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pending.map(lead => (
              <div key={lead.id} style={{
                background:   CARD,
                border:       '1px solid #3d2e00',
                borderRadius: '14px',
                padding:      '14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{lead.full_name}</div>
                    <div style={{ fontSize: '12px', color: PALE }}>🤝 {lead.partner_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981' }}>
                      {fmt(lead.payout_to_partner)}
                    </div>
                    <div style={{ fontSize: '11px', color: PALE }}>{lead.offer}</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: PALE, marginBottom: '10px' }}>
                  📞 {lead.contact}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    onClick={() => handleApprove(lead.id)}
                    style={{
                      padding: '10px', borderRadius: '10px', border: 'none',
                      background: '#10b981', color: '#fff', fontSize: '13px',
                      fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ✅ Одобрить
                  </button>
                  <button
                    onClick={() => handleReject(lead.id)}
                    style={{
                      padding: '10px', borderRadius: '10px', border: 'none',
                      background: '#ef444422', color: '#f87171', fontSize: '13px',
                      fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ❌ Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Partners list */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f1f1f1', marginBottom: '12px' }}>
          👥 Партнёры ({partners.length})
        </h2>
        {partners.length === 0 ? (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px',
            padding: '32px', textAlign: 'center', color: PALE,
          }}>
            Партнёров ещё нет. Добавь первого!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {partners.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/partners/${p.id}`)}
                style={{
                  background:   CARD,
                  border:       `1px solid ${BORDER}`,
                  borderRadius: '14px',
                  padding:      '14px',
                  cursor:       'pointer',
                  opacity:      p.is_active ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f1f1' }}>
                      {p.display_name}
                    </div>
                    <div style={{ fontSize: '12px', color: PALE }}>@{p.username}</div>
                    {!p.is_active && (
                      <span style={{
                        fontSize: '10px', color: '#ef4444',
                        background: '#ef444422', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block',
                      }}>Неактивен</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: PALE }}>Лидов: {p.stats?.total_leads || 0}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
                      {fmt(p.stats?.earned || 0)}
                    </div>
                    {(p.stats?.owed || 0) > 0 && (
                      <div style={{ fontSize: '12px', color: '#fbbf24' }}>
                        Долг: {fmt(p.stats.owed)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <AddPartnerModal
          onClose={() => setShowModal(false)}
          onAdded={load}
        />
      )}
    </div>
  )
}
