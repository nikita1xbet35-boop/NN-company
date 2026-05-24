import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

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

  if (search) {
    q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function getLead(id) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createLead(lead) {
  const { data, error } = await supabase
    .from('leads')
    .insert(lead)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLeadStatus(id, newStatus, changedBy, oldStatus) {
  // Update lead
  const { error: e1 } = await supabase
    .from('leads')
    .update({ status: newStatus })
    .eq('id', id)
  if (e1) throw e1

  // Add to history
  const { error: e2 } = await supabase
    .from('status_history')
    .insert({
      lead_id:    id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: changedBy,
    })
  if (e2) throw e2
}

export async function updateLeadComment(id, comment) {
  const { error } = await supabase
    .from('leads')
    .update({ comment })
    .eq('id', id)
  if (error) throw error
}

export async function getStatusHistory(leadId) {
  const { data, error } = await supabase
    .from('status_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(from, to) {
  const { data, error } = await supabase
    .from('leads')
    .select('offer, status, revenue, payout')
    .gte('created_at', from)
    .lte('created_at', to)
  if (error) throw error
  return data
}
