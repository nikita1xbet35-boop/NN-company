/**
 * Calls the bot's /notify endpoint to send Telegram notifications.
 * Non-blocking — we don't block lead creation on notification failure.
 */

const BOT_URL      = import.meta.env.VITE_BOT_URL
const NOTIFY_SECRET = import.meta.env.VITE_NOTIFY_SECRET

export async function notifyNewLead({ full_name, offer, revenue, payout, added_by }) {
  if (!BOT_URL) return
  try {
    await fetch(`${BOT_URL}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Notify-Secret': NOTIFY_SECRET,
      },
      body: JSON.stringify({
        type: 'new_lead',
        new_lead: { full_name, offer, revenue, payout, added_by },
      }),
    })
  } catch (e) {
    console.warn('Notification failed (non-blocking):', e)
  }
}

export async function notifyStatusChange({ full_name, offer, new_status, changed_by }) {
  if (!BOT_URL) return
  try {
    await fetch(`${BOT_URL}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Notify-Secret': NOTIFY_SECRET,
      },
      body: JSON.stringify({
        type: 'status_change',
        status_change: { full_name, offer, new_status, changed_by },
      }),
    })
  } catch (e) {
    console.warn('Notification failed (non-blocking):', e)
  }
}
