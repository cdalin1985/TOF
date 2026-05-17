import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { GlassCard } from '../components/GlassCard';
import type { ActivityFeedItem } from '../types/database';
import { formatDistanceToNow } from '../utils/time';

type Filter = 'all' | 'match' | 'challenge' | 'ranking' | 'treasury' | 'admin';

const EVENT_ICON: Record<string, string> = {
  challenge_issued:           '⚔️',
  challenge_accepted:         '✅',
  challenge_cancelled:        '🚫',
  challenge_forfeited:        '⚖️',
  challenge_forfeit_reversed: '↩️',
  match_confirmed:            '🏆',
  match_fee_recorded:         '💵',
  dispute_resolved:           '⚖️',
  rank_change:                '📈',
  rank1_penalty:              '📉',
  treasury_entry_credit:      '💰',
  treasury_entry_debit:       '🧾',
  treasury_entry_corrected:   '🛠',
  treasury_entry_reversed:    '↩️',
  player_added:               '➕',
  player_activated:           '🟢',
  player_deactivated:         '⏸️',
  settings_changed:           '⚙️',
};

const FILTER_EVENTS: Record<Filter, string[] | null> = {
  all:       null,
  match:     ['match_confirmed', 'match_fee_recorded', 'dispute_resolved'],
  challenge: [
    'challenge_issued', 'challenge_accepted', 'challenge_cancelled',
    'challenge_forfeited', 'challenge_forfeit_reversed',
  ],
  ranking:   ['rank_change', 'rank1_penalty'],
  treasury:  [
    'treasury_entry_credit', 'treasury_entry_debit',
    'treasury_entry_corrected', 'treasury_entry_reversed',
    'match_fee_recorded',
  ],
  admin:     [
    'player_added', 'player_activated', 'player_deactivated',
    'settings_changed', 'dispute_resolved', 'challenge_forfeit_reversed',
  ],
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'match',     label: 'Matches' },
  { key: 'challenge', label: 'Challenges' },
  { key: 'ranking',   label: 'Rankings' },
  { key: 'treasury',  label: 'Treasury' },
  { key: 'admin',     label: 'Admin' },
];

export default function ActivityPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit]   = useState(40);

  const { data: feed = [], isLoading } = useQuery<ActivityFeedItem[]>({
    queryKey: ['activity-feed-full', filter, limit],
    queryFn: async () => {
      let query = supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      const events = FILTER_EVENTS[filter];
      if (events) query = query.in('event_type', events);
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen px-4 pt-4 pb-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-[#9CA3AF] p-2 -ml-2 mb-4"
      >
        <ChevronLeft size={18} /> Back
      </button>

      <h1 className="font-[Bebas_Neue] text-5xl tracking-wide text-[#E8E2D6] mb-1">
        League Activity
      </h1>
      <p className="text-[#6B7280] text-sm font-[Barlow] mb-4">
        Live journal of every league event
      </p>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-[#1A1A1A] rounded-xl p-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setLimit(40); }}
            className={[
              'shrink-0 px-3 py-2 rounded-lg text-xs font-[Barlow] font-medium transition-all duration-200',
              filter === f.key ? 'bg-[#C62828] text-white' : 'text-[#9CA3AF]',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <GlassCard className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <p className="text-[#6B7280] text-sm font-[Barlow] text-center py-10">
            No activity yet.
          </p>
        ) : (
          <>
            <div className="space-y-0">
              {feed.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3) }}
                  className="flex gap-3 items-start py-3 border-b border-white/5 last:border-0"
                >
                  <div className="text-xl shrink-0 mt-0.5">
                    {EVENT_ICON[item.event_type] ?? '🎱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-[Barlow] text-[#E8E2D6] leading-snug">
                      {item.headline}
                    </div>
                    {item.detail && (
                      <div className="text-xs text-[#9CA3AF] font-[Barlow] mt-0.5">
                        {item.detail}
                      </div>
                    )}
                    <div className="text-[#6B7280] text-xs font-[Barlow] mt-0.5">
                      {formatDistanceToNow(item.created_at)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {feed.length >= limit && (
              <button
                onClick={() => setLimit((l) => l + 40)}
                className="w-full text-center text-[#C62828] text-sm font-[Barlow] font-medium py-3 mt-2 border border-[#C62828]/30 rounded-xl active:bg-[#C62828]/10 transition-colors"
              >
                Load more
              </button>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}
