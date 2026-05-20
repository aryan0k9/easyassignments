import { supabase } from './supabase'

// Fetch the profile row (which holds the unique student_id from DB)
// Creates one if it doesn't exist yet (handles users created before the trigger)
export async function getOrCreateProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Try to fetch existing profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('student_id, full_name, phone, country')
    .eq('id', user.id)
    .single()

  if (profile) return profile

  // Profile doesn't exist yet create it (for users who signed up before the trigger)
  if (error?.code === 'PGRST116') {
    const { data: created } = await supabase
      .from('profiles')
      .insert({ id: user.id, full_name: user.user_metadata?.full_name, phone: user.user_metadata?.phone })
      .select('student_id, full_name, phone, country')
      .single()
    return created || null
  }

  return null
}

export async function updateProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not logged in' }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
