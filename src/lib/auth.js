// ============================================
// AUTH SERVICE
// All authentication functions in one place
// Used by Login page, Header, anywhere we need auth
// ============================================

import { supabase } from './supabase'

// ===== EMAIL/PASSWORD SIGNUP =====
// Called when user submits the signup form with email + password
export async function signUpWithEmail(email, password, fullName, phone) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Store the full name and phone in user_metadata
        // This is automatically saved to Supabase's auth.users table
        data: {
          full_name: fullName,
          phone: phone || null
        }
      }
    })

    if (error) throw error

    return {
      success: true,
      user: data.user,
      session: data.session,
      // Note: If email confirmation is enabled, user must verify email first
      needsEmailVerification: !data.session
    }
  } catch (error) {
    console.error('Signup error:', error)
    return {
      success: false,
      error: error.message || 'Failed to create account'
    }
  }
}

// ===== EMAIL/PASSWORD LOGIN =====
// Called when user submits the login form
export async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    return {
      success: true,
      user: data.user,
      session: data.session
    }
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: error.message || 'Invalid email or password'
    }
  }
}

// ===== GOOGLE OAUTH =====
// Opens Google login popup, redirects back to our app
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Where to redirect after successful login
        // Must match what you configure in Supabase dashboard
        redirectTo: `${window.location.origin}/dashboard`
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Google login error:', error)
    return {
      success: false,
      error: error.message || 'Google login failed'
    }
  }
}

// ===== FACEBOOK OAUTH =====
export async function signInWithFacebook() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Facebook login error:', error)
    return {
      success: false,
      error: error.message || 'Facebook login failed'
    }
  }
}

// ===== APPLE OAUTH =====
// Note: Apple requires $99/year Apple Developer account to enable
export async function signInWithApple() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Apple login error:', error)
    return {
      success: false,
      error: error.message || 'Apple login failed. Apple Developer account required.'
    }
  }
}

// ===== LOGOUT =====
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false, error: error.message }
  }
}

// ===== PASSWORD RESET =====
// Sends a password reset email to the user
export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Password reset error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send reset email'
    }
  }
}

// ===== UPDATE PASSWORD =====
// Called from the password reset page after user clicks the email link
export async function updatePassword(newPassword) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Update password error:', error)
    return {
      success: false,
      error: error.message || 'Failed to update password'
    }
  }
}

// ===== UPDATE PROFILE =====
// Updates the user_metadata (e.g. phone, country)
export async function updateProfile(dataUpdates) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: dataUpdates
    })
    if (error) throw error
    return { success: true, user: data.user }
  } catch (error) {
    console.error('Update profile error:', error)
    return { success: false, error: error.message || 'Failed to update profile' }
  }
}

// ===== GET CURRENT SESSION =====
// Returns the current active session (or null if logged out)
export async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  } catch (error) {
    console.error('Get session error:', error)
    return null
  }
}
