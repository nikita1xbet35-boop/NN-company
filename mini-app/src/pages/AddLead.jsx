import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createLead } from '../lib/supabase'
import { notifyNewLead } from '../lib/api'
import { OFFERS, getDisplayName } from '../lib/config'
import { getTelegramUser, haptic } from '../lib/telegram'

const INITIAL = {
  full_name:   '',
  phone:       '',
  contact:     '',
  offer:       '',
  payout:      '',
  revenue:     '',
  referred_by: '',
  comment:     '',
}

export default function AddLead() {
  const navigate  = useNavigate()
  const [form, setForm]     = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Обязательное поле'
    if (!form.phone.trim())     e.phone     = 'Обязательное поле'
    if (!form.contact.trim())   e.contact   = 'Обязательное поле'
    if (!form.offer)            e.offer     = 'Выберите оффер'
    if (form.payout  === '')    e.payout    = 'Введите сумму'
    if (form.revenue === '')    e.revenue   = 'Введите сумму'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      haptic('error')
      return
    }

    setLoading(true)
    try {
      const tgUser  = getTelegramUser()
      const addedBy = tgUser ? getDisplayName(tgUser.username) : 'Неизвестно'

      const lead = await createLead({
        full_name:   form.full_name.trim(),
        phone:       form.phone.trim(),
        contact:     form.contact.trim(),
        offer:       form.offer,
        payout:      parseFloat(form.payout)  || 0,
        revenue:     parseFloat(form.revenue) || 0,
        referred_by: form.referred_by.trim() || null,
        comment:     form.comment.trim()     || null,
        status:      'В работе',
        added_by:    addedBy,
      })

      // Non-blocking notification
      notifyNewLead({
        full_name: lead.full_name,
        offer:     lead.offer,
        revenue:   lead.revenue,
        payout:    lead.payout,
        added_by:  addedBy,
      })

      haptic('success')
      navigate('/leads')
    } catch (err) {
      console.error(err)
      haptic('error')
      alert('Ошибка при сохранении. Попробуй ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f1f1', marginBottom: '24px' }}>
        Новый лид
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <Field label="ФИО *" error={errors.full_name}>
          <input
            type="text"
            placeholder="Иванов Иван Иванович"
            value={form.full_name}
            onChange={e => setField('full_name', e.target.value)}
            style={inputStyle(errors.full_name)}
          />
        </Field>

        <Field label="Телефон *" error={errors.phone}>
          <input
            type="tel"
            placeholder="+7 999 123 45 67"
            value={form.phone}
            onChange={e => setField('phone', e.target.value)}
            style={inputStyle(errors.phone)}
          />
        </Field>

        <Field label="Контакт *" error={errors.contact}>
          <input
            type="text"
            placeholder="@username или https://t.me/..."
            value={form.contact}
            onChange={e => setField('contact', e.target.value)}
            style={inputStyle(errors.contact)}
          />
        </Field>

        <Field label="Оффер *" error={errors.offer}>
          <select
            value={form.offer}
            onChange={e => setField('offer', e.target.value)}
            style={inputStyle(errors.offer)}
          >
            <option value="">Выберите оффер...</option>
            {OFFERS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Доход ₽ *" error={errors.revenue}>
            <input
              type="number"
              placeholder="0"
              value={form.revenue}
              onChange={e => setField('revenue', e.target.value)}
              min="0"
              style={inputStyle(errors.revenue)}
            />
          </Field>
          <Field label="Выплата ₽ *" error={errors.payout}>
            <input
              type="number"
              placeholder="0"
              value={form.payout}
              onChange={e => setField('payout', e.target.value)}
              min="0"
              style={inputStyle(errors.payout)}
            />
          </Field>
        </div>

        <Field label="Кто привёл">
          <input
            type="text"
            placeholder="Необязательно"
            value={form.referred_by}
            onChange={e => setField('referred_by', e.target.value)}
            style={inputStyle()}
          />
        </Field>

        <Field label="Комментарий">
          <textarea
            placeholder="Необязательно..."
            value={form.comment}
            onChange={e => setField('comment', e.target.value)}
            rows={3}
            style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          style={{
            width:        '100%',
            padding:      '16px',
            borderRadius: '14px',
            border:       'none',
            background:   loading ? '#3d3d6b' : '#6366f1',
            color:        '#fff',
            fontSize:     '16px',
            fontWeight:   700,
            cursor:       loading ? 'not-allowed' : 'pointer',
            marginTop:    '8px',
            transition:   'background 0.2s',
          }}
        >
          {loading ? 'Сохраняем...' : '✅ Добавить лида'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      {children}
      {error && <span style={{ fontSize: '12px', color: '#ef4444' }}>{error}</span>}
    </div>
  )
}

function inputStyle(error) {
  return {
    width:        '100%',
    padding:      '13px',
    borderRadius: '12px',
    border:       `1px solid ${error ? '#ef4444' : '#252535'}`,
    background:   '#1a1a24',
    color:        '#f1f1f1',
    fontSize:     '15px',
    boxSizing:    'border-box',
    outline:      'none',
    fontFamily:   'inherit',
  }
}
