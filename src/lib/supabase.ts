import { createClient } from '@supabase/supabase-js';

// TOF project defaults. The anon key is safe to commit — it is already embedded
// in every deployed bundle and gated by row-level security (see PR #3). Env vars
// still win, so a branch database can be targeted per-deployment; the fallback
// keeps preview deploys (where Vercel env vars may not be scoped) from throwing
// at module init and rendering a black screen.
const TOF_SUPABASE_URL = 'https://sqcqmovskpoyutfyslym.supabase.co';
const TOF_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxY3Ftb3Zza3BveXV0ZnlzbHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTAyNTksImV4cCI6MjA5NTc4NjI1OX0.QpySvysSF1vTGu1k-X9OIr9ZwEZAcuEqQpacx3XZdns';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!envUrl || !envKey) {
  console.warn('[TOF] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — using built-in TOF project defaults.');
}

export const SUPABASE_URL = envUrl || TOF_SUPABASE_URL;
const key = envKey || TOF_SUPABASE_ANON_KEY;

// Base for calling edge functions; use this instead of reading
// import.meta.env.VITE_SUPABASE_URL directly so the fallback applies everywhere.
export const functionsUrl = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

export const supabase = createClient(SUPABASE_URL, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
