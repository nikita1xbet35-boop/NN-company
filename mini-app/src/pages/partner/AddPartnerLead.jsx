import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartner } from './PartnerApp'

const ACCENT    = '#10b981'
const CARD_BG   = '#111827'
const BORDER    = '#1f2937'
const PALE      = '#6b7280'
const INPUT_BG  = '#0d1117'

function fmt(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`
}

function inputStyle(error) {
  return {
    width:        '100%',
    padding:      '13px',
    borderRadius: '12px',
    border:       `1px solid ${error ? '#ef4444' : BORDER}`,
    background:   INPUT_BG,
    color:        '#f9fafb',
    fontSize:     '15px',
    boxSizing:    'border-box',
    outline:      'none',
    fontFamily:   'inherit',
  }
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{
        fontSize:      '11px',
        fontWeight:    600,
        color:         PALE,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </label>
      {children}
      {error && <span style={{ fontSize: '12px', color: '#ef4444' }}>{error}</span>}
    </div>
  )
}

export default function AddPartnerLead() {
  const partner  = usePartner()
  const navigate = useNavigate()

  const [offers, setOffers]   = useState([])
  const [form, setForm]       = useState({ full_name: '', contact: '', offer: '' })
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState(null)

  useEffect(() => {
    async function loadOffers() {
      try {
        const tg       = window.Telegram?.WebApp
        const initData = tg?.initData || ''
        const r = await fetch('/api/partner-offers', {
          headers: { 'X-Init-Data': initData },
        })
        if (!r.ok) return
        const data = await r.json()
        setOffers(Array.isArray(data) ? data.filter(o => o.is_active) : [])
      } catch {}
    }
    loadOffers()
  }, [])

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))

    if (key === 'offer') {
      const found = offers.find(o => o.name === val)
      setSelectedOffer(found || null)
    }
  }

  function validate() {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Обязательное поле'
    if (!form.contact.trim())   e.contact   = 'Обязательное поле'
    if (!form.offer)            e.offer     = 'Выберите оффер'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    try {
      const tg       = window.Telegram?.WebApp
      const initData = tg?.initData || ''

      const r = await fetch('/api/partner-leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData },
        body:    JSON.stringify({
          full_name: form.full_name.trim(),
          contact:   form.contact.trim(),
          offer:     form.offer,
        }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Ошибка сервера')
      }
      setSuccess(true)
      setTimeout(() => navigate('/partner'), 2000)
    } catch (e) {
      alert('Ошибка: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight:      '100vh',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '32px',
        textAlign:      'center',
        color:          '#f9fafb',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
          Лид отправлен!
        </h2>
        <p style={{ color: PALE }}>
          Лид отправлен на проверку. Мы уведомим тебя о результате.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f9fafb', marginBottom: '6px' }}>
        Добавить лид
      </h1>
      <p style={{ color: PALE, fontSize: '13px', marginBottom: '24px' }}>
        Заполни данные — мы проверим и свяжемся с клиентом
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <Field label="Имя и Фамилия *" error={errors.full_name}>
          <input
            type="text"
            placeholder="Иванов Иван"
            value={form.full_name}
            onChange={e => setField('full_name', e.target.value)}
            style={inputStyle(errors.full_name)}
          />
        </Field>

        <Field label="Контакт *" error={errors.contact}>
          <input
            type="text"
            placeholder="@username или +7 999 123 45 67"
            value={form.contact}
            onChange={e => setField('contact', e.target.value)}
            style={inputStyle(errors.contact)}
          />
          <span style={{ fontSize: '11px', color: PALE }}>
            Ссылка на Telegram, номер телефона или @username
          </span>
        </Field>

        <Field label="Оффер *" error={errors.offer}>
          <select
            value={form.offer}
            onChange={e => setField('offer', e.target.value)}
            style={inputStyle(errors.offer)}
          >
            <option value="">Выберите оффер...</option>
            {offers.map(o => (
              <option key={o.id} value={o.name}>{o.name}</option>
            ))}
          </select>
        </Field>

        {selectedOffer && (
          <div style={{
            background:   ACCENT + '18',
            border:       `1px solid ${ACCENT}44`,
            borderRadius: '12px',
            padding:      '14px 16px',
            display:      'flex',
            alignItems:   'center',
            gap:          '10px',
          }}>
            <span style={{ fontSize: '20px' }}>💰</span>
            <div>
              <div style={{ fontSize: '12px', color: PALE }}>Ваша выплата за лид</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: ACCENT }}>
                {fmt(selectedOffer.effective_rate ?? selectedOffer.rate)}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width:        '100%',
            padding:      '16px',
            borderRadius: '12px',
            border:       'none',
            background:   loading ? '#065f46' : ACCENT,
            color:        '#fff',
            fontSize:     '16px',
            fontWeight:   700,
            cursor:       loading ? 'not-allowed' : 'pointer',
            marginTop:    '8px',
            transition:   'background 0.2s',
          }}
        >
          {loading ? 'Отправляем...' : '✅ Отправить лид'}
        </button>
      </form>
    </div>
  )
}
