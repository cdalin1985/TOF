import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return json({ error: 'Server configuration missing.' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  const { data: actorProfile, error: actorError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (actorError || !actorProfile) return json({ error: 'Admin profile not found.' }, 403);
  if (!['admin', 'super_admin'].includes(actorProfile.role)) return json({ error: 'Admin access required.' }, 403);

  const body = await req.json().catch(() => null) as { player_id?: unknown; is_active?: unknown } | null;
  if (!body || typeof body.player_id !== 'string') return json({ error: 'player_id is required.' }, 400);
  if (typeof body.is_active !== 'boolean') return json({ error: 'is_active must be true or false.' }, 400);

  const { data: existingPlayer, error: readError } = await supabase
    .from('players')
    .select('id, full_name, is_active, profile_id')
    .eq('id', body.player_id)
    .single();

  if (readError || !existingPlayer) return json({ error: 'Player not found.' }, 404);

  if (existingPlayer.is_active === body.is_active) {
    return json({ success: true, changed: false, player: existingPlayer });
  }

  const { data: updatedPlayer, error: updateError } = await supabase
    .from('players')
    .update({ is_active: body.is_active })
    .eq('id', body.player_id)
    .select('id, full_name, is_active, profile_id, updated_at')
    .single();

  if (updateError || !updatedPlayer) return json({ error: updateError?.message ?? 'Could not update player.' }, 500);

  await supabase.from('audit_events').insert({
    actor_profile_id: actorProfile.id,
    action: body.is_active ? 'player.activated' : 'player.deactivated',
    target_type: 'player',
    target_id: body.player_id,
    detail: {
      full_name: existingPlayer.full_name,
      previous_is_active: existingPlayer.is_active,
      new_is_active: body.is_active,
      claimed_profile_status: existingPlayer.profile_id ? 'claimed' : 'unclaimed',
    },
  });

  return json({ success: true, changed: true, player: updatedPlayer });
});
