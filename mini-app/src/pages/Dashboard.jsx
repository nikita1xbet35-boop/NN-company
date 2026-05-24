import { useState, useEffect, useCallback } from 'react'
import { getDashboardStats } from '../lib/supabase'
import { fmtMoney, STATUSES, STATUS_COLORS, OFFERS, getMonthRange } from '../lib/config'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns'
import { ru } from 'date-fns/locale'

const PERIODS = [
  { key: 'day',    label: 'День'   },
  { key: 'week',   label: 'Неделя' },
  { key: 'month',  label: 'Месяц'  },
  { key: 'year',   label: 'Год'    },
  { key: 'custom', label: 'Период' },
]

function getPeriodRange(period, customFrom, customTo) {
  const now = new Date()
  switch (period) {
    case 'day':   return { start: startOfDay(now), end: endOfDay(now) }
    case 'week':  return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'month': return getMonthRange()
    case 'year':  return { start: startOfYear(now), end: endOfYear(now) }
    case 'custom':
      return {
        start: customFrom ? startOfDay(new Date(customFrom)) : getMonthRange().start,
        end:   customTo   ? endOfDay(new Date(customTo))     : getMonthRange().end,
      }
    default: return getMonthRange()
  }
}

export default function Dashboard() {
  const [period, setPeriod]     = useState('month')
  const [customFrom, setFrom]   = useState('')
  const [customTo, setTo]       = useState('')
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getPeriodRange(period, customFrom, customTo)
      const rows = await getDashboardStats(start.toISOString(), end.toISOString())
      setData(rows || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [period, customFrom, customTo])

  useEffect(() => { load() }, [load])

  // Compute stats
  const totalRevenue = data.reduce((s, r) => s + Number(r.revenue || 0), 0)
  const totalPayout  = data.reduce((s, r) => s + Number(r.payout  || 0), 0)
  const netProfit    = totalRevenue - totalPayout

  // By offer
  const byOffer = {}
  data.forEach(r => {
    if (!byOffer[r.offer]) byOffer[r.offer] = { revenue: 0, count: 0 }
    byOffer[r.offer].revenue += Number(r.revenue || 0)
    byOffer[r.offer].count   += 1
  })

  // By status
  const byStatus = {}
  STATUSES.forEach(s => { byStatus[s] = 0 })
  data.forEach(r => { if (byStatus[r.status] !== undefined) byStatus[r.status]++ })

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      {/* Header */}
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f1f1', marginBottom: '20px' }}>
        Дашборд
      </h1>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding:      '7px 14px',
              borderRadius: '20px',
              border:       'none',
              background:   period === p.key ? '#6366f1' : '#1a1a24',
              color:        period === p.key ? '#fff'    : '#9ca3af',
              fontSize:     '13px',
              fontWeight:   600,
              cursor:       'pointer',
              whiteSpace:   'nowrap',
              transition:   'all 0.2s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input
            type="date"
            value={customFrom}
            onChange={e => setFrom(e.target.value)}
            style={dateInputStyle}
          />
          <input
            type="date"
            value={customTo}
            onChange={e => setTo(e.target.value)}
            style={dateInputStyle}
          />
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Main stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <StatCard label="Общий доход" value={fmtMoney(totalRevenue)} color="#10b981" icon="💰" />
            <StatCard label="Выплаты"     value={fmtMoney(totalPayout)}  color="#f59e0b" icon="💸" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <StatCard label="Чистая прибыль" value={fmtMoney(netProfit)} color={netProfit >= 0 ? '#6366f1' : '#ef4444'} icon="📈" wide />
          </div>

          {/* Leads count */}
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Лидов: {data.length}
          </div>

          {/* By status */}
          <SectionTitle>По статусам</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {STATUSES.map(s => {
              const count  = byStatus[s] || 0
              const colors = STATUS_COLORS[s]
              if (count === 0) return null
              return (
                <div key={s} style={{
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'space-between',
                  background:   '#1a1a24',
                  borderRadius: '12px',
                  padding:      '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.dot }} />
                    <span style={{ fontSize: '14px', color: '#e5e7eb' }}>{s}</span>
                  </div>
                  <span style={{
                    background:   colors.bg,
                    color:        colors.text,
                    padding:      '3px 10px',
                    borderRadius: '12px',
                    fontSize:     '13px',
                    fontWeight:   700,
                  }}>{count}</span>
                </div>
              )
            })}
          </div>

          {/* By offer */}
          <SectionTitle>По офферам</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(byOffer)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([offer, stat]) => (
                <div key={offer} style={{
                  background:   '#1a1a24',
                  borderRadius: '12px',
                  padding:      '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#e5e7eb', flex: 1, marginRight: '8px' }}>{offer}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                      {fmtMoney(stat.revenue)}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    {stat.count} лид{stat.count !== 1 ? 'ов' : ''}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon, wide }) {
  return (
    <div style={{
      background:   '#1a1a24',
      borderRadius: '16px',
      padding:      '16px',
      border:       '1px solid #252535',
    }}>
      <div style={{ fontSize: '20px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: wide ? '22px' : '18px', fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
      {children}
    </div>
  )
}

const dateInputStyle = {
  flex: 1, padding: '10px', borderRadius: '10px',
  background: '#1a1a24', border: '1px solid #252535',
  color: '#f1f1f1', fontSize: '14px',
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
      <div style={{
        width: '32px', height: '32px',
        border: '3px solid #252535',
        borderTop: '3px solid #6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}
