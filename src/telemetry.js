import { getSupabase } from './auth.js';

export async function logUserActivity(userId, action) {
  try {
    const sb = getSupabase();
    if (!sb || !userId || !action) return;
    await sb.from('user_logs').insert([{ user_id: userId, action, timestamp: new Date().toISOString() }]);
  } catch {}
}

export async function saveUserData(userId, data) {
  try {
    const sb = getSupabase();
    if (!sb || !userId) return;
    await sb.from('user_data').insert([{ user_id: userId, data, timestamp: new Date().toISOString() }]);
  } catch {}
}


