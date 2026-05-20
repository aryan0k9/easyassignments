// ============================================
// AUTH CONTEXT
// This makes the logged-in user available everywhere in your app
// without having to pass props down through every component
// ============================================

import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, onAuthChange } from '../lib/supabase'
import { signOut as authSignOut } from '../lib/auth'
import { createOrder } from '../lib/orders'
import { loadPendingFilesFromIDB, clearPendingFilesIDB, uploadOrderFiles } from '../lib/uploads'

// Allowed values mirror the QuoteForm selects exactly
const ALLOWED_ORDER_TYPES = new Set([
  'Assignment', 'Essay', 'Dissertation', 'Coursework', 'Case Study',
  'Programming', 'Research Paper', 'Proofreading & Editing',
  'Homework Help', 'Business Writing', 'Lab Report', 'Online Test'
])
const ALLOWED_LEVELS = new Set(['High School', 'Undergraduate', 'Masters', 'PhD'])
const ALLOWED_FORMATTING = new Set([
  'Not Required', 'APA 7th Edition', 'MLA 9th Edition', 'Chicago 17th Edition',
  'Harvard', 'Vancouver', 'IEEE', 'Turabian', 'AMA', 'Oxford', 'OSCOLA', 'ASA'
])

// Validate and sanitize pendingOrder from sessionStorage before it reaches the DB.
// Returns a clean object or null if the data is invalid/tampered.
function sanitizePendingOrder(raw) {
  try {
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null

    // subject required, plain text, max 200 chars
    const subject = typeof data.subject === 'string' ? data.subject.trim().slice(0, 200) : ''
    if (!subject) return null

    // type must be one of the known service types
    if (!ALLOWED_ORDER_TYPES.has(data.type)) return null
    const type = data.type

    // academicLevel must be one of the known levels
    const academicLevel = ALLOWED_LEVELS.has(data.academicLevel) ? data.academicLevel : 'Undergraduate'

    // wordCount integer clamped to 275–27500 (1–100 pages)
    const wordCount = Math.min(27500, Math.max(275, parseInt(data.wordCount) || 275))

    // pages integer clamped to 1–100
    const pages = Math.min(100, Math.max(1, parseInt(data.pages) || 1))

    // deadline must be a valid future datetime
    const deadlineDate = new Date(data.deadline)
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) return null
    const deadline = deadlineDate.toISOString()

    // description optional, strip HTML tags, max 5000 chars
    const description = typeof data.description === 'string'
      ? data.description.replace(/<[^>]*>/g, '').trim().slice(0, 5000)
      : ''

    // formattingStyle must be one of the known styles
    const formattingStyle = ALLOWED_FORMATTING.has(data.formattingStyle)
      ? data.formattingStyle
      : 'Not Required'

    // title always re-derive from validated fields, never trust user-supplied value
    const title = `${subject} ${type}`

    return { title, subject, type, wordCount, pages, academicLevel, description, deadline, formattingStyle }
  } catch {
    return null
  }
}

// Create the context (think of this as a "global state" for auth)
const AuthContext = createContext({})

// AuthProvider wraps your entire app and provides auth state to all child components
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // STEP 1: Check if user is already logged in (e.g., from previous session)
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // STEP 2: Listen for auth state changes (login, logout, token refresh)
    // This automatically updates the UI when user logs in/out
    const unsubscribe = onAuthChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      // When any sign-in happens (email confirmation click, password login, OAuth),
      // check if there's a pending order from the quote form and create it now.
      if (event === 'SIGNED_IN') {
        console.log('[AuthContext] SIGNED_IN fired for user:', session?.user?.id)
        const raw = sessionStorage.getItem('pendingOrder')
        console.log('[AuthContext] pendingOrder in sessionStorage:', raw ? 'YES' : 'NO')
        // If a previous attempt failed, surface that error to the user now
        // (it would have happened on a different page so user hasn't seen it).
        const previousError = sessionStorage.getItem('pendingOrderError')
        if (previousError) {
          sessionStorage.removeItem('pendingOrderError')
          alert(`Previous order attempt failed:\n\n${previousError}`)
        }
        if (raw) {
          sessionStorage.removeItem('pendingOrder') // remove first to prevent duplicate attempts
          try {
            // Cross-account guard: pendingOrder is tagged with the email
            // the form was submitted with. If a different user signs in
            // on the same browser, drop the order silently never
            // create it under the wrong account.
            try {
              const parsed = JSON.parse(raw)
              const intended = String(parsed?.intendedEmail || '').toLowerCase()
              const actual   = String(session?.user?.email || '').toLowerCase()
              if (intended && actual && intended !== actual) {
                console.warn('[AuthContext] pendingOrder dropped intendedEmail does not match signed-in user', { intended, actual })
                return
              }
            } catch (_) { /* fall through to sanitize, which will reject malformed JSON */ }

            const orderData = sanitizePendingOrder(raw)
            console.log('[AuthContext] sanitize result:', orderData ? 'OK' : 'REJECTED invalid payload', orderData)
            if (!orderData) {
              const msg = `pendingOrder rejected by sanitizer. Raw value: ${raw}`
              console.error('[AuthContext]', msg)
              sessionStorage.setItem('pendingOrderError', msg)
              alert(`Order rejected by validation:\n\n${raw}`)
              return
            }
            const result = await createOrder(orderData)
            console.log('[AuthContext] createOrder result:', result)
            if (!result.success) {
              const msg = `Order creation failed: ${result.error}`
              console.error('[AuthContext] ❌', msg)
              sessionStorage.setItem('pendingOrderError', msg)
              alert(msg)
              return
            }
            console.log('[AuthContext] ✅ Order created successfully:', result.order?.order_number)
            // Upload any files the user attached on the homepage form (stored in IDB)
            if (result.order?.id) {
              const pendingFiles = await loadPendingFilesFromIDB()
              if (pendingFiles.length > 0) {
                const uploadRes = await uploadOrderFiles(pendingFiles, result.order.id, 'instruction')
                if (!uploadRes.success) {
                  console.error('File upload failed during auto-create:', uploadRes.errors)
                }
                await clearPendingFilesIDB()
              }
            }
          } catch (err) {
            const msg = `Exception while creating pending order: ${err?.message || err}`
            console.error('[AuthContext]', msg, err)
            sessionStorage.setItem('pendingOrderError', msg)
            alert(msg)
          }
        }
      }
    })

    // Cleanup: unsubscribe when component unmounts
    return () => unsubscribe()
  }, [])

  // Logout function easy to call from anywhere
  const logout = async () => {
    // Always clear local state force logout even if the server call fails
    await authSignOut().catch(err => console.error('Logout error:', err))
    setUser(null)
    setSession(null)
    return { success: true }
  }

  // Helper: Get user's display name (full_name or email)
  const getUserName = () => {
    if (!user) return null
    return user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  }

  // Helper: Get user's avatar URL (from OAuth or initials fallback)
  const getUserAvatar = () => {
    if (!user) return null
    return user.user_metadata?.avatar_url || user.user_metadata?.picture || null
  }

  // Helper: Check if user is logged in
  const isAuthenticated = !!user

  // The value provided to all child components
  const value = {
    user,
    session,
    loading,
    isAuthenticated,
    logout,
    getUserName,
    getUserAvatar
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook: makes it easy to use auth in any component
// Usage: const { user, isAuthenticated, logout } = useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
