// Lightweight Supabase Auth wrapper for Google OAuth and Email/Password
// Requires Vite env vars:
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY
// Optional:
// - VITE_GOOGLE_REDIRECT_TO (defaults to current origin + '/login.html')
// - VITE_REQUIRE_AUTH ('true' to gate the app and redirect unauthenticated users)

import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.warn('[auth] Missing Supabase env config. Auth features are disabled.');
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
  const redirectTo = import.meta.env.VITE_GOOGLE_REDIRECT_TO || `${location.origin}/`;
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } },
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


