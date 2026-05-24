import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lkthwgntdaduitqnfvem.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdGh3Z250ZGFkdWl0cW5mdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDYxNDUsImV4cCI6MjA5NTE4MjE0NX0.32m7NT1D1fD4BZ5f_w88FRvY_e_HeEWzKN7o2JKvRds'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL  || SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_KEY
)

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads({ offer, status, from, to, search } = {}) {
  let q = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (offer)  q = q.eq('offer', offer)
  if (status) q = q.eq('status', status)
  if (from)   q = q.gte('created_at', from)
  if (to)     q = q.lte('created_at', to)
  if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getLead(id) {
  const { data, error } = await supabase
    .from('leads').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createLead(lead) {
  const { data, error } = await supabase
    .from('leads').insert(lead).select().single()
  if (error) throw error
  return data
}

export async function updateLeadStatus(id, newStatus, changedBy, oldStatus) {
  const { error: e1 } = await supabase
    .from('leads').update({ status: newStatus }).eq('id', id)
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('status_history').insert({
      lead_id: id, old_status: oldStatus,
      new_status: newStatus, changed_by: changedBy,
    })
  if (e2) throw e2
}

export async function updateLeadComment(id, comment) {
  const { error } = await supabase
    .from('leads').update({ comment }).eq('id', id)
  if (error) throw error
}

export async function getStatusHistory(leadId) {
  const { data, error } = await supabase
    .from('status_history').select('*')
    .eq('lead_id', leadId).order('changed_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getDashboardStats(from, to) {
  const { data, error } = await supabase
    .from('leads').select('offer,status,revenue,payout')
    .gte('created_at', from).lte('created_at', to)
  if (error) throw error
  return data || []
}
