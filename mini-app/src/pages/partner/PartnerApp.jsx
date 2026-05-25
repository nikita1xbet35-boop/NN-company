import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import MyLeads from './MyLeads'
import AddPartnerLead from './AddPartnerLead'
import Balance from './Balance'
import PartnerOffers from './PartnerOffers'

// ─── Partner context ──────────────────────────────────────────────────────────
export const PartnerCtx = createContext(null)
export function usePartner() { return useContext(PartnerCtx) }

const ACCENT = '#10b981'
const BG     = '#080b12'

// ─── Nav tabs ─────────────────────────────────────────────────────────────────
const TABS = [
  { path: '/partner',         icon: '📋', label: 'Лиды'       },
  { path: '/partner/add',     icon: '➕', label: 'Добавить'   },
  { path: '/partner/balance', icon: '💰', label: 'Баланс'     },
  { path: '/partner/offers',  icon: '💎', label: 'Офферы'     },
]

function PartnerBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav style={{
      position:      'fixed',
      bottom:        0,
      left:          0,
      right:         0,
      height:        '64px',
      background:    '#0d1117',
      borderTop:     '1px solid #1f2937',
      display:       'flex',
      zIndex:        100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const active = location.pathname === tab.path ||
          (tab.path !== '/partner' && location.pathname.startsWith(tab.path))
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '2px',
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              color:          active ? ACCENT : '#6b7280',
              transition:     'color 0.2s',
              position:       'relative',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: active ? 700 : 400 }}>
              {tab.label}
            </span>
            {active && (
              <span style={{
                position:     'absolute',
                bottom:       0,
                width:        '32px',
                height:       '2px',
                background:   ACCENT,
                borderRadius: '2px 2px 0 0',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ─── No access screen ────────────────────────────────────────────────────────
function NoAccess() {
  return (
    <div style={{
      minHeight:      '100vh',
      background:     BG,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '32px',
      textAlign:      'center',
      color:          '#f9fafb',
    }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px' }}>
        Нет доступа
      </h2>
      <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: 1.5 }}>
        Эта страница только для партнёров NN Company.<br />
        Если ты партнёр — открой бота и нажми кнопку кабинета.
      </p>
    </div>
  )
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function Loading() {
  return (
    <div style={{
      minHeight:      '100vh',
      background:     BG,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤝</div>
        <div>Загружаем кабинет...</div>
      </div>
    </div>
  )
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function PartnerApp() {
  const [partner, setPartner]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [denied,  setDenied]    = useState(false)

  useEffect(() => {
    async function auth() {
      try {
        const tg       = window.Telegram?.WebApp
        const initData = tg?.initData || ''

        const r = await fetch('/api/partner-auth', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData },
          body:    JSON.stringify({}),
        })

        if (!r.ok) { setDenied(true); return }
        const data = await r.json()
        setPartner(data.partner)
      } catch {
        setDenied(true)
      } finally {
        setLoading(false)
      }
    }
    auth()
  }, [])

  if (loading) return <Loading />
  if (denied || !partner) return <NoAccess />

  return (
    <PartnerCtx.Provider value={partner}>
      <div style={{ minHeight: '100vh', background: BG, color: '#f9fafb' }}>
        <Routes>
          <Route path="/"        element={<MyLeads />} />
          <Route path="/add"     element={<AddPartnerLead />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/offers"  element={<PartnerOffers />} />
          <Route path="*"        element={<Navigate to="/partner" replace />} />
        </Routes>
        <PartnerBottomNav />
      </div>
    </PartnerCtx.Provider>
  )
}
