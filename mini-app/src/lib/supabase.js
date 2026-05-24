/**
 * Supabase REST API — direct fetch, no SDK
 * Eliminates module-level crashes from @supabase/supabase-js
 */

const SB_URL = 'https://lkthwgntdaduitqnfvem.supabase.co/rest/v1'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDYxNDUsImV4cCI6MjA5NTE4MjE0NX0.32m7NT1D1fD4BZ5f_w88FRvY_e_HeEWzKN7o2JKvRds'

const H = {
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type':  'application/json',
}

function buildUrl(table, params) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(val => sp.append(k, val))
    else sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `${SB_URL}/${table}?${qs}` : `${SB_URL}/${table}`
}

async function GET(table, params = {}, single = false) {
  const headers = single
    ? { ...H, 'Accept': 'application/vnd.pgrst.object+json' }
    : H
  const r = await fetch(buildUrl(table, params), { headers })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function POST(table, body, prefer = 'return=representation') {
  const r = await fetch(`${SB_URL}/${table}`, {
    method: 'POST',
    headers: { ...H, 'Prefer': prefer },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

async function PATCH(table, params, body) {
  const r = await fetch(buildUrl(table, params), {
    method: 'PATCH',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads({ offer, status, from, to, search } = {}) {
  const params = { select: '*', order: 'created_at.desc' }
  if (offer)  params.offer  = `eq.${offer}`
  if (status) params.status = `eq.${status}`
  if (from || to) {
    const dateF = []
    if (from) dateF.push(`gte.${from}`)
    if (to)   dateF.push(`lte.${to}`)
    params.created_at = dateF
  }
  if (search) {
    params.or = `(full_name.ilike.*${search}*,phone.ilike.*${search}*)`
  }
  return GET('leads', params)
}

export async function getLead(id) {
  return GET('leads', { select: '*', id: `eq.${id}` }, true)
}

export async function createLead(lead) {
  const data = await POST('leads', lead)
  return Array.isArray(data) ? data[0] : data
}

export async function updateLeadStatus(id, newStatus, changedBy, oldStatus) {
  await PATCH('leads', { id: `eq.${id}` }, { status: newStatus })
  await POST('status_history', {
    lead_id: id, old_status: oldStatus,
    new_status: newStatus, changed_by: changedBy,
  }, 'return=minimal')
}

export async function updateLeadComment(id, comment) {
  await PATCH('leads', { id: `eq.${id}` }, { comment })
}

export async function updateLead(id, data) {
  const r = await fetch(buildUrl('leads', { id: `eq.${id}` }), {
    method: 'PATCH',
    headers: { ...H, 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error(await r.text())
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

export async function deleteLead(id) {
  const r = await fetch(`${SB_URL}/leads?id=eq.${id}`, {
    method: 'DELETE',
    headers: H,
  })
  if (!r.ok) throw new Error(await r.text())
}

export async function getStatusHistory(leadId) {
  return GET('status_history', {
    select: '*', lead_id: `eq.${leadId}`, order: 'changed_at.desc',
  })
}

export async function getDashboardStats(from, to) {
  return GET('leads', {
    select:     'offer,status,revenue,payout',
    created_at: [`gte.${from}`, `lte.${to}`],
  })
}
