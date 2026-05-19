import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { House, Medal, Trophy, Bell, UserCircle } from '@phosphor-icons/react';
import { useAuthStore } from '../stores/authStore';

// Custom crossed pool cues — unique to this app
const PoolCueCrossIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
    {/* Cue 1: top-right to bottom-left */}
    <line x1="19" y1="5" x2="5" y2="19" strokeWidth="2" />
    {/* Cue 2: top-left to bottom-right */}
    <line x1="5" y1="5" x2="19" y2="19" strokeWidth="2" />
    {/* Tips — wide end of each cue */}
    <circle cx="5" cy="19" r="2" fill="currentColor" stroke="none" />
    <circle cx="19" cy="19" r="2" fill="currentColor" stroke="none" />
    {/* Ferrules — narrow tip end */}
    <circle cx="19" cy="5" r="1" fill="currentColor" stroke="none" opacity="0.55" />
    <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" opacity="0.55" />
  </svg>
);

type PhosphorWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

interface NavItem {
  label: string;
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.FC<any>;
  center?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',      path: '/',             Icon: House },
  { label: 'Rankings',  path: '/rankings',      Icon: Medal },
  { label: 'Challenge', path: '/rankings',      Icon: PoolCueCrossIcon, center: true },
  { label: 'Matches',   path: '/matches',       Icon: Trophy },
  { label: 'Alerts',    path: '/notifications', Icon: Bell },
  { label: 'Profile',   path: '/settings',      Icon: UserCircle },
];

export const BottomNav: React.FC<{ unreadCount: number }> = ({ unreadCount }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { player } = useAuthStore();

  const isActive = (path: string, center?: boolean) => {
    if (center) return false;
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around px-2"
      style={{
        background: 'rgba(10,8,8,0.94)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingTop: '8px',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path, item.center);
        const { Icon } = item;
        const weight: PhosphorWeight = active ? 'fill' : 'regular';

        if (item.center) {
          return (
            <motion.button
              key={item.label}
              onClick={() => navigate(player ? '/rankings?challenge=1' : '/login')}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center -mt-5 relative"
              aria-label="Challenge"
            >
              <div className="relative">
                {/* Expanding rings — double phase */}
                <div
                  className="absolute inset-0 rounded-full border border-[#C62828]/50"
                  style={{ animation: 'ring-pulse 2s ease-out infinite' }}
                />
                <div
                  className="absolute inset-0 rounded-full border border-[#C62828]/30"
                  style={{ animation: 'ring-pulse 2s ease-out infinite', animationDelay: '1s' }}
                />
                {/* Button */}
                <div
                  className="w-[58px] h-[58px] rounded-full flex items-center justify-center relative z-10"
                  style={{
                    background: 'linear-gradient(145deg, #EF5350 0%, #C62828 50%, #7F0000 100%)',
                    boxShadow: '0 0 0 3px rgba(10,8,8,0.94), 0 6px 28px rgba(198,40,40,0.65), inset 0 1px 0 rgba(255,255,255,0.18)',
                  }}
                >
                  <Icon size={22} />
                </div>
              </div>
              <span className="text-[10px] text-[#666] mt-1.5 font-[Bebas_Neue] tracking-widest uppercase">
                {item.label}
              </span>
            </motion.button>
          );
        }

        return (
          <motion.button
            key={item.label}
            onClick={() => navigate(item.path)}
            whileTap={{ scale: 0.88 }}
            className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[44px] relative"
            aria-label={item.label}
          >
            {/* Active background pill */}
            {active && (
              <motion.div
                layoutId="nav-active-bg"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'rgba(198,40,40,0.1)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}

            <div className="relative">
              <motion.div
                animate={active ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Icon
                  size={22}
                  weight={weight}
                  style={{ color: active ? '#EF5350' : '#555' }}
                />
              </motion.div>

              {/* Notification badge */}
              {item.label === 'Alerts' && unreadCount > 0 && (
                <AnimatePresence>
                  <motion.span
                    key={unreadCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute -top-1.5 -right-2 bg-[#C62828] text-white text-[8px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 font-[Azeret_Mono]"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                </AnimatePresence>
              )}
            </div>

            <span
              className="font-[Bebas_Neue] tracking-widest uppercase leading-none"
              style={{ fontSize: '10px', color: active ? '#EF5350' : '#555' }}
            >
              {item.label}
            </span>

            {/* Active dot */}
            {active && (
              <motion.div
                layoutId="nav-dot"
                className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#C62828]"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
          </motion.button>
        );
      })}
    </nav>
  );
};
