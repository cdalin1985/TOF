/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DISCIPLINES = ['8 Ball', '9 Ball', '10 Ball'] as const;
type Discipline = typeof DISCIPLINES[number];

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) return null;

  for (const char of name) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return null;
  }

  return name;
}

function normalizedNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function isValidDiscipline(value: unknown): value is Discipline {
  return typeof value === 'string' && (DISCIPLINES as readonly string[]).includes(value);
}

function optionalNonNegativeInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

async function rollbackCreatedPlayer(supabase: any, playerId: string): Promise<void> {
  await Promise.allSettled([
    supabase.from('player_discipline_stats').delete().eq('player_id', playerId),
    supabase.from('player_season_stats').delete().eq('player_id', playerId),
    supabase.from('player_reference_metrics').delete().eq('player_id', playerId),
    supabase.from('rankings').delete().eq('player_id', playerId),
  ]);
  await supabase.from('players').delete().eq('id', playerId);
}

async function nextRankingPosition(supabase: any): Promise<number> {
  const { data, error } = await supabase
    .from('rankings')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not read rankings: ${error.message}`);
  return (data?.position ?? 0) + 1;
}

async function insertRankingAtBottom(supabase: any, playerId: string): Promise<number> {
  let lastError: any = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const position = await nextRankingPosition(supabase);
    const { error } = await supabase.from('rankings').insert({
      player_id: playerId,
      position,
      previous_position: null,
      rank1_since: position === 1 ? new Date().toISOString() : null,
    });

    if (!error) return position;

    lastError = error;
    if (error.code !== '23505') break;
  }

  throw new Error(`Could not create ranking: ${lastError?.message ?? 'unknown error'}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server is missing Supabase configuration.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const { data: actorProfile, error: actorError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (actorError || !actorProfile) return json({ error: 'Admin profile not found.' }, 403);
  if (!['admin', 'super_admin'].includes(actorProfile.role)) {
    return json({ error: 'Only admins can add players.' }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const fullName = normalizeName(body.full_name);
  if (!fullName) {
    return json({ error: 'Full name is required and must be 2-80 printable characters.' }, 400);
  }

  const preferredDiscipline = body.preferred_discipline === undefined || body.preferred_discipline === null || body.preferred_discipline === ''
    ? null
    : body.preferred_discipline;

  if (preferredDiscipline !== null && !isValidDiscipline(preferredDiscipline)) {
    return json({ error: 'Preferred discipline must be 8 Ball, 9 Ball, or 10 Ball.' }, 400);
  }

  const fargoRating = optionalNonNegativeInteger(body.fargo_rating);
  const fargoRobustness = optionalNonNegativeInteger(body.fargo_robustness);
  if (body.fargo_rating !== undefined && body.fargo_rating !== null && body.fargo_rating !== '' && fargoRating === null) {
    return json({ error: 'Fargo rating must be a non-negative whole number.' }, 400);
  }
  if (body.fargo_robustness !== undefined && body.fargo_robustness !== null && body.fargo_robustness !== '' && fargoRobustness === null) {
    return json({ error: 'Fargo robustness must be a non-negative whole number.' }, 400);
  }

  const { data: existingPlayers, error: existingError } = await supabase
    .from('players')
    .select('id, full_name, profile_id, is_active');

  if (existingError) {
    return json({ error: `Could not check existing players: ${existingError.message}` }, 500);
  }

  const duplicate = (existingPlayers ?? []).find((player: { full_name: string }) =>
    normalizedNameKey(player.full_name) === normalizedNameKey(fullName)
  );

  if (duplicate) {
    return json({
      error: 'A player with that name already exists.',
      player_id: duplicate.id,
      claimed_profile_status: duplicate.profile_id ? 'claimed' : 'unclaimed',
    }, 409);
  }

  let createdPlayer: any = null;

  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        profile_id: null,
        full_name: fullName,
        bio: null,
        preferred_discipline: preferredDiscipline,
        avatar_url: null,
        is_active: true,
      })
      .select('id, profile_id, full_name, is_active, created_at')
      .single();

    if (playerError || !player) {
      throw new Error(`Could not create player: ${playerError?.message ?? 'unknown error'}`);
    }

    createdPlayer = player;
    const rankingPosition = await insertRankingAtBottom(supabase, player.id);

    const { error: metricsError } = await supabase.from('player_reference_metrics').insert({
      player_id: player.id,
      fargo_rating: fargoRating,
      fargo_robustness: fargoRobustness,
    });
    if (metricsError) throw new Error(`Could not create reference metrics: ${metricsError.message}`);

    const { error: seasonStatsError } = await supabase.from('player_season_stats').insert({
      player_id: player.id,
      wins: 0,
      losses: 0,
      current_streak: 0,
      best_streak: 0,
      matches_played: 0,
      challenges_issued: 0,
      challenges_received: 0,
      defender_wins: 0,
      challenger_wins: 0,
      forfeit_wins: 0,
      best_rank_achieved: rankingPosition,
    });
    if (seasonStatsError) throw new Error(`Could not create season stats: ${seasonStatsError.message}`);

    const { error: disciplineStatsError } = await supabase.from('player_discipline_stats').insert(
      DISCIPLINES.map((discipline) => ({
        player_id: player.id,
        discipline,
        matches_played: 0,
        wins: 0,
        losses: 0,
        current_streak: 0,
        best_streak: 0,
        challenger_wins: 0,
        defender_wins: 0,
        challenges_issued: 0,
        challenges_received: 0,
        forfeit_wins: 0,
        total_race_length: 0,
      })),
    );
    if (disciplineStatsError) throw new Error(`Could not create discipline stats: ${disciplineStatsError.message}`);

    await supabase.from('audit_events').insert({
      actor_profile_id: actorProfile.id,
      action: 'player.added',
      target_type: 'player',
      target_id: player.id,
      detail: {
        full_name: fullName,
        ranking_position: rankingPosition,
        claimed_profile_status: 'unclaimed',
      },
    });

    return json({
      success: true,
      player: {
        ...player,
        claimed_profile_status: 'unclaimed',
        claimed_profile: null,
      },
      ranking_position: rankingPosition,
    }, 201);
  } catch (error) {
    if (createdPlayer?.id) await rollbackCreatedPlayer(supabase, createdPlayer.id);
    console.error('[add-player]', error);
    return json({ error: error instanceof Error ? error.message : 'Could not add player.' }, 500);
  }
});
