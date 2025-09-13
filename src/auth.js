// Lightweight Supabase Auth wrapper for Google OAuth and Email/Password
// Requires Vite env vars:
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY
// Optional:
// - VITE_GOOGLE_REDIRECT_TO (defaults to current origin + '/login.html')
// - VITE_REQUIRE_AUTH ('true' to gate the app and redirect unauthenticated users)

import { createClient } from '@supabase/supabase-js';

function readEnv(name) {
  try {
    // Prefer Vite-style env vars
    const viteVal = import.meta?.env?.[name];
    if (viteVal) return viteVal;
  } catch (_) {}
  try {
    // Fallback to NEXT_PUBLIC_* if injected at build time
    const nextVal = import.meta?.env?.[`NEXT_PUBLIC_${name.replace(/^VITE_/, '')}`];
    if (nextVal) return nextVal;
  } catch (_) {}
  try {
    // Optional: allow window-scoped overrides (e.g., window.__ENV)
    const win = typeof window !== 'undefined' ? window : undefined;
    const winEnv = win?.__ENV ?? win?.ENV;
    const key = name
      .replace(/^VITE_/, '')
      .replace(/^NEXT_PUBLIC_/, '')
      .replace(/^SUPABASE_/, '');
    const fromWindow = winEnv?.[`VITE_${key}`] || winEnv?.[`NEXT_PUBLIC_${key}`] || winEnv?.[key];
    if (fromWindow) return fromWindow;
  } catch (_) {}
  return undefined;
}

let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  let url = readEnv('VITE_SUPABASE_URL');
  let anonKey = readEnv('VITE_SUPABASE_ANON_KEY');

  // Also accept NEXT_PUBLIC_* if present
  url = url || readEnv('NEXT_PUBLIC_SUPABASE_URL');
  anonKey = anonKey || readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  // DEV-only safety fallback using provided anon key (never use service_role in browser)
  if ((!url || !anonKey) && (import.meta?.env?.DEV ?? false)) {
    url = url || 'https://bwkqyjfizhvrrylqjxng.supabase.co';
    anonKey = anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3F5amZpemh2cnJ5bHFqeG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzQ1ODQsImV4cCI6MjA3Mjc1MDU4NH0.yHHslRbEfFtVScZGf5stehBsZvrMbD8223Gd0apNxBU';
  }

  if (!url || !anonKey) {
    console.warn('[auth] Missing Supabase env config. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_* fallbacks).');
    return null;
  }
  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabaseClient;
}

export function isAuthRequired() {
  const e2e = String(import.meta.env.VITE_E2E ?? '').toLowerCase();
  if (e2e === 'true' || e2e === '1') return false;
  const raw = String(import.meta.env.VITE_REQUIRE_AUTH ?? '').toLowerCase();
  // Default to requiring auth when not explicitly disabled
  if (!raw) return true;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export async function getSession() {
  const sb = getSupabase();
  if (!sb) return { data: { session: null }, error: null };
  return await sb.auth.getSession();
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return { error: null };
  return await sb.auth.signOut();
}

export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  // Use production URL for OAuth redirect
  const redirectTo = import.meta.env.VITE_GOOGLE_REDIRECT_TO || 'https://agets.vercel.app/login.html';
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { 
      redirectTo, 
      queryParams: { 
        prompt: 'select_account',
        access_type: 'offline',
        // Enable refresh token for better session management
      } 
    },
  });
  return { data, error };
}

export async function signUpWithEmail({ email, password, displayName }) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName || '' } } });
  if (!error) await upsertProfileFromUser(data?.user);
  return { data, error };
}

export async function signInWithEmail({ email, password }) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) await upsertProfileFromUser(data?.user);
  return { data, error };
}

export function onAuthStateChange(callback) {
  const sb = getSupabase();
  if (!sb) return { data: { subscription: null } };
  return sb.auth.onAuthStateChange(callback);
}

async function upsertProfileFromUser(user) {
  try {
    if (!user) return;
    const sb = getSupabase();
    if (!sb) return;
    // Ensure a public profiles table exists in Supabase with RLS allowing owner upserts.
    const email = user.email || '';
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const avatarUrl = user.user_metadata?.avatar_url || '';
    await sb.from('profiles').upsert(
      { id: user.id, email, full_name: fullName, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  } catch (_) {
    // Non-fatal; profile table may not exist yet during local dev
  }
}

export function getUserDisplay(user) {
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  return name || (user?.email || '');
}


