/**
 * Notifications — calls Vercel API route /api/notify
 * No external bot server needed
 */

const NOTIFY_SECRET = 'nn_notify_secret_x9k2p7m4'

async function notifyBot(payload) {
  try {
    await fetch('/api/notify', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Notify-Secret': NOTIFY_SECRET,
      },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.warn('Notification failed (non-blocking):', e)
  }
}

export function notifyNewLead({ full_name, offer, revenue, payout, added_by, lead_id }) {
  return notifyBot({ type: 'new_lead', new_lead: { full_name, offer, revenue, payout, added_by, lead_id } })
}

export function notifyStatusChange({ full_name, offer, new_status, changed_by, lead_id }) {
  return notifyBot({ type: 'status_change', status_change: { full_name, offer, new_status, changed_by, lead_id } })
}
