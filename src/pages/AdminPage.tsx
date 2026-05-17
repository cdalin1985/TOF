import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, AlertTriangle, Users, DollarSign, Settings, FileText,
  Trophy, UserPlus, Swords, ArrowUp, ArrowDown, Crown, List,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { formatDistanceToNow, formatDate } from '../utils/time';
import type { Match, Player, TreasuryEntry, AuditEvent, LeagueSettings, Challenge } from '../types/database';

type TabKey = 'disputes' | 'challenges' | 'matches' | 'rankings' | 'players' | 'treasury' | 'rank1' | 'settings' | 'audit';
type ChallengeRow = Challenge & { match_id: string | null };
type RankRow = { id: string; player_id: string; position: number; full_name: string };

export default function AdminPage() {
  const { profile } = useAuthStore();
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const [tab, setTab] = useState<TabKey>('disputes');

  if (!profile) return null;
  if (!['admin', 'super_admin'].includes(profile.role)) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen px-4 pt-4 pb-8">
      <button onClick={() => navigate('/')} className="flex items-center gap-1 text-[#9CA3AF] p-2 -ml-2 mb-4">
        <ChevronLeft size={18} /> Back
      </button>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🛡️</span>
        <h1 className="font-[Bebas_Neue] text-5xl text-[#E8E2D6]">Admin</h1>
        <Badge variant="info">{profile?.role}</Badge>
      </div>
      <p className="text-[#9CA3AF] text-sm font-[Barlow] mb-6">League management — handle with care.</p>

      {/* Tabs — horizontal scroll */}
      <div className="flex overflow-x-auto gap-1 mb-5 bg-[#1A1A1A] rounded-xl p-1" style={{ scrollbarWidth: 'none' }}>
        {(([
          { key: 'disputes',   Icon: AlertTriangle, label: 'Disputes'   },
          { key: 'challenges', Icon: Swords,        label: 'Challenges' },
          { key: 'matches',    Icon: Trophy,        label: 'Matches'    },
          { key: 'rankings',   Icon: List,          label: 'Rankings'   },
          { key: 'players',    Icon: Users,         label: 'Players'    },
          { key: 'treasury',   Icon: DollarSign,    label: 'Treasury'   },
          { key: 'rank1',      Icon: Crown,         label: 'Rank #1'    },
          { key: 'settings',   Icon: Settings,      label: 'Settings'   },
          { key: 'audit',      Icon: FileText,      label: 'Audit'      },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ]) as { key: TabKey; Icon: React.FC<any>; label: string }[]).map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-col items-center py-2 px-3 rounded-lg text-xs font-[Barlow] transition-all whitespace-nowrap shrink-0 ${tab === key ? 'bg-[#C62828] text-white' : 'text-[#9CA3AF]'}`}
          >
            <Icon size={16} className="mb-0.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'disputes'   && <DisputesTab qc={qc} />}
      {tab === 'challenges' && <ChallengesTab qc={qc} />}
      {tab === 'matches'    && <MatchesAdminTab qc={qc} />}
      {tab === 'rankings'   && <RankingsTab qc={qc} />}
      {tab === 'players'    && <PlayersTab qc={qc} />}
      {tab === 'treasury'   && <TreasuryTab />}
      {tab === 'rank1'      && <Rank1Tab isSuperAdmin={profile?.role === 'super_admin'} />}
      {tab === 'settings'   && <SettingsTab />}
      {tab === 'audit'      && <AuditTab />}
    </div>
  );
}

// ─── Disputes ────────────────────────────────────────────────────────────────

function DisputesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: disputes = [] } = useQuery<Match[]>({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data } = await supabase.from('matches').select('*').eq('status', 'disputed');
      return data ?? [];
    },
  });

  const { data: players = [] } = useQuery<Pick<Player, 'id' | 'full_name'>[]>({
    queryKey: ['players-lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, full_name');
      return data ?? [];
    },
  });

  const getName = (id: string) => players.find((p) => p.id === id)?.full_name ?? id.slice(0, 8) + '…';

  const [resolving, setResolving] = useState<string | null>(null);
  const [winnerId, setWinnerId]   = useState('');
  const [p1Score, setP1Score]     = useState('');
  const [p2Score, setP2Score]     = useState('');
  const [notes, setNotes]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleResolve = async (matchId: string) => {
    const s1 = parseInt(p1Score, 10);
    const s2 = parseInt(p2Score, 10);
    if (!winnerId || isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ match_id: matchId, winner_id: winnerId, final_score_player1: s1, final_score_player2: s2, notes }),
    });
    setLoading(false);
    setResolving(null);
    qc.invalidateQueries({ queryKey: ['admin-disputes'] });
    qc.invalidateQueries({ queryKey: ['rankings'] });
  };

  if (disputes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">✅</div>
        <div className="font-[Bebas_Neue] text-2xl text-[#E8E2D6]">No Disputed Matches</div>
        <div className="text-[#9CA3AF] text-sm font-[Barlow] mt-1">All matches are resolved.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map((m) => (
        <GlassCard key={m.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="loss">DISPUTED</Badge>
            <span className="text-[#6B7280] text-xs font-[Barlow]">{formatDate(m.created_at)}</span>
          </div>
          <div className="text-[#E8E2D6] font-[Barlow] text-sm font-semibold mb-0.5">
            {getName(m.player1_id)} vs {getName(m.player2_id)}
          </div>
          <div className="text-[#E8E2D6] font-[Barlow] text-sm mb-1">Score: {m.player1_score}–{m.player2_score}</div>
          <div className="text-[#9CA3AF] text-xs font-[Barlow] mb-3">{m.discipline} · Race to {m.race_length} · {m.venue}</div>
          {resolving === m.id ? (
            <div className="space-y-3">
              <div>
                <p className="text-[#9CA3AF] text-xs font-[Barlow] mb-2">Select winner:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: m.player1_id, name: getName(m.player1_id) }, { id: m.player2_id, name: getName(m.player2_id) }].map((p) => (
                    <button key={p.id} onClick={() => setWinnerId(p.id)}
                      className={`py-3 px-2 rounded-xl border text-sm font-[Barlow] font-medium transition-all ${winnerId === p.id ? 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]' : 'border-[#333] bg-[#252525]/50 text-[#E8E2D6]'}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="P1 score" value={p1Score} onChange={(e) => setP1Score(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] text-xs font-[Barlow] focus:outline-none focus:border-[#C62828]" />
                <input type="number" placeholder="P2 score" value={p2Score} onChange={(e) => setP2Score(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] text-xs font-[Barlow] focus:outline-none focus:border-[#C62828]" />
              </div>
              <textarea placeholder="Admin notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] text-xs font-[Barlow] focus:outline-none focus:border-[#C62828] resize-none" />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setResolving(null)}>Cancel</Button>
                <Button variant="primary" size="sm" loading={loading} disabled={!winnerId} onClick={() => handleResolve(m.id)}>Resolve</Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => { setResolving(m.id); setWinnerId(''); setP1Score(''); setP2Score(''); setNotes(''); }}>
              Resolve Dispute
            </Button>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Active Challenges ────────────────────────────────────────────────────────

function ChallengesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: challenges = [] } = useQuery<ChallengeRow[]>({
    queryKey: ['admin-active-challenges'],
    queryFn: async () => {
      const { data: chals } = await supabase
        .from('challenges')
        .select('*')
        .in('status', ['pending', 'accepted', 'scheduled', 'in_progress'])
        .order('created_at', { ascending: false });
      if (!chals?.length) return [];
      const { data: matches } = await supabase
        .from('matches')
        .select('id, challenge_id')
        .in('challenge_id', chals.map((c) => c.id));
      return chals.map((c) => ({
        ...c,
        match_id: matches?.find((m) => m.challenge_id === c.id)?.id ?? null,
      }));
    },
  });

  const { data: players = [] } = useQuery<Pick<Player, 'id' | 'full_name'>[]>({
    queryKey: ['players-lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, full_name');
      return data ?? [];
    },
  });

  const getName = (id: string) => players.find((p) => p.id === id)?.full_name ?? id.slice(0, 8) + '…';

  const [actioning, setActioning]   = useState<string | null>(null);
  const [actionType, setActionType] = useState<'cancel' | 'forfeit' | null>(null);
  const [winnerId, setWinnerId]     = useState('');
  const [loading, setLoading]       = useState(false);

  const resetAction = () => { setActioning(null); setActionType(null); setWinnerId(''); };

  const handleCancel = async (c: ChallengeRow) => {
    setLoading(true);
    await supabase.from('challenges').update({ status: 'cancelled' }).eq('id', c.id);
    qc.invalidateQueries({ queryKey: ['admin-active-challenges'] });
    setLoading(false);
    resetAction();
  };

  const handleForfeit = async (c: ChallengeRow) => {
    if (!winnerId || !c.match_id) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); resetAction(); return; }
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ match_id: c.match_id, winner_id: winnerId, final_score_player1: 0, final_score_player2: 0, notes: 'Admin forfeit' }),
    });
    await supabase.from('challenges').update({ status: 'forfeited' }).eq('id', c.id);
    qc.invalidateQueries({ queryKey: ['admin-active-challenges'] });
    qc.invalidateQueries({ queryKey: ['rankings'] });
    setLoading(false);
    resetAction();
  };

  const STATUS_BADGE: Record<string, string> = {
    pending: 'pending', accepted: 'win', scheduled: 'info', in_progress: 'loss',
  };

  if (challenges.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">✅</div>
        <div className="font-[Bebas_Neue] text-2xl text-[#E8E2D6]">No Active Challenges</div>
        <div className="text-[#9CA3AF] text-sm font-[Barlow] mt-1">Nothing pending action.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {challenges.map((c) => (
        <GlassCard key={c.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Badge variant={STATUS_BADGE[c.status] as any}>{c.status.replace('_', ' ').toUpperCase()}</Badge>
            <span className="text-[#6B7280] text-xs font-[Barlow]">{formatDate(c.created_at)}</span>
          </div>
          <div className="font-[Barlow] font-semibold text-sm text-[#E8E2D6] mb-0.5">
            {getName(c.challenger_id)} → {getName(c.challenged_id)}
          </div>
          <div className="text-[#9CA3AF] text-xs font-[Barlow] mb-3">
            {c.discipline} · Race to {c.race_length} · Expires {formatDistanceToNow(c.expires_at)}
          </div>

          {actioning === c.id ? (
            <div className="space-y-3">
              {actionType === 'forfeit' && (
                c.match_id ? (
                  <>
                    <p className="text-[#9CA3AF] text-xs font-[Barlow]">Select winner:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: c.challenger_id, name: getName(c.challenger_id) }, { id: c.challenged_id, name: getName(c.challenged_id) }].map((p) => (
                        <button key={p.id} onClick={() => setWinnerId(p.id)}
                          className={`py-2 rounded-xl border text-sm font-[Barlow] transition-all ${winnerId === p.id ? 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]' : 'border-[#333] bg-[#252525]/50 text-[#E8E2D6]'}`}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[#F59E0B] text-xs font-[Barlow]">No match started — this will cancel the challenge only.</p>
                )
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={resetAction}>Back</Button>
                <Button
                  variant="danger" size="sm" loading={loading}
                  disabled={actionType === 'forfeit' && !!c.match_id && !winnerId}
                  onClick={() => actionType === 'cancel' ? handleCancel(c) : (c.match_id ? handleForfeit(c) : handleCancel(c))}
                >
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setActioning(c.id); setActionType('cancel'); }}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => { setActioning(c.id); setActionType('forfeit'); setWinnerId(''); }}>
                {c.match_id ? 'Force Forfeit' : 'Force Cancel'}
              </Button>
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Active Matches ───────────────────────────────────────────────────────────

function MatchesAdminTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: matches = [] } = useQuery<Match[]>({
    queryKey: ['admin-active-matches'],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['scheduled', 'in_progress', 'submitted'])
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: players = [] } = useQuery<Pick<Player, 'id' | 'full_name'>[]>({
    queryKey: ['players-lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, full_name');
      return data ?? [];
    },
  });

  const getName = (id: string) => players.find((p) => p.id === id)?.full_name ?? id.slice(0, 8) + '…';

  const [resolving, setResolving] = useState<string | null>(null);
  const [winnerId, setWinnerId]   = useState('');
  const [p1Score, setP1Score]     = useState('');
  const [p2Score, setP2Score]     = useState('');
  const [notes, setNotes]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleForceComplete = async (matchId: string) => {
    if (!winnerId) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ match_id: matchId, winner_id: winnerId, final_score_player1: parseInt(p1Score) || 0, final_score_player2: parseInt(p2Score) || 0, notes }),
    });
    setLoading(false);
    setResolving(null);
    qc.invalidateQueries({ queryKey: ['admin-active-matches'] });
    qc.invalidateQueries({ queryKey: ['rankings'] });
  };

  const STATUS_BADGE: Record<string, string> = { scheduled: 'info', in_progress: 'loss', submitted: 'pending' };

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">✅</div>
        <div className="font-[Bebas_Neue] text-2xl text-[#E8E2D6]">No Active Matches</div>
        <div className="text-[#9CA3AF] text-sm font-[Barlow] mt-1">Nothing pending action.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <GlassCard key={m.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Badge variant={STATUS_BADGE[m.status] as any}>{m.status.replace('_', ' ').toUpperCase()}</Badge>
            <span className="text-[#6B7280] text-xs font-[Barlow]">{formatDate(m.created_at)}</span>
          </div>
          <div className="font-[Barlow] font-semibold text-sm text-[#E8E2D6] mb-0.5">
            {getName(m.player1_id)} vs {getName(m.player2_id)}
          </div>
          <div className="text-[#9CA3AF] text-xs font-[Barlow] mb-1">Score: {m.player1_score}–{m.player2_score}</div>
          <div className="text-[#9CA3AF] text-xs font-[Barlow] mb-2">{m.discipline} · Race to {m.race_length} · {m.venue}</div>
          {m.player1_submitted && <div className="text-[#F59E0B] text-xs font-[Barlow]">⚠ {getName(m.player1_id)} submitted</div>}
          {m.player2_submitted && <div className="text-[#F59E0B] text-xs font-[Barlow] mb-2">⚠ {getName(m.player2_id)} submitted</div>}

          {resolving === m.id ? (
            <div className="space-y-3 mt-2">
              <div>
                <p className="text-[#9CA3AF] text-xs font-[Barlow] mb-2">Select winner:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: m.player1_id, name: getName(m.player1_id) }, { id: m.player2_id, name: getName(m.player2_id) }].map((p) => (
                    <button key={p.id} onClick={() => setWinnerId(p.id)}
                      className={`py-3 px-2 rounded-xl border text-sm font-[Barlow] font-medium transition-all ${winnerId === p.id ? 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]' : 'border-[#333] bg-[#252525]/50 text-[#E8E2D6]'}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder={`${getName(m.player1_id)} score`} value={p1Score} onChange={(e) => setP1Score(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] text-xs font-[Barlow] focus:outline-none focus:border-[#C62828]" />
                <input type="number" placeholder={`${getName(m.player2_id)} score`} value={p2Score} onChange={(e) => setP2Score(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] text-xs font-[Barlow] focus:outline-none focus:border-[#C62828]" />
              </div>
              <textarea placeholder="Admin notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] text-xs font-[Barlow] focus:outline-none focus:border-[#C62828] resize-none" />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setResolving(null)}>Cancel</Button>
                <Button variant="primary" size="sm" loading={loading} disabled={!winnerId} onClick={() => handleForceComplete(m.id)}>
                  Force Complete
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => { setResolving(m.id); setWinnerId(''); setP1Score(''); setP2Score(''); setNotes(''); }}>
              Force Complete
            </Button>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Rankings Editor ──────────────────────────────────────────────────────────

function RankingsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: rawRankings = [] } = useQuery<RankRow[]>({
    queryKey: ['admin-rankings'],
    queryFn: async () => {
      const [{ data: ranks }, { data: pls }] = await Promise.all([
        supabase.from('rankings').select('id, player_id, position').order('position'),
        supabase.from('players').select('id, full_name').eq('is_active', true),
      ]);
      return (ranks ?? []).map((r) => ({
        ...r,
        full_name: (pls ?? []).find((p) => p.id === r.player_id)?.full_name ?? 'Unknown',
      }));
    },
  });

  const [order, setOrder]   = useState<RankRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const displayedOrder = order.length > 0 ? order : rawRankings;

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setOrder((prev) => {
      const next = [...(prev.length > 0 ? prev : rawRankings)];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx === displayedOrder.length - 1) return;
    setOrder((prev) => {
      const next = [...(prev.length > 0 ? prev : rawRankings)];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const isDirty = displayedOrder.some((r, i) => {
    const original = rawRankings.find((raw) => raw.player_id === r.player_id);
    return original?.position !== i + 1;
  });

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(
      displayedOrder.map((r, i) =>
        supabase.from('rankings')
          .update({ position: i + 1, previous_position: r.position })
          .eq('player_id', r.player_id)
      )
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    qc.invalidateQueries({ queryKey: ['rankings'] });
    qc.invalidateQueries({ queryKey: ['admin-rankings'] });
  };

  if (displayedOrder.length === 0) {
    return <div className="text-center py-12 text-[#6B7280] font-[Barlow]">Loading rankings…</div>;
  }

  return (
    <div className="space-y-3">
      <GlassCard className="p-3">
        <p className="text-[#9CA3AF] text-xs font-[Barlow]">
          Use arrows to reorder players. Changes are staged until you tap Save.
        </p>
      </GlassCard>

      <div className="space-y-1">
        {displayedOrder.map((r, i) => {
          const original = rawRankings.find((raw) => raw.player_id === r.player_id);
          const changed = original?.position !== i + 1;
          return (
            <GlassCard key={r.player_id} className={`p-3 flex items-center gap-3 ${changed ? 'border border-[#F59E0B]/30' : ''}`}>
              <span className="font-[Azeret_Mono] font-bold text-lg text-[#C62828] w-7 text-center shrink-0">
                {i + 1}
              </span>
              <span className="font-[Barlow] font-semibold text-sm text-[#E8E2D6] flex-1 truncate">
                {r.full_name}
              </span>
              {changed && (
                <span className="text-[#F59E0B] text-xs font-[Azeret_Mono] shrink-0">
                  was {original?.position}
                </span>
              )}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => moveUp(i)} disabled={i === 0}
                  className="p-1 rounded text-[#9CA3AF] hover:text-[#E8E2D6] disabled:opacity-20 transition-colors">
                  <ArrowUp size={14} />
                </button>
                <button onClick={() => moveDown(i)} disabled={i === displayedOrder.length - 1}
                  className="p-1 rounded text-[#9CA3AF] hover:text-[#E8E2D6] disabled:opacity-20 transition-colors">
                  <ArrowDown size={14} />
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" fullWidth disabled={!isDirty} onClick={() => setOrder(rawRankings)}>
          Reset
        </Button>
        <Button variant="primary" fullWidth loading={saving} disabled={!isDirty} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Order'}
        </Button>
      </div>
    </div>
  );
}

// ─── Players ─────────────────────────────────────────────────────────────────

function PlayersTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['admin-players'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('*').order('full_name');
      return data ?? [];
    },
  });

  // Metrics lookup for Fargo ratings
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const { data: metrics = [] } = useQuery<{ player_id: string; fargo_rating: number | null }[]>({
    queryKey: ['admin-player-metrics', playerIds],
    enabled: playerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('player_reference_metrics')
        .select('player_id, fargo_rating')
        .in('player_id', playerIds);
      return data ?? [];
    },
  });
  const fargoByPlayer = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const m of metrics) map.set(m.player_id, m.fargo_rating);
    return map;
  }, [metrics]);

  // Filters: All / Claimed / Unclaimed
  const [filter, setFilter] = useState<'all' | 'claimed' | 'unclaimed'>('all');
  const filteredPlayers = useMemo(() => {
    if (filter === 'claimed') return players.filter((p) => p.profile_id);
    if (filter === 'unclaimed') return players.filter((p) => !p.profile_id);
    return players;
  }, [players, filter]);

  const [adding, setAdding]         = useState(false);
  const [newName, setNewName]       = useState('');
  const [newFargo, setNewFargo]     = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]     = useState('');
  const [activeToggling, setActiveToggling] = useState<string | null>(null);
  const [activeError, setActiveError] = useState('');

  const toggleActive = async (p: Player) => {
    setActiveToggling(p.id);
    setActiveError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setActiveError('Session expired — please log in again.');
      setActiveToggling(null);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-player-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ player_id: p.id, is_active: !p.is_active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        setActiveError(json.error ?? 'Could not update player status.');
        return;
      }
      qc.invalidateQueries({ queryKey: ['admin-players'] });
      qc.invalidateQueries({ queryKey: ['audit-events'] });
    } catch {
      setActiveError('Network error — please try again.');
    } finally {
      setActiveToggling(null);
    }
  };

  const handleAddPlayer = async () => {
    if (!newName.trim()) return;
    setAddLoading(true);
    setAddError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAddError('Session expired — please log in again.'); setAddLoading(false); return; }

    const payload: { full_name: string; fargo_rating?: number } = { full_name: newName.trim() };
    const trimmedFargo = newFargo.trim();
    if (trimmedFargo !== '') {
      if (!/^\d+$/.test(trimmedFargo)) {
        setAddError('Fargo rating must be a non-negative whole number.');
        setAddLoading(false);
        return;
      }
      const numeric = Number(trimmedFargo);
      if (!Number.isSafeInteger(numeric) || numeric < 0) {
        setAddError('Fargo rating must be a non-negative whole number.');
        setAddLoading(false);
        return;
      }
      payload.fargo_rating = numeric;
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setAddLoading(false);
    if (json.error) { setAddError(json.error); return; }
    setNewName('');
    setNewFargo('');
    setAdding(false);
    qc.invalidateQueries({ queryKey: ['admin-players'] });
    qc.invalidateQueries({ queryKey: ['admin-player-metrics'] });
    qc.invalidateQueries({ queryKey: ['rankings'] });
  };


  return (
    <div className="space-y-3">
      {adding ? (
        <GlassCard className="p-4">
          <h3 className="font-[Bebas_Neue] text-lg text-[#E8E2D6] mb-3">Add New Player</h3>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
            className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828] mb-2" />
          <input type="number" min={0} step={1} inputMode="numeric" value={newFargo} onChange={(e) => setNewFargo(e.target.value)} placeholder="Fargo rating (optional)"
            onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
            className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828] mb-3" />
          {addError && <p className="text-[#EF4444] text-xs font-[Barlow] mb-2">{addError}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNewName(''); setNewFargo(''); setAddError(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" loading={addLoading} disabled={!newName.trim()} onClick={handleAddPlayer}>Add Player</Button>
          </div>
        </GlassCard>
      ) : (
        <Button variant="secondary" fullWidth onClick={() => setAdding(true)}>
          <UserPlus size={16} /> Add New Player
        </Button>
      )}

      {activeError && <p className="text-[#EF4444] text-xs font-[Barlow]">{activeError}</p>}

      {/* Filter buttons */}
      <div className="flex gap-2">
        {(['all', 'claimed', 'unclaimed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-xs font-[Barlow] font-medium transition-all ${filter === f ? 'bg-[#C62828] text-white' : 'bg-[#252525] text-[#9CA3AF] border border-[#333]'}`}>
            {f === 'all' ? 'All' : f === 'claimed' ? 'Claimed' : 'Unclaimed'}
          </button>
        ))}
      </div>

      <p className="text-[#9CA3AF] text-xs font-[Barlow]">{filteredPlayers.length} {filter === 'all' ? 'total' : filter} players</p>
      {filteredPlayers.map((p) => {
        const fr = fargoByPlayer.get(p.id);
        return (
          <GlassCard key={p.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className={`font-[Barlow] font-semibold text-sm truncate ${p.is_active ? 'text-[#E8E2D6]' : 'text-[#6B7280] line-through'}`}>
                {p.full_name}
                {typeof fr === 'number' && (
                  <span className="ml-2 text-[#9CA3AF] font-normal">FR {fr}</span>
                )}
              </div>
              <div className="text-[#6B7280] text-xs font-[Barlow]">{p.profile_id ? 'Claimed' : 'Unclaimed'}</div>
            </div>
            <button onClick={() => toggleActive(p)} disabled={activeToggling === p.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-[Barlow] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${p.is_active ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'}`}>
              {activeToggling === p.id ? 'Saving…' : p.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </GlassCard>
        );
      })}
    </div>
  );
}

// ─── Treasury ────────────────────────────────────────────────────────────────

function TreasuryTab() {
  const [entryType, setEntryType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount]       = useState('');
  const [desc, setDesc]           = useState('');
  const [loading, setLoading]     = useState(false);

  const { data: entries = [] } = useQuery<TreasuryEntry[]>({
    queryKey: ['treasury'],
    queryFn: async () => {
      const { data } = await supabase.from('treasury_ledger').select('*').order('created_at', { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const balance = entries.reduce((sum, e) => {
    if (e.entry_type === 'credit') return sum + e.amount_cents;
    if (e.entry_type === 'debit')  return sum - e.amount_cents;
    return sum;
  }, 0);

  const handleAdd = async () => {
    if (!amount || !desc) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-treasury`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ entry_type: entryType, amount_cents: Math.round(parseFloat(amount) * 100), description: desc }),
    });
    setLoading(false);
    setAmount('');
    setDesc('');
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5 text-center">
        <div className="text-[#9CA3AF] text-sm font-[Barlow] mb-1">Current Balance</div>
        <div className="font-[Azeret_Mono] font-bold text-5xl" style={{ color: balance >= 0 ? '#22C55E' : '#EF4444' }}>
          ${(Math.abs(balance) / 100).toFixed(2)}
        </div>
        {balance < 0 && <div className="text-[#EF4444] text-xs font-[Barlow] mt-1">In deficit</div>}
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">Add Entry</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['credit', 'debit'] as const).map((t) => (
              <button key={t} onClick={() => setEntryType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-[Barlow] font-medium transition-all ${entryType === t ? (t === 'credit' ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40' : 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40') : 'bg-[#252525] text-[#9CA3AF] border border-[#333]'}`}>
                {t === 'credit' ? '+ Credit' : '- Debit'}
              </button>
            ))}
          </div>
          <input type="number" step="0.01" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828]" />
          <input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828]" />
          <Button variant="primary" fullWidth loading={loading} onClick={handleAdd} disabled={!amount || !desc}>Add Entry</Button>
        </div>
      </GlassCard>

      <div className="space-y-2">
        {entries.map((e) => (
          <GlassCard key={e.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-[Barlow] text-sm text-[#E8E2D6]">{e.description}</div>
              <div className="text-[#6B7280] text-xs font-[Barlow]">{formatDate(e.created_at)}</div>
            </div>
            <div className={`font-[Azeret_Mono] font-bold ${e.entry_type === 'credit' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {e.entry_type === 'credit' ? '+' : '-'}${(e.amount_cents / 100).toFixed(2)}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── Rank #1 Compliance ──────────────────────────────────────────────────────

type Rank1Status = {
  penalized?: boolean;
  player?: string;
  top5_matches?: number;
  required_top5_matches?: number;
  days_elapsed?: number;
  days_remaining?: number;
  target_rank?: number;
  compliant?: boolean;
  message?: string;
  error?: string;
};

function Rank1Tab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [status, setStatus] = useState<Rank1Status | null>(null);
  const [loading, setLoading] = useState(false);

  const callFn = async (enforce: boolean) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rank1-compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ enforce }),
      });
      setStatus(await res.json());
    } catch {
      setStatus({ error: 'Network error — please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <h3 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-1">Rank #1 Obligation</h3>
        <p className="text-[#9CA3AF] text-xs font-[Barlow] mb-4">
          The #1 player must play 2 top-5 opponents within 30 days of reaching #1 or be moved to #10.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth loading={loading} onClick={() => callFn(false)}>Check Status</Button>
          {isSuperAdmin && (
            <Button variant="danger" fullWidth loading={loading} onClick={() => callFn(true)}>Enforce Now</Button>
          )}
        </div>
      </GlassCard>

      {status && (
        <GlassCard className="p-5">
          {status.error ? (
            <p className="text-[#EF4444] text-sm font-[Barlow]">{status.error}</p>
          ) : status.penalized ? (
            <>
              <div className="text-3xl mb-2">📉</div>
              <div className="font-[Bebas_Neue] text-xl text-[#EF4444] mb-1">Penalty Applied</div>
              <p className="text-[#9CA3AF] text-sm font-[Barlow]">
                {status.player} was moved to #{status.target_rank ?? 10} — only {status.top5_matches}/{status.required_top5_matches ?? 2} top-5 matches in {status.days_elapsed} days.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="font-[Barlow] font-semibold text-[#E8E2D6]">{status.player}</span>
                <Badge variant={status.compliant ? 'win' : 'pending'}>{status.compliant ? 'Compliant' : 'At Risk'}</Badge>
              </div>
              {status.message && (
                <p className="text-[#9CA3AF] text-sm font-[Barlow] mb-4">{status.message}</p>
              )}
              {status.days_elapsed !== undefined && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="font-[Azeret_Mono] font-bold text-2xl text-[#E8E2D6]">{status.top5_matches}/{status.required_top5_matches ?? 2}</div>
                    <div className="text-[#6B7280] text-xs font-[Barlow]">Top-5 matches</div>
                  </div>
                  <div className="text-center">
                    <div className="font-[Azeret_Mono] font-bold text-2xl text-[#E8E2D6]">{status.days_elapsed}</div>
                    <div className="text-[#6B7280] text-xs font-[Barlow]">Days elapsed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-[Azeret_Mono] font-bold text-2xl" style={{ color: (status.days_remaining ?? 30) <= 2 ? '#EF4444' : '#E8E2D6' }}>
                      {status.days_remaining}
                    </div>
                    <div className="text-[#6B7280] text-xs font-[Barlow]">Days left</div>
                  </div>
                </div>
              )}
            </>
          )}
        </GlassCard>
      )}
    </div>
  );
}

// ─── League Settings ─────────────────────────────────────────────────────────


type SettingsFormState = {
  min_race: number | '';
  challenge_range: number | '';
  cooldown_hours: number | '';
  challenge_expiry_days: number | '';
  challenge_response_hours: number | '';
  match_play_days: number | '';
  challenge_weekly_limit: number | '';
  first_challenge_range: number | '';
};

const RULE_FIELDS: Array<{ key: keyof SettingsFormState; label: string; unit: string }> = [
  { key: 'min_race', label: 'Min race length', unit: 'games' },
  { key: 'challenge_range', label: 'Challenge range', unit: 'spots (normal)' },
  { key: 'first_challenge_range', label: 'First challenge range', unit: 'spots (first ever)' },
  { key: 'challenge_weekly_limit', label: 'Weekly challenge limit', unit: 'challenges per 7 days' },
  { key: 'challenge_response_hours', label: 'Challenge response window', unit: 'hours to accept/decline' },
  { key: 'match_play_days', label: 'Match play window', unit: 'days after acceptance' },
  { key: 'cooldown_hours', label: 'Post-match cooldown', unit: 'hours after a win' },
  { key: 'challenge_expiry_days', label: 'Challenge expiry', unit: 'days until auto-expire' },
];

type SettingsFieldProps = {
  label: string;
  unit: string;
  value: number | '';
  onChange: (value: number | '') => void;
};

function SettingsField({ label, unit, value, onChange }: SettingsFieldProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <div className="font-[Barlow] text-sm text-[#E8E2D6]">{label}</div>
        <div className="text-[#6B7280] text-xs font-[Barlow]">{unit}</div>
      </div>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? '' : Number(raw));
        }}
        className="w-20 px-3 py-1.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Azeret_Mono] text-sm text-center focus:outline-none focus:border-[#C62828]"
      />
    </div>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery<LeagueSettings>({
    queryKey: ['league-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('league_settings').select('*').single();
      return data!;
    },
  });

  const [edits, setEdits] = useState<Partial<SettingsFormState>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!settings) return <div className="text-center py-12 text-[#6B7280] font-[Barlow]">Loading settings…</div>;

  const form: SettingsFormState = {
    min_race: edits.min_race ?? settings.min_race,
    challenge_range: edits.challenge_range ?? settings.challenge_range,
    cooldown_hours: edits.cooldown_hours ?? settings.cooldown_hours,
    challenge_expiry_days: edits.challenge_expiry_days ?? settings.challenge_expiry_days,
    challenge_response_hours: edits.challenge_response_hours ?? settings.challenge_response_hours,
    match_play_days: edits.match_play_days ?? settings.match_play_days,
    challenge_weekly_limit: edits.challenge_weekly_limit ?? settings.challenge_weekly_limit,
    first_challenge_range: edits.first_challenge_range ?? settings.first_challenge_range,
  };

  const set = (key: keyof SettingsFormState, val: number | '') => {
    setEdits((current) => ({ ...current, [key]: val }));
    setSaved(false);
  };

  const hasBlankField = Object.values(form).some((value) => value === '');
  const isDirty = Object.entries(form).some(([key, value]) => (
    value !== settings[key as keyof SettingsFormState]
  ));

  const handleSave = async () => {
    if (!isDirty || hasBlankField) return;
    if (!window.confirm('Save these league rule changes?')) return;
    setSaving(true);
    await supabase.from('league_settings').update(form).eq('id', settings.id);
    setSaving(false);
    setEdits({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    qc.invalidateQueries({ queryKey: ['league-settings'] });
    qc.invalidateQueries({ queryKey: ['admin-league-settings'] });
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <h3 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-1">League Rules</h3>
        {RULE_FIELDS.map((field) => (
          <SettingsField
            key={field.key}
            label={field.label}
            value={form[field.key]}
            onChange={(value) => set(field.key, value)}
            unit={field.unit}
          />
        ))}
      </GlassCard>
      {hasBlankField && (
        <p className="text-[#EF4444] text-xs font-[Barlow] px-1">Fill in every setting before saving.</p>
      )}
      <Button variant="primary" fullWidth loading={saving} disabled={!isDirty || hasBlankField} onClick={handleSave}>
        {saved ? '✓ Saved' : 'Save Settings'}
      </Button>
    </div>
  );
}

// ─── Audit ───────────────────────────────────────────────────────────────────

function AuditTab() {
  const { data: events = [] } = useQuery<AuditEvent[]>({
    queryKey: ['audit-events'],
    queryFn: async () => {
      const { data } = await supabase.from('audit_events').select('*').order('created_at', { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  if (events.length === 0) return <div className="text-center py-12 text-[#6B7280] font-[Barlow]">No audit events yet.</div>;

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <GlassCard key={e.id} className="p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-[Barlow] font-semibold text-sm text-[#E8E2D6]">{e.action}</span>
            <span className="text-[#6B7280] text-xs font-[Barlow]">{formatDistanceToNow(e.created_at)}</span>
          </div>
          {e.target_type && (
            <div className="text-[#9CA3AF] text-xs font-[Barlow]">{e.target_type}: {e.target_id?.slice(0, 8)}…</div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
