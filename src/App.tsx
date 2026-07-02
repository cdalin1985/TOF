import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded pages for code splitting
const LoginPage        = React.lazy(() => import('./pages/LoginPage'));
const ClaimPage        = React.lazy(() => import('./pages/ClaimPage'));
const HomePage         = React.lazy(() => import('./pages/HomePage'));
const RankingsPage     = React.lazy(() => import('./pages/RankingsPage'));
const PlayerPage       = React.lazy(() => import('./pages/PlayerPage'));
const ChallengePage    = React.lazy(() => import('./pages/ChallengePage'));
const ChallengesPage   = React.lazy(() => import('./pages/ChallengesPage'));
const MatchPage        = React.lazy(() => import('./pages/MatchPage'));
const MatchesPage      = React.lazy(() => import('./pages/MatchesPage'));
const NotificationsPage= React.lazy(() => import('./pages/NotificationsPage'));
const SettingsPage     = React.lazy(() => import('./pages/SettingsPage'));
const AdminPage        = React.lazy(() => import('./pages/AdminPage'));
const AdminStatsPage   = React.lazy(() => import('./pages/AdminStatsPage'));
const AuthCallbackPage = React.lazy(() => import('./pages/AuthCallbackPage'));
const TreasuryPage     = React.lazy(() => import('./pages/TreasuryPage'));
const ActivityPage     = React.lazy(() => import('./pages/ActivityPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

const Suspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <React.Suspense fallback={<div className="min-h-screen bg-[#0D0D0D]" />}>
    {children}
  </React.Suspense>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              {/* Public */}
              <Route path="/login"         element={<Suspense><LoginPage /></Suspense>} />
              <Route path="/auth/callback" element={<Suspense><AuthCallbackPage /></Suspense>} />
              {/* Authenticated — unclaimed */}
              <Route path="/claim"         element={<Suspense><ClaimPage /></Suspense>} />
              {/* Authenticated — claimed */}
              <Route path="/"              element={<Suspense><HomePage /></Suspense>} />
              <Route path="/rankings"      element={<Suspense><RankingsPage /></Suspense>} />
              <Route path="/player/:id"    element={<Suspense><PlayerPage /></Suspense>} />
              <Route path="/challenge/:id" element={<Suspense><ChallengePage /></Suspense>} />
              <Route path="/challenges"    element={<Suspense><ChallengesPage /></Suspense>} />
              <Route path="/matches"       element={<Suspense><MatchesPage /></Suspense>} />
              <Route path="/match/:id"     element={<Suspense><MatchPage /></Suspense>} />
              <Route path="/notifications" element={<Suspense><NotificationsPage /></Suspense>} />
              <Route path="/settings"      element={<Suspense><SettingsPage /></Suspense>} />
              <Route path="/admin"         element={<Suspense><AdminPage /></Suspense>} />
              <Route path="/admin/stats"   element={<Suspense><AdminStatsPage /></Suspense>} />
              <Route path="/treasury"      element={<Suspense><TreasuryPage /></Suspense>} />
              <Route path="/activity"      element={<Suspense><ActivityPage /></Suspense>} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
