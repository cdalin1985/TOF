import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, Swords, Minus, Plus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRankings } from '../hooks/useRankings';
import { supabase } from '../lib/supabase';
import { PoolBall } from '../components/PoolBall';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { InactivePlayerBanner } from '../components/InactivePlayerBanner';

type Discipline = '8 Ball' | '9 Ball' | '10 Ball';

const DISCIPLINES: { value: Discipline; emoji: string; desc: string }[] = [
  { value: '8 Ball', emoji: '🎱', desc: 'Classic — BCA rules, pocket the 8 last' },
  { value: '9 Ball', emoji: '🔵', desc: 'Fast-paced — modified BCA, call the 9' },
  { value: '10 Ball', emoji: '🟡', desc: 'Strategic — call shot, 10 in the middle' },
];

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const { data: rankings = [] } = useRankings();

  const target   = rankings.find((r) => r.player.id === id);
  const myRanking = rankings.find((r) => r.player.id === player?.id);
  const [step, setStep]             = useState(1);
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [race, setRace]             = useState(7);
  const [raceInput, setRaceInput]   = useState('7');
  const [raceError, setRaceError]   = useState('');
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState('');

  if (!target) return null;

  const handleRaceChange = (val: string) => {
    setRaceInput(val);
    const n = parseInt(val, 10);
    if (!val || isNaN(n)) {
      setRaceError('Enter a race length.');
    } else if (n < 6) {
      setRaceError('Minimum race length is 6.');
    } else {
      setRaceError('');
      setRace(n);
    }
  };

  const handleSend = async () => {
    if (!discipline || raceError || race < 6) return;
    setSending(true);
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired — please log in again.'); setSending(false); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ challenged_player_id: id, discipline, race_length: race }),
      });
      const json = await res.json() as { challenge_id?: string; error?: string };
      if (json.error) { setError(json.error); return; }
      setSent(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-7xl mb-6"
          >
            ⚔️
          </motion.div>
          <h1 className="font-[Bebas_Neue] text-5xl text-[#E8E2D6] mb-2">Challenge Sent!</h1>
          <p className="text-[#9CA3AF] font-[Barlow] mb-8">
            {target.player.full_name} has 7 days to respond.
          </p>
          <PoolBall position={target.ranking.position} size={80} className="mx-auto mb-8" />
          <Button variant="secondary" onClick={() => navigate('/challenges')}>
            View My Challenges
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))} className="p-2">
          <ChevronLeft size={24} className="text-[#9CA3AF]" />
        </button>
        <div>
          <div className="text-[#6B7280] text-xs font-[Barlow]">Step {step} of 3</div>
          <h1 className="font-[Bebas_Neue] text-3xl text-[#E8E2D6]">
            {step === 1 ? 'Choose Discipline' : step === 2 ? 'Set Race Length' : 'Confirm & Send'}
          </h1>
        </div>
      </div>

      {/* Inactive player warning */}
      {target && !target.player.is_active && (
        <InactivePlayerBanner playerName={target.player.full_name} />
      )}

      {/* Opponent preview */}
      <GlassCard className="p-4 flex items-center gap-3 mb-6">
        <PoolBall position={target.ranking.position} size={44} />
        <div>
          <div className="font-[Barlow] font-semibold text-[#E8E2D6]">{target.player.full_name}</div>
          <div className="text-[#9CA3AF] text-xs font-[Azeret_Mono]">Rank #{target.ranking.position}</div>
        </div>
        <div className="ml-auto text-2xl font-[Bebas_Neue] text-[#6B7280]">VS</div>
        {myRanking && <PoolBall position={myRanking.ranking.position} size={44} />}
      </GlassCard>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-6 bg-[#C62828]' : s < step ? 'w-3 bg-[#C62828]/50' : 'w-3 bg-[#333]'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            {DISCIPLINES.map((d) => (
              <GlassCard
                key={d.value}
                hover
                onClick={() => setDiscipline(d.value)}
                className="p-5 flex items-center gap-4"
                glow={discipline === d.value}
              >
                <span className="text-4xl">{d.emoji}</span>
                <div className="flex-1">
                  <div className="font-[Bebas_Neue] text-2xl text-[#E8E2D6]">{d.value}</div>
                  <div className="text-[#9CA3AF] text-sm font-[Barlow]">{d.desc}</div>
                </div>
                {discipline === d.value && <CheckCircle size={20} className="text-[#C62828] shrink-0" />}
              </GlassCard>
            ))}
            <div className="pt-4">
              <Button variant="primary" fullWidth size="lg" disabled={!discipline} onClick={() => setStep(2)}>
                Next <ChevronRight size={18} />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <GlassCard className="p-6 text-center">
              <div className="text-[#9CA3AF] font-[Barlow] text-sm mb-4">Race Length</div>
              <div className="flex items-center justify-center gap-5">
                <button
                  onClick={() => { const n = Math.max(6, race - 1); setRace(n); setRaceInput(String(n)); setRaceError(''); }}
                  className="w-12 h-12 rounded-full bg-[#252525] border border-[#333] flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Minus size={20} className="text-[#9CA3AF]" />
                </button>
                <div className="w-28 text-center">
                  <input
                    type="number"
                    value={raceInput}
                    onChange={(e) => handleRaceChange(e.target.value)}
                    min={6}
                    className="w-full text-center bg-transparent font-[Azeret_Mono] font-bold text-6xl text-[#E8E2D6] focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => { const n = race + 1; setRace(n); setRaceInput(String(n)); setRaceError(''); }}
                  className="w-12 h-12 rounded-full bg-[#252525] border border-[#333] flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Plus size={20} className="text-[#9CA3AF]" />
                </button>
              </div>
              <div className={`text-sm mt-2 font-[Barlow] ${raceError ? 'text-[#EF4444]' : 'text-[#C62828]'}`}>
                {raceError || `First to ${race} wins`}
              </div>
              <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">Minimum race to 6 · No maximum</div>
            </GlassCard>

            <Button variant="primary" fullWidth size="lg" disabled={!!raceError || race < 6} onClick={() => setStep(3)}>
              Next <ChevronRight size={18} />
            </Button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <GlassCard className="p-5 space-y-4">
              <h3 className="font-[Bebas_Neue] text-xl text-[#E8E2D6]">Challenge Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Opponent',   value: target.player.full_name },
                  { label: 'Their Rank', value: `#${target.ranking.position}` },
                  { label: 'Discipline', value: discipline ?? '' },
                  { label: 'Race',       value: `First to ${race}` },
                  { label: 'Expires',    value: '7 days' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[#9CA3AF] text-sm font-[Barlow]">{row.label}</span>
                    <span className="text-[#E8E2D6] font-[Azeret_Mono] font-semibold text-sm">{row.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Match fee reminder */}
            <GlassCard className="p-4">
              <div className="text-[#F59E0B] text-sm font-[Barlow] leading-relaxed">
                💰 <strong>Match Fee: $5 per player.</strong> Use the envelope at the venue or pay digitally — you'll select your method when submitting the result.
              </div>
            </GlassCard>

            {error && (
              <div className="text-[#EF4444] text-sm font-[Barlow] text-center p-3 bg-[#EF4444]/10 rounded-lg border border-[#EF4444]/20">
                {error}
              </div>
            )}

            <Button
              variant="primary"
              fullWidth
              size="lg"
              loading={sending}
              disabled={!target?.player.is_active}
              style={{ opacity: target?.player.is_active ? 1 : 0.4, cursor: target?.player.is_active ? 'pointer' : 'not-allowed' }}
              onClick={handleSend}
            >
              <Swords size={18} /> Send Challenge ⚔️
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
