// ============================================
// SUPABASE CLIENT
// This file connects your React app to Supabase
// ============================================

import { createClient } from '@supabase/supabase-js'

// These values come from your .env file
// VITE_ prefix is required for Vite to expose them to the browser
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Safety check if env vars are missing, show a clear error
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
  )
}

// Create the Supabase client this is what we'll use everywhere in the app
// Think of this as your "connection" to the backend
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Automatically refresh the token before it expires (so users stay logged in)
    autoRefreshToken: true,
    // Persist the session in localStorage so users don't have to login on every page refresh
    persistSession: true,
    // Detect login from URL (needed for OAuth callbacks like Google/Facebook)
    detectSessionInUrl: true
  }
})

// Helper: Get the currently logged-in user (or null if not logged in)
// We'll use this throughout the app to check who's logged in
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  } catch (err) {
    console.error('Error fetching user:', err)
    return null
  }
}

// Helper: Listen for auth state changes (login/logout/signup)
// This lets components update automatically when auth state changes
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // event can be: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY
    callback(event, session)
  })
  // Return the unsubscribe function so components can clean up
  return () => subscription.unsubscribe()
}
