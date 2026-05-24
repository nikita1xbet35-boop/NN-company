import { useState, useEffect, useCallback } from 'react'
import { getDashboardStats } from '../lib/supabase'
import { fmtMoney, STATUSES, STATUS_COLORS, OFFERS, getMonthRange } from '../lib/config'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns'
import { ru } from 'date-fns/locale'
import { haptic } from '../lib/telegram'

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

const currentMonth = format(new Date(), 'yyyy-MM')

export default function Dashboard() {
  const [period, setPeriod]   = useState('month')
  const [customFrom, setFrom] = useState('')
  const [customTo, setTo]     = useState('')
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  // Цели
  const [goal, setGoal]               = useState(0)
  const [goalLoading, setGoalLoading] = useState(true)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalInput, setGoalInput]     = useState('')
  const [goalSaving, setGoalSaving]   = useState(false)

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

  // Загружаем цель текущего месяца
  useEffect(() => {
    setGoalLoading(true)
    fetch(`/api/goals?month=${currentMonth}`)
      .then(r => r.json())
      .then(d => {
        setGoal(d.target_profit || 0)
        setGoalInput(d.target_profit ? String(d.target_profit) : '')
      })
      .catch(() => {})
      .finally(() => setGoalLoading(false))
  }, [])

  async function saveGoal() {
    setGoalSaving(true)
    try {
      const target = parseFloat(goalInput) || 0
      await fetch('/api/goals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ month: currentMonth, target_profit: target }),
      })
      setGoal(target)
      haptic('success')
      setShowGoalModal(false)
    } catch (e) {
      haptic('error')
    } finally {
      setGoalSaving(false)
    }
  }

  // Отказы не считаются в финансах
  const active = data.filter(r => r.status !== 'Отказ')

  const totalRevenue = active.reduce((s, r) => s + Number(r.revenue || 0), 0)
  const totalPayout  = active.reduce((s, r) => s + Number(r.payout  || 0), 0)
  const netProfit    = totalRevenue - totalPayout

  // По офферам — только активные
  const byOffer = {}
  active.forEach(r => {
    if (!byOffer[r.offer]) byOffer[r.offer] = { revenue: 0, count: 0 }
    byOffer[r.offer].revenue += Number(r.revenue || 0)
    byOffer[r.offer].count   += 1
  })

  // По статусам — все лиды включая Отказ
  const byStatus = {}
  STATUSES.forEach(s => { byStatus[s] = 0 })
  data.forEach(r => { if (byStatus[r.status] !== undefined) byStatus[r.status]++ })

  // Прогресс цели (только для периода "месяц")
  const goalProgress = goal > 0 ? Math.min(100, Math.round((netProfit / goal) * 100)) : 0

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>

      {/* Заголовок */}
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f1f1', marginBottom: '20px' }}>
        Дашборд
      </h1>

      {/* Выбор периода */}
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

      {/* Кастомный диапазон */}
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input type="date" value={customFrom} onChange={e => setFrom(e.target.value)} style={dateInputStyle} />
          <input type="date" value={customTo}   onChange={e => setTo(e.target.value)}   style={dateInputStyle} />
        </div>
      )}

      {/* Цель месяца — всегда видна */}
      {!goalLoading && period === 'month' && (
        <GoalCard
          goal={goal}
          profit={netProfit}
          progress={goalProgress}
          onEdit={() => { setGoalInput(goal ? String(goal) : ''); setShowGoalModal(true) }}
        />
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Основная статистика */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <StatCard label="Общий доход" value={fmtMoney(totalRevenue)} color="#10b981" icon="💰" />
            <StatCard label="Выплаты"     value={fmtMoney(totalPayout)}  color="#f59e0b" icon="💸" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <StatCard label="Чистая прибыль" value={fmtMoney(netProfit)} color={netProfit >= 0 ? '#6366f1' : '#ef4444'} icon="📈" wide />
          </div>

          {/* Количество лидов */}
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Лидов: {data.length}{data.length !== active.length && ` (${data.length - active.length} отказ${data.length - active.length > 1 ? 'ов' : ''})`}
          </div>

          {/* По статусам */}
          <SectionTitle>По статусам</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {STATUSES.map(s => {
              const count  = byStatus[s] || 0
              const colors = STATUS_COLORS[s]
              if (count === 0) return null
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a24', borderRadius: '12px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.dot }} />
                    <span style={{ fontSize: '14px', color: '#e5e7eb' }}>{s}</span>
                  </div>
                  <span style={{ background: colors.bg, color: colors.text, padding: '3px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>

          {/* По офферам */}
          <SectionTitle>По офферам</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(byOffer)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([offer, stat]) => (
                <div key={offer} style={{ background: '#1a1a24', borderRadius: '12px', padding: '12px 14px' }}>
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

      {/* Модалка — установка цели */}
      {showGoalModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowGoalModal(false) }}
        >
          <div style={{ background: '#16161f', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700, color: '#f1f1f1' }}>
              🎯 Цель на {format(new Date(), 'LLLL', { locale: ru })}
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                Целевая прибыль (₽)
              </label>
              <input
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="например 300000"
                autoFocus
                min="0"
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  border: '1px solid #252535', background: '#1a1a24',
                  color: '#f1f1f1', fontSize: '18px', fontWeight: 700,
                  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
            {/* Быстрые кнопки */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[100000, 200000, 300000, 500000].map(v => (
                <button
                  key={v}
                  onClick={() => setGoalInput(String(v))}
                  style={{
                    padding: '7px 14px', borderRadius: '20px', border: 'none',
                    background: goalInput === String(v) ? '#6366f1' : '#252535',
                    color: goalInput === String(v) ? '#fff' : '#9ca3af',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {fmtMoney(v)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowGoalModal(false)}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#252535', color: '#9ca3af', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
              >
                Отмена
              </button>
              <button
                onClick={saveGoal}
                disabled={goalSaving}
                style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: goalSaving ? '#3d3d6b' : '#6366f1', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: goalSaving ? 'not-allowed' : 'pointer' }}
              >
                {goalSaving ? 'Сохраняем...' : '✅ Установить цель'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Блок цели с прогресс-баром ────────────────────────────────────────────────

function GoalCard({ goal, profit, progress, onEdit }) {
  const remaining = goal - profit
  const isAchieved = profit >= goal

  const barColor = isAchieved
    ? '#10b981'
    : progress > 70 ? '#f59e0b' : '#6366f1'

  return (
    <div style={{
      background: '#1a1a24', borderRadius: '16px', padding: '16px',
      marginBottom: '16px', border: `1px solid ${isAchieved ? '#10b981' : '#252535'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{isAchieved ? '🏆' : '🎯'}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Цель месяца
          </span>
        </div>
        <button
          onClick={onEdit}
          style={{ background: 'none', border: '1px solid #374151', borderRadius: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: 600, padding: '5px 10px', cursor: 'pointer' }}
        >
          ✏️ {goal > 0 ? 'Изменить' : 'Установить'}
        </button>
      </div>

      {goal > 0 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: isAchieved ? '#10b981' : '#f1f1f1' }}>
              {fmtMoney(profit)}
            </span>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              из {fmtMoney(goal)}
            </span>
          </div>

          {/* Прогресс-бар */}
          <div style={{ height: '8px', borderRadius: '4px', background: '#252535', marginBottom: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '4px', background: barColor,
              width: `${progress}%`, transition: 'width 0.5s ease',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: barColor, fontWeight: 700 }}>
              {progress}%
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              {isAchieved
                ? `🔥 Цель выполнена! +${fmtMoney(profit - goal)}`
                : `Осталось: ${fmtMoney(remaining)}`}
            </span>
          </div>
        </>
      ) : (
        <p style={{ color: '#4b5563', fontSize: '14px', margin: 0 }}>
          Нажми «Установить» чтобы задать цель на месяц
        </p>
      )}
    </div>
  )
}

// ── Вспомогательные компоненты ────────────────────────────────────────────────

function StatCard({ label, value, color, icon, wide }) {
  return (
    <div style={{ background: '#1a1a24', borderRadius: '16px', padding: '16px', border: '1px solid #252535' }}>
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
      <div style={{ width: '32px', height: '32px', border: '3px solid #252535', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
