import React from 'react';
import { motion } from 'framer-motion';

interface QueryErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

// Shown when a data fetch fails, so a network error reads as a problem the user
// can retry — not as a misleading empty list.
export const QueryError: React.FC<QueryErrorProps> = ({
  title = "Couldn't Load",
  message = 'Something went wrong fetching this. Check your connection and try again.',
  onRetry,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <span className="text-5xl mb-4">⚠️</span>
    <h3 className="font-[Bebas_Neue] text-2xl text-[#E8E2D6] mb-2">{title}</h3>
    <p className="text-[#9CA3AF] text-sm max-w-[240px] leading-relaxed">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn-crimson px-6 py-3 text-sm mt-6">
        Try Again
      </button>
    )}
  </motion.div>
);
