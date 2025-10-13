import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { 
    persistSession: true, 
    autoRefreshToken: true 
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting for performance
    }
  }
});

// Helper function for anonymous authentication
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Anonymous auth failed:', error);
    throw error;
  }
  return data;
}

// Helper function to get current user
export function getCurrentUser() {
  return supabase.auth.getUser();
}

// Helper function to check if user is authenticated
export function isAuthenticated() {
  return supabase.auth.getSession().then(({ data }) => !!data.session);
}
