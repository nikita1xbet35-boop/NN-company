import { useNavigate } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import { fmtMoney } from '../lib/config'
import { haptic } from '../lib/telegram'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function LeadCard({ lead }) {
  const navigate = useNavigate()

  function open() {
    haptic('light')
    navigate(`/leads/${lead.id}`)
  }

  return (
    <div
      onClick={open}
      style={{
        background:   '#1a1a24',
        borderRadius: '16px',
        padding:      '16px',
        cursor:       'pointer',
        border:       '1px solid #252535',
        transition:   'background 0.15s',
      }}
      onTouchStart={e => e.currentTarget.style.background = '#222234'}
      onTouchEnd={e   => e.currentTarget.style.background = '#1a1a24'}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f1f1', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.full_name}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {lead.phone}
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      {/* Offer */}
      <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
        📋 {lead.offer}
      </div>

      {/* Money row */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1, background: '#0f0f18', borderRadius: '10px', padding: '8px 12px' }}>
          <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Доход</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{fmtMoney(lead.revenue)}</div>
        </div>
        <div style={{ flex: 1, background: '#0f0f18', borderRadius: '10px', padding: '8px 12px' }}>
          <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Выплата</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>{fmtMoney(lead.payout)}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: '#4b5563' }}>
        <span>👤 {lead.added_by}</span>
        <span>{format(new Date(lead.created_at), 'd MMM yyyy', { locale: ru })}</span>
      </div>
    </div>
  )
}
