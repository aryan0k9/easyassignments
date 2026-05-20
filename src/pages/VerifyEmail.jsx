// ============================================
// VerifyEmail
// Lands here from the Brevo verification link
// (/verify-email?token=xxx). Calls the verify-email
// edge function, then redirects to the wallet.
// ============================================

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ phase: 'verifying', error: '', alreadyUsed: false })

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setState({ phase: 'error', error: 'Missing verification token in the URL.', alreadyUsed: false })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ token }),
          }
        )
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || json.error) {
          setState({ phase: 'error', error: json.error || `HTTP ${res.status}`, alreadyUsed: false })
          return
        }
        setState({ phase: 'success', error: '', alreadyUsed: !!json.alreadyUsed })
      } catch (err) {
        if (cancelled) return
        setState({ phase: 'error', error: err.message || 'Network error', alreadyUsed: false })
      }
    })()
    return () => { cancelled = true }
  }, [params])

  // Auto-redirect after success
  useEffect(() => {
    if (state.phase !== 'success') return
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      navigate(session ? '/dashboard/wallet' : '/login', { replace: true })
    }, 2200)
    return () => clearTimeout(t)
  }, [state.phase, navigate])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)', padding: 20
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '40px 36px',
        maxWidth: 460, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.08)'
      }}>
        {state.phase === 'verifying' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
              border: '4px solid #e2e8f0', borderTopColor: '#16a34a',
              animation: 'spin 0.9s linear infinite'
            }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
              Verifying your email…
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>This will only take a moment.</p>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </>
        )}

        {state.phase === 'success' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              {state.alreadyUsed ? 'Already Verified' : 'Email Verified!'}
            </h2>
            <p style={{ fontSize: 15, color: '#475569', margin: '0 0 18px', lineHeight: 1.5 }}>
              {state.alreadyUsed
                ? 'This email was already verified. You\'re all set.'
                : <>Your <strong style={{ color: '#16a34a' }}>$20 welcome bonus</strong> has been credited to your wallet.</>}
            </p>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Redirecting to your wallet…</div>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              Verification Failed
            </h2>
            <p style={{ fontSize: 14, color: '#dc2626', margin: '0 0 22px', lineHeight: 1.5 }}>
              {state.error}
            </p>
            <Link to="/dashboard/wallet" style={{
              display: 'inline-block', padding: '12px 28px', borderRadius: 10,
              background: '#16a34a', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none'
            }}>
              Go to Wallet
            </Link>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 14 }}>
              You can request a fresh verification email from the Wallet page.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
