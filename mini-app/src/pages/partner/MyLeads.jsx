import { useState, useEffect } from 'react'
import { usePartner } from './PartnerApp'

const CARD_BG  = '#111827'
const BORDER   = '#1f2937'
const ACCENT   = '#10b981'
const PALE     = '#6b7280'

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

function statusInfo(lead) {
  if (lead.approval_status === 'pending')  return { icon: '🟡', label: 'На проверке',  color: '#fbbf24' }
  if (lead.approval_status === 'rejected') return { icon: '❌', label: 'Отклонён',     color: '#ef4444' }
  // approved — show crm status
  if (lead.crm_status === 'Успешно')       return { icon: '🏆', label: 'Успешно',       color: ACCENT }
  if (lead.crm_status === 'Отказ')         return { icon: '❌', label: 'Отказ (CRM)',   color: '#ef4444' }
  if (lead.crm_status)                    return { icon: '✅', label: lead.crm_status, color: '#60a5fa' }
  return { icon: '✅', label: 'Одобрен', color: ACCENT }
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function MyLeads() {
  const partner = usePartner()
  const [leads, setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const tg       = window.Telegram?.WebApp
        const initData = tg?.initData || ''
        const r = await fetch('/api/partner-leads', {
          headers: { 'X-Init-Data': initData },
        })
        if (!r.ok) throw new Error('Ошибка загрузки')
        const data = await r.json()
        setLeads(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ color: PALE, textAlign: 'center' }}>
        <div style={{ fontSize: '32px' }}>📋</div>
        <div style={{ marginTop: '8px' }}>Загружаем лиды...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ padding: '24px', color: '#ef4444' }}>Ошибка: {error}</div>
  )

  return (
    <div style={{ padding: '16px', paddingBottom: '88px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f9fafb', marginBottom: '4px' }}>
          Мои лиды
        </h1>
        <p style={{ color: PALE, fontSize: '13px' }}>
          {partner.display_name} · всего {leads.length}
        </p>
      </div>

      {leads.length === 0 ? (
        <div style={{
          textAlign:  'center',
          padding:    '48px 24px',
          color:      PALE,
          background: CARD_BG,
          borderRadius: '16px',
          border:     `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤷</div>
          <div style={{ fontWeight: 700, color: '#f9fafb', marginBottom: '6px' }}>
            Пора добавить первого лида
          </div>
          <div style={{ fontSize: '13px' }}>
            Используй вкладку ➕, чтобы начать зарабатывать
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {leads.map(lead => {
            const s = statusInfo(lead)
            return (
              <div key={lead.id} style={{
                background:   CARD_BG,
                border:       `1px solid ${BORDER}`,
                borderRadius: '16px',
                padding:      '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#f9fafb' }}>
                      {lead.full_name}
                    </div>
                    <div style={{ fontSize: '12px', color: PALE, marginTop: '2px' }}>
                      {formatDate(lead.created_at)}
                    </div>
                  </div>
                  <span style={{
                    background:   s.color + '22',
                    color:        s.color,
                    borderRadius: '8px',
                    padding:      '4px 10px',
                    fontSize:     '12px',
                    fontWeight:   600,
                    whiteSpace:   'nowrap',
                  }}>
                    {s.icon} {s.label}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span style={{
                    background:   '#1f2937',
                    color:        '#9ca3af',
                    borderRadius: '8px',
                    padding:      '3px 10px',
                    fontSize:     '12px',
                  }}>
                    {lead.offer}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: PALE }}>
                    📞 {lead.contact}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: ACCENT }}>
                    {fmt(lead.payout_to_partner)}
                  </div>
                </div>

                {lead.approval_status === 'rejected' && lead.rejection_reason && (
                  <div style={{
                    marginTop:    '10px',
                    padding:      '8px 12px',
                    background:   '#ef444422',
                    borderRadius: '8px',
                    fontSize:     '12px',
                    color:        '#f87171',
                  }}>
                    📌 {lead.rejection_reason}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
