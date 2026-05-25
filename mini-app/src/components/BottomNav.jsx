import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '../lib/telegram'

const TABS = [
  { path: '/',          icon: '📊', label: 'Дашборд'  },
  { path: '/leads',     icon: '📋', label: 'Лиды'     },
  { path: '/add',       icon: '➕', label: 'Добавить'  },
  { path: '/partners',  icon: '🤝', label: 'Партнёры' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide on partner routes
  if (location.pathname.startsWith('/partner')) return null

  function go(path) {
    haptic('light')
    navigate(path)
  }

  return (
    <nav style={{
      position:   'fixed',
      bottom:     0,
      left:       0,
      right:      0,
      height:     '64px',
      background: '#12121a',
      borderTop:  '1px solid #1e1e2e',
      display:    'flex',
      zIndex:     100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const active = tab.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => go(tab.path)}
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
              color:          active ? '#6366f1' : '#6b7280',
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
                background:   '#6366f1',
                borderRadius: '2px 2px 0 0',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
