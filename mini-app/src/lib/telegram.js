/**
 * Telegram Web App SDK helpers
 */

export function getTelegramApp() {
  return window.Telegram?.WebApp
}

export function getTelegramUser() {
  const tg = getTelegramApp()
  return tg?.initDataUnsafe?.user || null
}

export function initTelegram() {
  const tg = getTelegramApp()
  if (!tg) return

  tg.ready()
  tg.expand()

  // Apply Telegram color scheme if available
  if (tg.colorScheme === 'dark' || true) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}

export function haptic(type = 'light') {
  try {
    const tg = getTelegramApp()
    if (!tg?.HapticFeedback) return
    if (type === 'light')  tg.HapticFeedback.impactOccurred('light')
    if (type === 'medium') tg.HapticFeedback.impactOccurred('medium')
    if (type === 'success') tg.HapticFeedback.notificationOccurred('success')
    if (type === 'error')   tg.HapticFeedback.notificationOccurred('error')
  } catch (_) {}
}
