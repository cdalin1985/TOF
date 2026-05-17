import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { formatDate } from '../utils/time';
import { fetchTreasurySnapshot, formatCents, ledgerSignFor } from '../lib/treasury';

export default function TreasuryPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['treasury'],
    queryFn: () => fetchTreasurySnapshot(),
  });

  const summary = data?.summary;
  const entries = data?.entries ?? [];

  return (
    <div className="min-h-screen px-4 pt-4 pb-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-[#9CA3AF] p-2 -ml-2 mb-4"
      >
        <ChevronLeft size={18} /> Back
      </button>

      <h1 className="font-[Bebas_Neue] text-5xl tracking-wide text-[#E8E2D6] mb-1">
        League Treasury
      </h1>
      <p className="text-[#6B7280] text-sm font-[Barlow] mb-5">
        Transparent record of all league funds
      </p>

      {/* Summary cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-3 mb-5"
      >
        <GlassCard className="p-4 text-center">
          <TrendingUp size={18} className="text-[#22C55E] mx-auto mb-1" />
          <div className="font-[Azeret_Mono] font-bold text-base text-[#22C55E]">
            {formatCents(summary?.total_credit_cents ?? 0)}
          </div>
          <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">Total In</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <TrendingDown size={18} className="text-[#EF4444] mx-auto mb-1" />
          <div className="font-[Azeret_Mono] font-bold text-base text-[#EF4444]">
            {formatCents(summary?.total_debit_cents ?? 0)}
          </div>
          <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">Total Out</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <DollarSign
            size={18}
            className={`mx-auto mb-1 ${(summary?.balance_cents ?? 0) >= 0 ? 'text-[#E8E2D6]' : 'text-[#EF4444]'}`}
          />
          <div
            className="font-[Azeret_Mono] font-bold text-base"
            style={{ color: (summary?.balance_cents ?? 0) >= 0 ? '#E8E2D6' : '#EF4444' }}
          >
            {formatCents(Math.abs(summary?.balance_cents ?? 0))}
          </div>
          <div className="text-[#6B7280] text-xs font-[Barlow] mt-1">Balance</div>
        </GlassCard>
      </motion.div>

      {/* Ledger */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard className="p-4">
          <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-4">Ledger</h2>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-8">
              No treasury entries yet.
            </p>
          ) : (
            <div className="space-y-1">
              {entries.map((entry) => {
                const isCredit = entry.entry_type === 'credit';
                const isDebit  = entry.entry_type === 'debit';
                const color    = entry.effect_cents > 0
                  ? '#22C55E'
                  : entry.effect_cents < 0
                    ? '#EF4444'
                    : '#9CA3AF';
                const sign = ledgerSignFor(entry.effect_cents);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0"
                  >
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-[Barlow] text-[#E8E2D6] leading-tight">
                        {entry.description}
                      </div>
                      <div className="text-xs text-[#6B7280] font-[Barlow] mt-0.5">
                        {formatDate(entry.created_at)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="font-[Azeret_Mono] font-bold text-sm"
                        style={{ color }}
                      >
                        {sign}{formatCents(Math.abs(entry.effect_cents))}
                      </div>
                      <div className="mt-1">
                        <Badge variant={isCredit ? 'win' : isDebit ? 'loss' : 'default'}>
                          {entry.entry_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
