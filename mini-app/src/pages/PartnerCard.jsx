import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTelegramUser, haptic } from '../lib/telegram'

const ACCENT = '#6366f1'
const GREEN  = '#10b981'
const CARD   = '#1a1a24'
const BORDER = '#252535'
const PALE   = '#9ca3af'
const SB_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYwNjE0NSwiZXhwIjoyMDk1MTgyMTQ1fQ.Z5c2SxOsJz16KW84M8bExALVXJz3tKhkj-nYH6gg_4E'
const SB_H   = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function getInitData() {
  return window.Telegram?.WebApp?.initData || ''
}

function getReviewerName() {
  const tgUser = getTelegramUser()
  if (!tgUser) return 'Админ'
  if (tgUser.username === 'tsvetkovnv') return 'Никитос'
  if (tgUser.username === 'haaaaaaav')  return 'Хасл'
  return tgUser.username || 'Админ'
}

function statusColor(s) {
  if (s === 'approved') return '#10b981'
  if (s === 'rejected') return '#ef4444'
  return '#fbbf24'
}
function statusLabel(s) {
  if (s === 'approved') return '✅ Одобрен'
  if (s === 'rejected') return '❌ Отклонён'
  return '🟡 На проверке'
}

// ─── Payout modal ─────────────────────────────────────────────────────────────
function PayoutModal({ partner, onClose, onPaid }) {
  const [amount,  setAmount]  = useState('')
  const [notes,   setNotes]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!amount || isNaN(parseFloat(amount))) { alert('Введи сумму'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/partner-payouts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Init-Data': getInitData() },
        body:    JSON.stringify({
          partner_id: partner.id,
          amount:     parseFloat(amount),
          paid_by:    getReviewerName(),
          notes:      notes.trim() || null,
        }),
      })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error) }
      haptic('success')
      onPaid()
      onClose()
    } catch (e) {
      alert('Ошибка: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputSt = {
    width: '100%', padding: '12px', borderRadius: '10px',
    border: `1px solid ${BORDER}`, background: '#12121a',
    color: '#f1f1f1', fontSize: '14px', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: CARD, borderRadius: '20px 20px 0 0',
        padding: '24px', width: '100%', maxWidth: '480px',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f1f1', marginBottom: '16px' }}>
          Записать выплату
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '4px' }}>СУММА ₽ *</label>
            <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} min="0" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: PALE, display: 'block', marginBottom: '4px' }}>ЗАМЕТКА</label>
            <input type="text" placeholder="Необязательно" value={notes} onChange={e => setNotes(e.target.value)} style={inputSt} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={{
              padding: '12px', borderRadius: '10px', border: `1px solid ${BORDER}`,
              background: 'transparent', color: PALE, cursor: 'pointer',
            }}>Отмена</button>
            <button type="submit" disabled={loading} style={{
              padding: '12px', borderRadius: '10px', border: 'none',
              background: GREEN, color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '...' : '💸 Записать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Rate modal ───────────────────────────────────────────────────────────────
function RateModal({ partner, offers, rates, onClose, onSaved }) {
  const [editing, setEditing] = useState({}) // offerId → rate string

  useEffect(() => {
    const map = {}
    rates.forEach(r => { map[r.offer_id] = String(r.rate) })
    setEditing(map)
  }, [rates])

  async function handleSave() {
    try {
      for (const offer of offers) {
        const val = editing[offer.id]
        if (val === undefined || val === '') {
          // Delete individual rate if exists
          if (rates.find(r => r.offer_id === offer.id)) {
            await fetch(`${SB_URL}/rest/v1/partner_rates?partner_id=eq.${partner.id}&offer_id=eq.${offer.id}`, {
              method: 'DELETE', headers: SB_H,
            })
          }
        } else {
          const numVal = parseFloat(val)
          if (isNaN(numVal)) continue
          // Upsert
          await fetch(`${SB_URL}/rest/v1/partner_rates`, {
            method: 'POST',
            headers: { ...SB_H, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ partner_id: partner.id, offer_id: offer.id, rate: numVal }),
          })
        }
      }
      haptic('success')
      onSaved()
      onClose()
    } catch (e) { alert('Ошибка: ' + e.message) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: CARD, borderRadius: '20px 20px 0 0',
        padding: '24px', width: '100%', maxWidth: '480px',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f1f1', marginBottom: '4px' }}>
          Индивидуальные ставки
        </h3>
        <p style={{ fontSize: '12px', color: PALE, marginBottom: '16px' }}>
          Оставь пустым — будет использована стандартная ставка
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {offers.map(offer => (
            <div key={offer.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: '13px', color: '#f1f1f1' }}>{offer.name}</div>
              <input
                type="number"
                placeholder={String(offer.rate)}
                value={editing[offer.id] ?? ''}
                onChange={e => setEditing(prev => ({ ...prev, [offer.id]: e.target.value }))}
                style={{
                  width: '90px', padding: '8px', borderRadius: '8px',
                  border: `1px solid ${BORDER}`, background: '#12121a',
                  color: '#f1f1f1', fontSize: '13px', outline: 'none',
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={onClose} style={{
            padding: '12px', borderRadius: '10px', border: `1px solid ${BORDER}`,
            background: 'transparent', color: PALE, cursor: 'pointer',
          }}>Отмена</button>
          <button onClick={handleSave} style={{
            padding: '12px', borderRadius: '10px', border: 'none',
            background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PartnerCard() {
  const { id }    = useParams()
  const navigate  = useNavigate()

  const [partner,  setPartner]  = useState(null)
  const [leads,    setLeads]    = useState([])
  const [payouts,  setPayouts]  = useState([])
  const [offers,   setOffers]   = useState([])
  const [rates,    setRates]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all')
  const [showPayout, setShowPayout] = useState(false)
  const [showRates,  setShowRates]  = useState(false)

  async function load() {
    try {
      const [partnerR, leadsR, payoutsR, offersR, ratesR] = await Promise.all([
        fetch(`${SB_URL}/rest/v1/partners?id=eq.${id}&select=*&limit=1`, { headers: SB_H }),
        fetch(`${SB_URL}/rest/v1/partner_leads?partner_id=eq.${id}&order=created_at.desc&select=*`, { headers: SB_H }),
        fetch(`${SB_URL}/rest/v1/partner_payouts?partner_id=eq.${id}&order=paid_at.desc&select=*`, { headers: SB_H }),
        fetch(`${SB_URL}/rest/v1/partner_offers?order=sort_order.asc&select=*`, { headers: SB_H }),
        fetch(`${SB_URL}/rest/v1/partner_rates?partner_id=eq.${id}&select=*`, { headers: SB_H }),
      ])
      const partnerData = await partnerR.json()
      const leadsData   = await leadsR.json()
      const payoutsData = await payoutsR.json()
      const offersData  = await offersR.json()
      const ratesData   = await ratesR.json()

      setPartner(Array.isArray(partnerData) ? partnerData[0] : null)
      setLeads(Array.isArray(leadsData) ? leadsData : [])
      setPayouts(Array.isArray(payoutsData) ? payoutsData : [])
      setOffers(Array.isArray(offersData) ? offersData : [])
      setRates(Array.isArray(ratesData) ? ratesData : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function toggleActive() {
    if (!partner) return
    haptic('light')
    await fetch('/api/partners', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Init-Data': getInitData() },
      body:    JSON.stringify({ is_active: !partner.is_active }),
    })
    load()
  }

  // Actually send PATCH with id query param
  async function toggleActiveFixed() {
    if (!partner) return
    haptic('light')
    await fetch(`/api/partners?id=${partner.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Init-Data': getInitData() },
      body:    JSON.stringify({ is_active: !partner.is_active }),
    })
    load()
  }

  if (loading || !partner) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f0f13' }}>
      <div style={{ textAlign: 'center', color: PALE }}>
        <div style={{ fontSize: '32px' }}>🤝</div>
        <div>{loading ? 'Загружаем...' : 'Партнёр не найден'}</div>
      </div>
    </div>
  )

  const approved = leads.filter(l => l.approval_status === 'approved')
  const earned   = approved.reduce((s, l) => s + Number(l.payout_to_partner || 0), 0)
  const paid     = payouts.reduce((s, p) => s + Number(p.amount || 0), 0)
  const owed     = Math.max(0, earned - paid)

  const displayedLeads = filter === 'all' ? leads : leads.filter(l => l.approval_status === filter)

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', color: '#f1f1f1', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ padding: '16px' }}>
        <button onClick={() => navigate('/partners')} style={{
          background: 'none', border: 'none', color: PALE, cursor: 'pointer', fontSize: '14px', padding: '0 0 12px 0',
        }}>
          ← Назад
        </button>

        <div style={{
          background:   CARD,
          border:       `1px solid ${BORDER}`,
          borderRadius: '16px',
          padding:      '18px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>{partner.display_name}</h1>
              <div style={{ fontSize: '13px', color: PALE }}>@{partner.username}</div>
              {partner.notes && <div style={{ fontSize: '12px', color: PALE, marginTop: '4px' }}>{partner.notes}</div>}
            </div>
            {!partner.is_active && (
              <span style={{ fontSize: '11px', color: '#ef4444', background: '#ef444422', padding: '3px 8px', borderRadius: '6px' }}>
                Неактивен
              </span>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            <StatBox label="Лидов" value={leads.length} color="#f1f1f1" />
            <StatBox label="Заработано" value={fmt(earned)} color={GREEN} />
            <StatBox label="Долг" value={fmt(owed)} color={owed > 0 ? '#fbbf24' : PALE} />
          </div>

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <ActionBtn icon="💸" label="Выплата" onClick={() => setShowPayout(true)} color={GREEN} />
            <ActionBtn icon="⚙️" label="Ставки" onClick={() => setShowRates(true)} color={ACCENT} />
            <ActionBtn
              icon={partner.is_active ? '🔴' : '🟢'}
              label={partner.is_active ? 'Деактивировать' : 'Активировать'}
              onClick={toggleActiveFixed}
              color="#6b7280"
            />
          </div>
        </div>

        {/* Leads filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto' }}>
          {[
            { key: 'all',      label: 'Все'       },
            { key: 'pending',  label: '🟡 На провер' },
            { key: 'approved', label: '✅ Одобрены'  },
            { key: 'rejected', label: '❌ Отклонены'  },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding:      '6px 14px',
                borderRadius: '8px',
                border:       'none',
                background:   filter === f.key ? ACCENT : '#1a1a24',
                color:        filter === f.key ? '#fff' : PALE,
                fontSize:     '12px',
                fontWeight:   filter === f.key ? 700 : 400,
                cursor:       'pointer',
                whiteSpace:   'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Leads list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayedLeads.length === 0 ? (
            <div style={{
              background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px',
              padding: '24px', textAlign: 'center', color: PALE,
            }}>
              Нет лидов
            </div>
          ) : (
            displayedLeads.map(lead => (
              <div key={lead.id} style={{
                background:   CARD,
                border:       `1px solid ${BORDER}`,
                borderRadius: '12px',
                padding:      '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{lead.full_name}</div>
                    <div style={{ fontSize: '11px', color: PALE }}>{lead.offer} · {formatDate(lead.created_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: GREEN }}>
                      {fmt(lead.payout_to_partner)}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: statusColor(lead.approval_status),
                    }}>
                      {statusLabel(lead.approval_status)}
                    </div>
                  </div>
                </div>
                {lead.rejection_reason && (
                  <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>
                    Причина: {lead.rejection_reason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Payouts history */}
        {payouts.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>💸 История выплат</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payouts.map(p => (
                <div key={p.id} style={{
                  background:   CARD,
                  border:       `1px solid ${BORDER}`,
                  borderRadius: '10px',
                  padding:      '10px 12px',
                  display:      'flex',
                  justifyContent: 'space-between',
                  alignItems:   'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#60a5fa' }}>{fmt(p.amount)}</div>
                    {p.notes && <div style={{ fontSize: '11px', color: PALE }}>{p.notes}</div>}
                    <div style={{ fontSize: '11px', color: PALE }}>{p.paid_by} · {formatDate(p.paid_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPayout && (
        <PayoutModal
          partner={partner}
          onClose={() => setShowPayout(false)}
          onPaid={load}
        />
      )}

      {showRates && (
        <RateModal
          partner={partner}
          offers={offers}
          rates={rates}
          onClose={() => setShowRates(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: '#12121a', border: `1px solid ${BORDER}`,
      borderRadius: '10px', padding: '10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '11px', color: PALE, marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      padding:      '8px 4px',
      borderRadius: '10px',
      border:       `1px solid ${BORDER}`,
      background:   '#12121a',
      color:        color || '#f1f1f1',
      fontSize:     '11px',
      cursor:       'pointer',
      display:      'flex',
      flexDirection: 'column',
      alignItems:   'center',
      gap:          '3px',
    }}>
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
