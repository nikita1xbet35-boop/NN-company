// ─── Offers list ─────────────────────────────────────────────────────────────
export const OFFERS = [
  'Регистрация бизнеса',
  'Расчётный счёт — Альфа',
  'Расчётный счёт — ПСБ',
  'Инвестиции',
  'МФО',
  'Дебетовая карта — Альфа',
  'Дебетовая карта — Тинькофф',
  'Дебетовая карта — Озон',
  'Кредитная карта — Сбербанк',
  'Кредитная карта — Тинькофф',
  'Кредитная карта — Альфа',
]

// ─── Statuses ────────────────────────────────────────────────────────────────
export const STATUSES = [
  'В работе',
  'Оформил',
  'Выполнил ЦД',
  'Успешно',
  'Отказ',
]

export const STATUS_COLORS = {
  'В работе':    { bg: '#2d2d3a', text: '#9ca3af', dot: '#6b7280' },
  'Оформил':     { bg: '#1e3a5f', text: '#60a5fa', dot: '#3b82f6' },
  'Выполнил ЦД': { bg: '#3d2e00', text: '#fbbf24', dot: '#f59e0b' },
  'Успешно':     { bg: '#063d27', text: '#34d399', dot: '#10b981' },
  'Отказ':       { bg: '#3d0f0f', text: '#f87171', dot: '#ef4444' },
}

// ─── User display names ───────────────────────────────────────────────────────
export const USER_DISPLAY_NAMES = {
  'tsvetkovnv': 'Никитос',
  'haaaaaaav':  'Хасл',
}

export function getDisplayName(username) {
  if (!username) return 'Неизвестно'
  const clean = username.replace('@', '')
  return USER_DISPLAY_NAMES[clean] || username
}

// ─── Money formatter ──────────────────────────────────────────────────────────
export function fmtMoney(amount) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { start, end }
}
