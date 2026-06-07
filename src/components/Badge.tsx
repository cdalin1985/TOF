import React from 'react';

type BadgeVariant = 'win' | 'success' | 'loss' | 'pending' | 'gold' | 'default' | 'info';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  win:     'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30',
  success: 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30',
  loss:    'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30',
  pending: 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30',
  gold:    'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30',
  default: 'bg-[#333]/60 text-[#9CA3AF] border border-[#333]',
  info:    'bg-[#3B82F6]/15 text-[#60A5FA] border border-[#3B82F6]/30',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-[Barlow] ${BADGE_STYLES[variant]} ${className}`}
  >
    {children}
  </span>
);
