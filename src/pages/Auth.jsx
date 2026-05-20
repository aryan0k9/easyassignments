import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signInWithFacebook,
  signInWithApple,
  resetPassword
} from '../lib/auth'
import { createOrder } from '../lib/orders'
import { uploadOrderFiles } from '../lib/uploads'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/auth.css'

function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading: authLoading, user } = useAuth()
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false)
  const [quoteNotice, setQuoteNotice] = useState(null)
  const [showPasswordPopup, setShowPasswordPopup] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState('')

  // Rate limiting track failed login attempts in localStorage so lockout
  // survives page refreshes. Only applies to email/password login.
  const [failedAttempts, setFailedAttempts] = useState(() => {
    try { return parseInt(localStorage.getItem('ea_failed_attempts') || '0') } catch { return 0 }
  })
  const [lockedUntil, setLockedUntil] = useState(() => {
    try { const v = localStorage.getItem('ea_locked_until'); return v ? parseInt(v) : null } catch { return null }
  })
  const [lockCountdown, setLockCountdown] = useState(0)

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
    agreeToTerms: false
  })

  // If user is already logged in, process any pending order then go to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const raw = sessionStorage.getItem('pendingOrder')
      if (raw) {
        sessionStorage.removeItem('pendingOrder')
        // Cross-account guard: only create the order if the stored
        // intendedEmail matches the currently-signed-in user.
        try {
          const parsed = JSON.parse(raw)
          const intended = String(parsed?.intendedEmail || '').toLowerCase()
          const actual   = String(user?.email || '').toLowerCase()
          if (!intended || !actual || intended === actual) {
            import('../lib/orders').then(({ createOrder }) => {
              try { createOrder(parsed) } catch (_) {}
            })
          } else {
            console.warn('[Auth] pendingOrder dropped intendedEmail does not match signed-in user', { intended, actual })
          }
        } catch (_) {}
      }
      navigate('/dashboard')
    }
  }, [authLoading, isAuthenticated, user, navigate])

  // Read state passed from QuoteForm (existing user or new user flow)
  useEffect(() => {
    const s = location.state
    if (!s) return
    if (s.newUser || s.existingUser) {
      setQuoteNotice(s)
      if (s.email) setForm(f => ({ ...f, email: s.email }))
      if (s.newUser) setShowPasswordPopup(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick the lockout countdown every second
  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setLockCountdown(0)
        setFailedAttempts(0)
        try { localStorage.removeItem('ea_locked_until'); localStorage.removeItem('ea_failed_attempts') } catch {}
      } else {
        setLockCountdown(remaining)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
    setError('')
  }

  async function handleForgotSubmit(e) {
    e.preventDefault()
    setForgotError('')
    if (!forgotEmail.trim()) return setForgotError('Please enter your email.')
    setForgotLoading(true)
    const result = await resetPassword(forgotEmail.trim())
    setForgotLoading(false)
    if (result.success) setForgotSent(true)
    else setForgotError(result.error || 'Failed to send reset email.')
  }

  const getPasswordStrength = (pw) => {
    if (!pw) return { level: 0, label: '' }
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
    if (/\d/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 2) return { level: 1, label: 'Weak', className: 'weak' }
    if (score <= 4) return { level: 2, label: 'Medium', className: 'medium' }
    return { level: 3, label: 'Strong', className: 'strong' }
  }

  const strength = getPasswordStrength(form.password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Block submission if locked out
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`Too many failed attempts. Try again in ${lockCountdown}s.`)
      return
    }

    if (mode === 'signup') {
      if (!form.fullName.trim()) return setError('Please enter your full name.')
      if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
      if (form.password.length < 8) return setError('Password must be at least 8 characters.')
      if (!form.agreeToTerms) return setError('Please agree to the Terms & Privacy Policy.')
    }

    if (!form.email.includes('@')) return setError('Please enter a valid email address.')
    if (!form.password) return setError('Please enter your password.')

    setLoading(true)

    try {
      let result

      if (mode === 'signup') {
        result = await signUpWithEmail(form.email, form.password, form.fullName, form.phone)
      } else {
        result = await signInWithEmail(form.email, form.password)
      }

      if (!result.success) {
        // Only rate-limit email/password login failures, not signup errors
        if (mode === 'login') {
          const next = failedAttempts + 1
          setFailedAttempts(next)
          try { localStorage.setItem('ea_failed_attempts', String(next)) } catch {}

          if (next >= 5) {
            // Progressive lockout: 30s → 60s → 120s with each batch of 5 failures
            const lockMs = 30_000 * Math.pow(2, Math.floor((next - 5) / 5))
            const until = Date.now() + lockMs
            setLockedUntil(until)
            try { localStorage.setItem('ea_locked_until', String(until)) } catch {}
            setError(`Too many failed attempts. Try again in ${Math.ceil(lockMs / 1000)} seconds.`)
            setLoading(false)
            return
          }
        }
        setError(result.error)
        setLoading(false)
        return
      }

      if (result.needsEmailVerification) {
        setNeedsEmailVerification(true)
        setLoading(false)
        return
      }

      // Successful login clear rate limit state
      setFailedAttempts(0)
      setLockedUntil(null)
      try { localStorage.removeItem('ea_failed_attempts'); localStorage.removeItem('ea_locked_until') } catch {}

      // If this was a signup, fire the custom Brevo verification email.
      // Fire-and-forget we don't block the redirect on email send.
      if (mode === 'signup') {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-verification-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify({ appOrigin: window.location.origin }),
          }).catch(() => {})
        } catch (_) {}
      }

      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 1800)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider) => {
    setError('')
    setLoading(true)

    try {
      let result
      if (provider === 'google') result = await signInWithGoogle()
      else if (provider === 'facebook') result = await signInWithFacebook()
      else if (provider === 'apple') result = await signInWithApple()

      if (!result?.success) {
        setError(result?.error || `${provider} login failed`)
        setLoading(false)
        return
      }
    } catch (err) {
      setError(`${provider} login failed. Please try again.`)
      setLoading(false)
    }
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setError('')
    setSuccess(false)
    setNeedsEmailVerification(false)
  }

  // Email verification screen
  if (needsEmailVerification) {
    return (
      <div className="auth-page">
        <main className="auth-form-side" style={{ gridColumn: '1 / -1' }}>
          <div className="auth-form-wrap" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>📧</div>
            <h2 className="auth-form-title">Check your email</h2>
            <p className="auth-form-subtitle" style={{ marginTop: '12px' }}>
              We sent a verification link to <strong>{form.email}</strong>
            </p>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '24px 0' }}>
              Click the link in your email to activate your account, then come back here to log in.
            </p>
            <button className="auth-submit" onClick={() => switchMode('login')} style={{ maxWidth: '200px', margin: '0 auto' }}>
              Back to Login
            </button>
            <p className="auth-footer-notice" style={{ marginTop: '32px' }}>
              Didn't receive the email? Check your spam folder or contact support.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="auth-page">

      {/* ── New-user popup: shows auto-generated password ── */}
      {showPasswordPopup && quoteNotice?.newUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '36px 32px',
            maxWidth: '420px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              Account Created!
            </h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              Welcome to easyassignments! Your account is ready.<br />
              Log in with the temporary password below.
            </p>

            <div style={{
              background: '#f0fdf4', border: '2px dashed #22c55e',
              borderRadius: '10px', padding: '14px 20px', marginBottom: '8px'
            }}>
              <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Temporary Password
              </p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: '#15803d', letterSpacing: '0.08em', margin: 0 }}>
                {quoteNotice.tempPassword}
              </p>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '24px' }}>
              📧 A confirmation link has also been sent to <strong>{quoteNotice.email}</strong>
            </p>

            <button
              onClick={() => setShowPasswordPopup(false)}
              style={{
                background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '12px 32px', fontSize: '15px',
                fontWeight: 600, cursor: 'pointer', width: '100%'
              }}
            >
              Got it Log me in
            </button>
          </div>
        </div>
      )}

      <aside className="auth-brand">
        <Link to="/" className="auth-logo">
          <span className="auth-logo-mark">E</span>
          <span>easyassignments</span>
        </Link>

        <div className="auth-brand-content">
          <div className="auth-brand-eyebrow">
            <span className="live-pulse"></span>
            2,000+ experts online now
          </div>
          <h1 className="auth-brand-title">
            Top grades start with the <span className="accent">right help.</span>
          </h1>
          <p className="auth-brand-subtitle">
            Join 50,000+ students who trust easyassignments for premium academic help delivered by verified PhD experts on time, every time.
          </p>
          <div className="auth-trust-list">
            <div className="auth-trust-item"><span className="auth-trust-icon">✓</span><span>Free quotes in under 4 minutes</span></div>
            <div className="auth-trust-item"><span className="auth-trust-icon">✓</span><span>100% plagiarism-free, original work</span></div>
            <div className="auth-trust-item"><span className="auth-trust-icon">✓</span><span>Money-back guarantee, no risk</span></div>
            <div className="auth-trust-item"><span className="auth-trust-icon">✓</span><span>24/7 live support, every day</span></div>
          </div>
        </div>

        <div className="auth-testimonial">
          <div className="auth-testimonial-stars">★★★★★</div>
          <p className="auth-testimonial-text">
            "Got my finance assignment back in 24 hours and scored a HD. The expert was super responsive saved my semester!"
          </p>
          <div className="auth-testimonial-author">
            <div className="auth-testimonial-avatar">PS</div>
            <div className="auth-testimonial-info">
              <p className="auth-testimonial-name">Priya S.</p>
              <p className="auth-testimonial-meta">University of Sydney · Finance</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-form-side">
        <Link to="/" className="auth-back-home">← Back to website</Link>

        <div className="auth-form-wrap">
          {/* ── Banner for users arriving from the quote form ── */}
          {quoteNotice && !showPasswordPopup && (
            <div style={{
              background: quoteNotice.newUser ? '#f0fdf4' : '#eff6ff',
              border: `1px solid ${quoteNotice.newUser ? '#bbf7d0' : '#bfdbfe'}`,
              borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
              display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>
                {quoteNotice.newUser ? '✅' : 'ℹ️'}
              </span>
              <p style={{ margin: 0, fontSize: '13px', color: quoteNotice.newUser ? '#166534' : '#1e40af', lineHeight: 1.5 }}>
                {quoteNotice.message}
              </p>
            </div>
          )}

          {success ? (
            <div className="auth-success">
              <div className="auth-success-icon">✓</div>
              <h3>{mode === 'login' ? 'Welcome back!' : 'Account created!'}</h3>
              <p>Redirecting you to your dashboard...</p>
            </div>
          ) : (
            <>
              <div className="auth-toggle">
                <button type="button" className={`auth-toggle-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Sign In</button>
                <button type="button" className={`auth-toggle-btn ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>Create Account</button>
              </div>

              <div className="auth-form-heading">
                {mode === 'login' ? (
                  <>
                    <h2 className="auth-form-title">Welcome back</h2>
                    <p className="auth-form-subtitle">
                      New here? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signup') }}>Create an account</a>
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="auth-form-title">Create your account</h2>
                    <p className="auth-form-subtitle">
                      Already have one? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('login') }}>Sign in</a>
                    </p>
                  </>
                )}
              </div>

              <div className="auth-social-row">
                <button type="button" className="auth-social-btn" onClick={() => handleSocialLogin('google')} disabled={loading} style={{ width: '100%' }}>
                  <svg viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.617 0 3.077.555 4.222 1.633l3.151-3.151C17.467 1.65 14.872.5 12 .5 7.388.5 3.394 3.16 1.45 7.05L5.06 9.85C5.94 7.04 8.7 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.275c0-.815-.073-1.6-.21-2.355H12v4.46h6.46c-.28 1.485-1.125 2.745-2.4 3.59l3.7 2.875c2.165-2.005 3.74-4.95 3.74-8.57z" />
                    <path fill="#FBBC05" d="M5.06 14.15a7.155 7.155 0 0 1 0-4.3L1.45 7.05a11.969 11.969 0 0 0 0 9.9l3.61-2.8z" />
                    <path fill="#34A853" d="M12 23.5c3.24 0 5.96-1.075 7.95-2.92l-3.7-2.875c-1.025.69-2.34 1.095-4.25 1.095-3.3 0-6.06-2.04-6.94-4.85l-3.61 2.8C3.394 20.84 7.388 23.5 12 23.5z" />
                  </svg>
                  <span className="auth-social-label">Continue with Google</span>
                </button>
              </div>

              <div className="auth-divider"><span>or with email</span></div>

              {error && <div className="auth-error"><span>⚠️</span> {error}</div>}

              <form className="auth-form" onSubmit={handleSubmit}>
                {mode === 'signup' && (
                  <>
                    <div className="auth-field">
                      <label className="auth-field-label">Full Name</label>
                      <div className="auth-input-wrap">
                        <span className="auth-input-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </span>
                        <input type="text" name="fullName" className="auth-input" placeholder="John Smith" value={form.fullName} onChange={handleChange} required autoComplete="name" />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-field-label">Mobile Number</label>
                      <div className="auth-input-wrap">
                        <span className="auth-input-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                        </span>
                        <input type="tel" name="phone" className="auth-input" placeholder="+1 (555) 000-0000" value={form.phone} onChange={handleChange} autoComplete="tel" />
                      </div>
                    </div>
                  </>
                )}

                <div className="auth-field">
                  <label className="auth-field-label">Email Address</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    </span>
                    <input type="email" name="email" className="auth-input" placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-field-label">Password</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className="auth-input"
                      placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                      value={form.password}
                      onChange={handleChange}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      minLength={mode === 'signup' ? 8 : undefined}
                    />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>

                  {mode === 'signup' && form.password && (
                    <>
                      <div className="auth-strength">
                        <div className={`auth-strength-bar ${strength.level >= 1 ? strength.className : ''}`}></div>
                        <div className={`auth-strength-bar ${strength.level >= 2 ? strength.className : ''}`}></div>
                        <div className={`auth-strength-bar ${strength.level >= 3 ? strength.className : ''}`}></div>
                      </div>
                      <div className={`auth-strength-label ${strength.className}`}>{strength.label} password</div>
                    </>
                  )}
                </div>

                {mode === 'signup' && (
                  <div className="auth-field">
                    <label className="auth-field-label">Confirm Password</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      </span>
                      <input type={showPassword ? 'text' : 'password'} name="confirmPassword" className="auth-input" placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange} required autoComplete="new-password" />
                    </div>
                  </div>
                )}

                {mode === 'login' && (
                  <div className="auth-extra-row">
                    <label className="auth-checkbox-label">
                      <input type="checkbox" name="rememberMe" className="auth-checkbox" checked={form.rememberMe} onChange={handleChange} />
                      Remember me
                    </label>
                    <a href="#" className="auth-link" onClick={(e) => { e.preventDefault(); setShowForgot(true); setForgotEmail(form.email); setForgotSent(false); setForgotError('') }}>
                      Forgot password?
                    </a>
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="auth-terms-row">
                    <input type="checkbox" name="agreeToTerms" className="auth-checkbox" checked={form.agreeToTerms} onChange={handleChange} />
                    <span className="auth-terms-text">
                      I agree to easyassignments's <Link to="/page/terms-conditions">Terms of Service</Link> and <Link to="/page/privacy-policy">Privacy Policy</Link>.
                    </span>
                  </div>
                )}

                <button type="submit" className="auth-submit" disabled={loading || (lockedUntil && Date.now() < lockedUntil)}>
                  {lockedUntil && Date.now() < lockedUntil ? (
                    <span>🔒 Locked try again in {lockCountdown}s</span>
                  ) : loading ? (
                    <>
                      <span className="auth-submit-spinner"></span>
                      <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>

              <p className="auth-footer-notice">
                🔒 Powered by Supabase. Your data is secure.
                <br /><br />
                By continuing, you agree to our <Link to="/page/terms-conditions">Terms</Link> and <Link to="/page/privacy-policy">Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>
      </main>

      {/* ===== FORGOT PASSWORD MODAL ===== */}
      {showForgot && (
        <div
          onClick={() => setShowForgot(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            {forgotSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📧</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check your inbox</h3>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
                  We sent a reset link to <strong style={{ color: '#111' }}>{forgotEmail}</strong>
                </p>
                <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Didn't receive it? Check your spam folder.</p>
                <button onClick={() => setShowForgot(false)} style={{ marginTop: 24, width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Forgot password?</h3>
                  <p style={{ color: '#6b7280', fontSize: 14 }}>Enter your email and we'll send you a reset link.</p>
                </div>
                {forgotError && (
                  <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
                    {forgotError}
                  </div>
                )}
                <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="your@email.com"
                    value={forgotEmail}
                    onChange={e => { setForgotEmail(e.target.value); setForgotError('') }}
                    autoFocus
                    required
                  />
                  <button type="submit" disabled={forgotLoading} style={{ padding: '13px', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => setShowForgot(false)} style={{ padding: '11px', background: 'none', border: '1px solid #e5e7eb', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#6b7280' }}>
                    Cancel
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Auth
