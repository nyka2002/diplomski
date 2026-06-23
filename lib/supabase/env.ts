// Reading these in one place lets every Supabase entry point degrade gracefully
// when the project hasn't been configured yet (the app then behaves as a
// logged-out, mock-data site instead of crashing on boot).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
