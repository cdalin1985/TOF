import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LEAGUE } from '../config/league';

interface LoadingScreenProps {
  visible: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ visible }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0D0D0D]"
      >
        {/* TOC wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center relative"
        >
          {/* Theme-adaptive halo behind text */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              filter: 'blur(48px)',
              background: 'radial-gradient(ellipse at center, var(--toc-theme-glow) 0%, transparent 70%)',
            }}
          />
          <div
            className="font-[Bebas_Neue] text-8xl tracking-widest relative"
            style={{
              color: '#E8E2D6',
              textShadow:
                '0 0 60px var(--toc-theme-glow), 0 0 20px var(--toc-theme-glow-soft), 0 2px 0 rgba(0,0,0,0.5)',
            }}
          >
            {LEAGUE.shortName}
          </div>
          <div className="text-[#9CA3AF] text-sm font-[Barlow] tracking-[0.35em] mt-1 uppercase">
            {LEAGUE.region}
          </div>
        </motion.div>

        {/* EKG heartbeat animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-8"
        >
          <svg width="200" height="30" viewBox="0 0 200 30">
            <polyline
              points="0,15 40,15 55,15 65,3 72,27 79,9 86,21 93,15 110,15 200,15"
              fill="none"
              stroke="var(--toc-theme-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 350,
                strokeDashoffset: 350,
                animation: 'ekg-boot 1.2s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes ekg-boot {
                0% { stroke-dashoffset: 350; opacity: 0.3; }
                30% { opacity: 1; }
                70% { opacity: 1; }
                100% { stroke-dashoffset: 0; opacity: 0.3; }
              }
            `}</style>
          </svg>
        </motion.div>

        {/* 8-ball emoji */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.2, duration: 2, repeat: Infinity, times: [0, 0.2, 0.8, 1] }}
          className="mt-4 text-2xl"
        >
          🎱
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
