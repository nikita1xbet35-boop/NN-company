import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position:   'fixed',
        inset:      0,
        background: 'rgba(0,0,0,0.7)',
        display:    'flex',
        alignItems: 'flex-end',
        zIndex:     200,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:        '100%',
          background:   '#1a1a24',
          borderRadius: '20px 20px 0 0',
          padding:      '24px 20px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          maxHeight:    '80vh',
          overflowY:    'auto',
        }}
      >
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', background: '#2d2d3a', borderRadius: '2px', margin: '0 auto 20px' }} />

        {title && (
          <h3 style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: 700, color: '#f1f1f1' }}>
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  )
}
