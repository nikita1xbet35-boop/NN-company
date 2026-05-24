import { useState, useEffect, useCallback } from 'react'
import { getLeads } from '../lib/supabase'
import { OFFERS, STATUSES } from '../lib/config'
import LeadCard from '../components/LeadCard'
import Modal from '../components/Modal'

export default function Leads() {
  const [leads, setLeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterOffer, setOffer] = useState('')
  const [filterStatus, setStat] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getLeads({
        offer:  filterOffer  || undefined,
        status: filterStatus || undefined,
        search: search       || undefined,
      })
      setLeads(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, filterOffer, filterStatus])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const hasFilters = filterOffer || filterStatus
  const activeCount = [filterOffer, filterStatus].filter(Boolean).length

  function clearFilters() {
    setOffer('')
    setStat('')
    setShowFilter(false)
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f1f1', margin: 0 }}>
          Лиды
        </h1>
        <button
          onClick={() => setShowFilter(true)}
          style={{
            background:   hasFilters ? '#6366f1' : '#1a1a24',
            border:       'none',
            borderRadius: '12px',
            padding:      '8px 14px',
            color:        hasFilters ? '#fff' : '#9ca3af',
            fontSize:     '13px',
            fontWeight:   600,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          '6px',
          }}
        >
          🔧 Фильтр {activeCount > 0 && `(${activeCount})`}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>
          🔍
        </span>
        <input
          type="search"
          placeholder="Поиск по имени или телефону..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width:        '100%',
            padding:      '12px 12px 12px 40px',
            borderRadius: '12px',
            border:       '1px solid #252535',
            background:   '#1a1a24',
            color:        '#f1f1f1',
            fontSize:     '14px',
            boxSizing:    'border-box',
          }}
        />
      </div>

      {/* Active filters */}
      {hasFilters && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {filterOffer && (
            <Chip label={filterOffer} onRemove={() => setOffer('')} />
          )}
          {filterStatus && (
            <Chip label={filterStatus} onRemove={() => setStat('')} />
          )}
        </div>
      )}

      {/* Leads */}
      {loading ? (
        <LoadingSpinner />
      ) : leads.length === 0 ? (
        <EmptyState search={search} hasFilters={hasFilters} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            {leads.length} лид{leads.length !== 1 ? 'ов' : ''}
          </div>
          {leads.map(l => <LeadCard key={l.id} lead={l} />)}
        </div>
      )}

      {/* Filter Modal */}
      <Modal open={showFilter} onClose={() => setShowFilter(false)} title="Фильтры">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Offer */}
          <div>
            <label style={labelStyle}>Оффер</label>
            <select
              value={filterOffer}
              onChange={e => setOffer(e.target.value)}
              style={selectStyle}
            >
              <option value="">Все офферы</option>
              {OFFERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Статус</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['', ...STATUSES].map(s => (
                <button
                  key={s}
                  onClick={() => setStat(s)}
                  style={{
                    padding:      '7px 14px',
                    borderRadius: '20px',
                    border:       'none',
                    background:   filterStatus === s ? '#6366f1' : '#252535',
                    color:        filterStatus === s ? '#fff' : '#9ca3af',
                    fontSize:     '13px',
                    cursor:       'pointer',
                  }}
                >
                  {s || 'Все'}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={clearFilters} style={{ ...btnStyle, background: '#252535', color: '#9ca3af', flex: 1 }}>
              Сбросить
            </button>
            <button onClick={() => setShowFilter(false)} style={{ ...btnStyle, flex: 2 }}>
              Применить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Chip({ label, onRemove }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '6px',
      background:   '#1e1e3a',
      borderRadius: '20px',
      padding:      '4px 10px 4px 12px',
      fontSize:     '12px',
      color:        '#a5b4fc',
    }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
    </div>
  )
}

function EmptyState({ search, hasFilters }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>
        {search || hasFilters ? '🔍' : '📋'}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#6b7280' }}>
        {search || hasFilters ? 'Ничего не найдено' : 'Лидов пока нет'}
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }
const selectStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #252535', background: '#252535', color: '#f1f1f1', fontSize: '14px' }
const btnStyle = { padding: '14px', borderRadius: '12px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #252535', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
