import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hover?: boolean;
  onClick?: () => void;
  gold?: boolean; // top-3 gold shimmer
  glow?: boolean; // crimson glow (your own row)
  as?: 'div' | 'button' | 'li';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  style,
  hover = false,
  onClick,
  gold = false,
  glow = false,
  as: Tag = 'div',
}) => {
  const base =
    'glass-card ' +
    (gold ? 'gold-shimmer ' : '') +
    (hover ? 'glass-card-hover cursor-pointer ' : '') +
    (glow ? 'border-[var(--toc-theme-accent)]/40 shadow-[0_0_20px_var(--toc-theme-glow-soft)] ' : '') +
    className;

  const resolvedStyle = { ...(glow ? { borderColor: 'var(--toc-theme-border-strong)' } : {}), ...style };
  const Component = Tag;

  if (onClick) {
    return (
      <motion.div
        className={base}
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        style={resolvedStyle}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <Component className={base} style={resolvedStyle}>
      {children}
    </Component>
  );
};
