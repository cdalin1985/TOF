import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ScrollText } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { LEAGUE } from '../config/league';

/**
 * Read-only display of the official Top of the Falls rules.
 * The rules text comes from src/config/league.ts so it stays the single
 * source of truth across the app. Collapsed by default to keep the Home
 * screen tidy.
 */
export const LeagueRulesCard: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <GlassCard className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <ScrollText size={18} className="shrink-0 text-[var(--toc-theme-accent)]" />
        <span className="flex-1 font-[Barlow] font-semibold text-[#E8E2D6] text-sm">
          Official {LEAGUE.name} Rules
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-[#6B7280] transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              <ol className="list-decimal pl-5 space-y-2 text-[#9CA3AF] text-xs font-[Barlow] leading-relaxed">
                {LEAGUE.rulesSummary.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ol>

              <div className="pt-1">
                <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm mb-2">
                  Game rules
                </div>
                <div className="space-y-3">
                  {LEAGUE.gameRules.map((g) => (
                    <div key={g.game}>
                      <div className="font-[Barlow] font-semibold text-[var(--toc-theme-accent-2)] text-xs mb-1">
                        {g.game}
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-[#9CA3AF] text-xs font-[Barlow] leading-relaxed">
                        {g.rules.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};
