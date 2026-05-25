import { useState, useEffect } from 'react'

const ACCENT = '#10b981'
const PALE   = '#6b7280'
const CARD   = '#111827'
const BORDER = '#1f2937'

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

export default function PartnerOffers() {
  const [offers,  setOffers]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const tg       = window.Telegram?.WebApp
        const initData = tg?.initData || ''
        const r = await fetch('/api/partner-offers', {
          headers: { 'X-Init-Data': initData },
        })
        if (!r.ok) throw new Error('Ошибка загрузки')
        const data = await r.json()
        setOffers(Array.isArray(data) ? data.filter(o => o.is_active) : [])
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
      <div style={{ textAlign: 'center', color: PALE }}>
        <div style={{ fontSize: '32px' }}>💎</div>
        <div>Загружаем офферы...</div>
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
          Офферы
        </h1>
        <p style={{ color: PALE, fontSize: '13px' }}>
          Ставки за каждый успешно приведённый лид
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {offers.map(offer => {
          const rate = offer.effective_rate ?? Number(offer.rate)
          const isIndividual = offer.has_individual_rate
          return (
            <div key={offer.id} style={{
              background:   CARD,
              border:       `1px solid ${isIndividual ? ACCENT + '44' : BORDER}`,
              borderRadius: '16px',
              padding:      '16px',
              display:      'flex',
              justifyContent: 'space-between',
              alignItems:   'center',
            }}>
              <div style={{ flex: 1, marginRight: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#f9fafb', marginBottom: '4px' }}>
                  {offer.name}
                </div>
                {isIndividual && (
                  <span style={{
                    fontSize:   '11px',
                    color:      ACCENT,
                    background: ACCENT + '18',
                    padding:    '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 600,
                  }}>
                    Индивидуальная ставка
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', color: PALE, marginBottom: '2px' }}>
                  Ваша выплата
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: ACCENT }}>
                  {fmt(rate)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {offers.length === 0 && (
        <div style={{
          textAlign:    'center',
          padding:      '48px 24px',
          color:        PALE,
          background:   CARD,
          borderRadius: '16px',
          border:       `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤔</div>
          <div>Офферов пока нет</div>
        </div>
      )}
    </div>
  )
}
