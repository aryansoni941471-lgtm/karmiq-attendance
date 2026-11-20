// ============================================================
// KARMIQ — Supabase Client Initialization
// Anon/publishable key is SAFE for frontend (public key)
// ============================================================

const KARMIQ_SUPABASE_URL  = 'https://jzrssadsghszhjkvlrwg.supabase.co';
const KARMIQ_SUPABASE_ANON = 'sb_publishable_WWsZ9XMaMEIj9CMks173sA_rcXPr0lo';

let _db = null;

/**
 * Returns the initialized Supabase client.
 * Returns null if library hasn't loaded yet.
 */
function getDB() {
  if (!_db && typeof window !== 'undefined' && window.supabase?.createClient) {
    _db = window.supabase.createClient(KARMIQ_SUPABASE_URL, KARMIQ_SUPABASE_ANON);
    console.log('✅ Karmiq: Supabase connected →', KARMIQ_SUPABASE_URL);
  }
  return _db;
}
