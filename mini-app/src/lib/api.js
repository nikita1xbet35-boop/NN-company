/**
 * Notifications — вызывает Vercel API route /api/notify
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

// Новый лид
export function notifyNewLead({ full_name, offer, revenue, payout, added_by, lead_id }) {
  return notifyBot({ type: 'new_lead', new_lead: { full_name, offer, revenue, payout, added_by, lead_id } })
}

// Смена статуса
export function notifyStatusChange({ full_name, offer, new_status, changed_by, lead_id }) {
  return notifyBot({ type: 'status_change', status_change: { full_name, offer, new_status, changed_by, lead_id } })
}

// Редактирование лида
export function notifyLeadEdited({ full_name, offer, revenue, payout, changed_by, lead_id }) {
  return notifyBot({ type: 'lead_edited', lead_edited: { full_name, offer, revenue, payout, changed_by, lead_id } })
}

// Удаление лида
export function notifyLeadDeleted({ full_name, deleted_by }) {
  return notifyBot({ type: 'lead_deleted', lead_deleted: { full_name, deleted_by } })
}

// Обновление комментария
export function notifyCommentChanged({ full_name, changed_by, lead_id }) {
  return notifyBot({ type: 'comment_changed', comment_changed: { full_name, changed_by, lead_id } })
}
