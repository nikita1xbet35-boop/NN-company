import { useState, useEffect } from 'react'
import { usePartner } from './PartnerApp'

const ACCENT = '#10b981'
const PALE   = '#6b7280'
const CARD   = '#111827'
const BORDER = '#1f2937'

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Balance() {
  const partner = usePartner()
  const [leads,   setLeads]   = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const tg       = window.Telegram?.WebApp
        const initData = tg?.initData || ''
        const [leadsR, payoutsR] = await Promise.all([
          fetch('/api/partner-leads', { headers: { 'X-Init-Data': initData } }),
          fetch(`/api/partner-payouts`, { headers: { 'X-Init-Data': initData } }),
        ])
        const leadsData   = leadsR.ok   ? await leadsR.json()   : []
        const payoutsData = payoutsR.ok ? await payoutsR.json() : []
        setLeads(Array.isArray(leadsData)   ? leadsData   : [])
        setPayouts(Array.isArray(payoutsData) ? payoutsData : [])
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  const approved  = leads.filter(l => l.approval_status === 'approved')
  const earned    = approved.reduce((s, l) => s + Number(l.payout_to_partner || 0), 0)
  const paid      = payouts.reduce((s, p) => s + Number(p.amount || 0), 0)
  const owed      = Math.max(0, earned - paid)
  const pending   = leads
    .filter(l => l.approval_status === 'pending')
    .reduce((s, l) => s + Number(l.payout_to_partner || 0), 0)

  // Successful leads (approved and crm_status == 'Успешно')
  const successLeads = approved.filter(l => l.crm_status === 'Успешно')

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', color: PALE }}>
        <div style={{ fontSize: '32px' }}>💰</div>
        <div>Загружаем баланс...</div>
      </div>
    </div>
  )

  return (
    <div style={{ paddingBottom: '88px' }}>
      {/* Gradient header */}
      <div style={{
        background:  'linear-gradient(135deg, #065f46, #10b981)',
        padding:     '32px 20px 28px',
        textAlign:   'center',
      }}>
        <div style={{ fontSize: '12px', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
          К выплате
        </div>
        <div style={{ fontSize: '40px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>
          {fmt(owed)}
        </div>
        <div style={{ fontSize: '13px', color: '#a7f3d0' }}>
          {partner.display_name}
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          <StatCard icon="💰" label="Заработано" value={fmt(earned)} color={ACCENT} />
          <StatCard icon="✅" label="Выплачено"  value={fmt(paid)}   color="#60a5fa" />
          <StatCard icon="⏳" label="На проверке" value={fmt(pending)} color="#fbbf24" />
        </div>

        {/* Successful leads */}
        {successLeads.length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f9fafb', marginBottom: '12px' }}>
              🏆 Успешные лиды
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {successLeads.map(l => (
                <div key={l.id} style={{
                  background:   CARD,
                  border:       `1px solid ${BORDER}`,
                  borderRadius: '12px',
                  padding:      '12px 14px',
                  display:      'flex',
                  justifyContent: 'space-between',
                  alignItems:   'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#f9fafb' }}>{l.full_name}</div>
                    <div style={{ fontSize: '12px', color: PALE }}>{l.offer}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: ACCENT }}>{fmt(l.payout_to_partner)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Payout history */}
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f9fafb', marginBottom: '12px' }}>
            💸 История выплат
          </h2>
          {payouts.length === 0 ? (
            <div style={{
              background:   CARD,
              border:       `1px solid ${BORDER}`,
              borderRadius: '12px',
              padding:      '24px',
              textAlign:    'center',
              color:        PALE,
            }}>
              Выплат пока не было
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payouts.map(p => (
                <div key={p.id} style={{
                  background:   CARD,
                  border:       `1px solid ${BORDER}`,
                  borderRadius: '12px',
                  padding:      '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#60a5fa' }}>
                      {fmt(p.amount)}
                    </div>
                    <div style={{ fontSize: '12px', color: PALE }}>
                      {formatDate(p.paid_at)}
                    </div>
                  </div>
                  {p.notes && (
                    <div style={{ fontSize: '12px', color: PALE }}>{p.notes}</div>
                  )}
                  <div style={{ fontSize: '11px', color: PALE, marginTop: '2px' }}>
                    Выплатил: {p.paid_by}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background:   '#111827',
      border:       '1px solid #1f2937',
      borderRadius: '12px',
      padding:      '12px 10px',
      textAlign:    'center',
    }}>
      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}
