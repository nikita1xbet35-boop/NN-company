import { STATUS_COLORS } from '../lib/config'

export default function StatusBadge({ status, size = 'sm' }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS['В работе']
  const pad = size === 'lg' ? '6px 14px' : '3px 10px'
  const fs  = size === 'lg' ? '13px' : '11px'

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '5px',
      padding:       pad,
      borderRadius:  '20px',
      background:    colors.bg,
      color:         colors.text,
      fontSize:      fs,
      fontWeight:    600,
      whiteSpace:    'nowrap',
    }}>
      <span style={{
        width:        '6px',
        height:       '6px',
        borderRadius: '50%',
        background:   colors.dot,
        flexShrink:   0,
      }} />
      {status}
    </span>
  )
}
