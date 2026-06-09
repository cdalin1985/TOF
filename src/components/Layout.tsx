import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { AmbientBackground } from './AmbientBackground';
import { BottomNav } from './BottomNav';
import { LoadingScreen } from './LoadingScreen';
import { OfflineBanner } from './OfflineBanner';
import { PWAInstallBanner } from './PWAInstallBanner';
import { AdminThemeSwitcher } from './admin/AdminThemeSwitcher';
import { isTopOfTheFallsDemoMode } from '../demo/topOfTheFallsDemo';
import { useQuery } from '@tanstack/react-query';

// Screens that show bottom nav
const NAV_ROUTES = ['/', '/rankings', '/matches', '/notifications', '/settings', '/challenges'];
const showsNav = (path: string) =>
  NAV_ROUTES.some((r) => (r === '/' ? path === '/' : path.startsWith(r)));

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { session, player, isLoading, setSession, setProfile, setPlayer, setIsLoading, reset } = useAuthStore();
  const { isOffline, setIsOffline } = useUIStore();
  const [appReady, setAppReady] = useState(false);
  const demoMode = isTopOfTheFallsDemoMode();

  // Bootstrap auth state
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('auth timeout')), 8000)
          ),
        ]);
        if (cancelled) return;
        setSession(session);
        if (session) {
          await fetchProfileAndPlayer(session.user.id).catch(() => {});
        }
      } catch {
        // Network error or timeout — unblock the app and let route guards redirect
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setAppReady(true);
        }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfileAndPlayer(session.user.id);
      } else {
        reset();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfileAndPlayer = async (userId: string) => {
    const [profileRes, playerRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('players').select('*').eq('profile_id', userId).single(),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (profileRes.data) setProfile(profileRes.data as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (playerRes.data) setPlayer(playerRes.data as any);
  };

  // Route guards
  useEffect(() => {
    if (isLoading) return;
    const path = location.pathname;
    const publicPaths = ['/login', '/auth/callback'];
    if (publicPaths.includes(path)) return;
    if (demoMode) return;

    if (!session) { navigate('/login', { replace: true }); return; }
    if (!player && path !== '/claim') { navigate('/claim', { replace: true }); return; }
    if (player && path === '/claim') { navigate('/', { replace: true }); return; }
  }, [session, player, isLoading, location.pathname, navigate, demoMode]);

  // Realtime subscriptions
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel('toc-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rankings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['rankings'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => {
        queryClient.invalidateQueries({ queryKey: ['challenges'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, () => {
        queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
        queryClient.invalidateQueries({ queryKey: ['activity-feed-full'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, queryClient]);

  // Offline detection
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [setIsOffline]);

  // Unread notification count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count', player?.id],
    queryFn: async () => {
      if (!player) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', player.id)
        .eq('is_read', false);
      return count ?? 0;
    },
    enabled: !!player,
    refetchInterval: 30000,
  });

  const showNav = showsNav(location.pathname) && ((!!session && !!player) || demoMode);

  return (
    <div className="relative min-h-screen bg-[var(--toc-theme-bg,#0D0D0D)] overflow-hidden">
      <LoadingScreen visible={!appReady} />
      <PWAInstallBanner />
      <AmbientBackground />
      <OfflineBanner show={isOffline} />

      {/* Main content area */}
      <main
        className="relative z-10"
        style={{
          paddingBottom: showNav ? '80px' : 0,
          paddingTop: isOffline ? '36px' : 0,
          minHeight: '100svh',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="min-h-full"
          >
            <AdminThemeSwitcher />
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {showNav && <BottomNav unreadCount={unreadCount} />}
    </div>
  );
};
