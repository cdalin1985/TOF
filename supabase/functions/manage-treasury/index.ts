import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const TREASURY_ENTRY_TYPES = ['credit', 'debit', 'correction', 'reversal'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Super admin access required.' }), { status: 403, headers: cors });
    }

    const { entry_type, amount_cents, description, reversed_entry_id } = await req.json();
    if (!TREASURY_ENTRY_TYPES.includes(entry_type)) {
      return new Response(JSON.stringify({ error: 'Invalid treasury entry type.' }), { status: 400, headers: cors });
    }
    if (!Number.isInteger(amount_cents)) {
      return new Response(JSON.stringify({ error: 'amount_cents must be a whole number.' }), { status: 400, headers: cors });
    }
    if (entry_type !== 'correction' && amount_cents <= 0) {
      return new Response(JSON.stringify({ error: 'Credits, debits, and reversals must use a positive amount.' }), { status: 400, headers: cors });
    }
    if (entry_type === 'correction' && amount_cents === 0) {
      return new Response(JSON.stringify({ error: 'Correction amount cannot be zero.' }), { status: 400, headers: cors });
    }
    if (entry_type === 'reversal' && !reversed_entry_id) {
      return new Response(JSON.stringify({ error: 'reversed_entry_id is required for reversal entries.' }), { status: 400, headers: cors });
    }
    if (entry_type !== 'reversal' && reversed_entry_id) {
      return new Response(JSON.stringify({ error: 'Only reversal entries can reference another ledger entry.' }), { status: 400, headers: cors });
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'description is required.' }), { status: 400, headers: cors });
    }

    if (entry_type === 'reversal') {
      const { data: reversedEntry, error: reversedReadError } = await supabase
        .from('treasury_ledger')
        .select('id')
        .eq('id', reversed_entry_id)
        .single();
      if (reversedReadError || !reversedEntry) {
        return new Response(JSON.stringify({ error: 'Entry to reverse was not found.' }), { status: 404, headers: cors });
      }
    }

    const { data: entry, error } = await supabase.from('treasury_ledger').insert({
      entry_type,
      amount_cents,
      description: description.trim(),
      created_by: user.id,
      reversed_entry_id: reversed_entry_id ?? null,
    }).select().single();

    if (error) throw error;

    const { error: auditError } = await supabase.from('audit_events').insert({
      actor_profile_id: user.id,
      action: 'treasury_entry',
      target_type: 'treasury_ledger',
      target_id: entry.id,
      detail: { entry_type, amount_cents, description: description.trim() },
    });
    if (auditError) throw auditError;

    const eventType =
      entry_type === 'reversal' ? 'treasury_entry_reversed' :
      entry_type === 'correction' ? 'treasury_entry_corrected' :
      entry_type === 'debit' ? 'treasury_entry_debit' :
      'treasury_entry_credit';
    const dollars = `$${(Math.abs(amount_cents) / 100).toFixed(2)}`;
    const verb =
      entry_type === 'credit' ? `added ${dollars} credit` :
      entry_type === 'debit' ? `recorded ${dollars} debit` :
      entry_type === 'correction' ? `posted a ${dollars} correction` :
      `reversed an entry (${dollars})`;
    const { error: activityError } = await supabase.from('activity_feed').insert({
      event_type: eventType,
      headline: `Admin ${verb} to league treasury · ${description.trim()}`,
      detail: reversed_entry_id ? `Reverses entry ${String(reversed_entry_id).slice(0, 8)}` : null,
    });
    if (activityError) throw activityError;

    return new Response(JSON.stringify({ entry_id: entry.id }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
