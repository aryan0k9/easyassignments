import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/login'), 3000)
  }

  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8) s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++
    if (/\d/.test(password)) s++
    return s
  })()
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength] || ''
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#16a34a'][strength] || ''

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter Tight', Inter, sans-serif", padding: '24px 16px'
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: '#ffffff',
        borderRadius: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}>
        {/* Top accent bar */}
        <div style={{ height: 5, background: 'linear-gradient(90deg, #16a34a, #22c55e, #86efac)' }} />

        <div style={{ padding: '40px 36px 36px' }}>
          {done ? (
            /* ===== SUCCESS STATE ===== */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 36, boxShadow: '0 8px 24px rgba(22,163,74,0.3)'
              }}>✅</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Password Updated!</h2>
              <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6 }}>
                Your password has been changed successfully.<br />Redirecting you to login...
              </p>
              <div style={{ marginTop: 24, height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#16a34a', width: '100%', animation: 'shrink 3s linear forwards' }} />
              </div>
              <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
            </div>

          ) : !ready ? (
            /* ===== LOADING STATE ===== */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#f8fafc', border: '3px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', fontSize: 28
              }}>⏳</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Processing Link...</h2>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
                Validating your reset link. If nothing happens,<br />the link may have expired.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{ marginTop: 20, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, textDecoration: 'underline' }}
              >
                Back to Login
              </button>
            </div>

          ) : (
            /* ===== FORM STATE ===== */
            <>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{
                  width: 68, height: 68, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', fontSize: 30, boxShadow: '0 8px 24px rgba(22,163,74,0.25)'
                }}>🔐</div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 6, letterSpacing: '-0.02em' }}>
                  Set New Password
                </h2>
                <p style={{ color: '#6b7280', fontSize: 14 }}>Choose a strong password for your account</p>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                  borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 500,
                  marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8
                }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* New Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError('') }}
                      autoFocus
                      required
                      style={{
                        width: '100%', padding: '13px 48px 13px 16px', fontSize: 15,
                        border: `2px solid ${error ? '#fca5a5' : password ? '#16a34a' : '#e5e7eb'}`,
                        borderRadius: 12, outline: 'none', boxSizing: 'border-box',
                        background: '#fafafa', transition: 'border-color 0.2s',
                        fontFamily: 'inherit'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, lineHeight: 1
                      }}
                    >
                      {showPw ? '🙈' : '👁️'}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 99,
                            background: i <= strength ? strengthColor : '#e5e7eb',
                            transition: 'background 0.3s'
                          }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: strengthColor, fontWeight: 600, margin: 0 }}>{strengthLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Confirm Password
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError('') }}
                    required
                    style={{
                      width: '100%', padding: '13px 16px', fontSize: 15,
                      border: `2px solid ${confirm && confirm !== password ? '#fca5a5' : confirm && confirm === password ? '#16a34a' : '#e5e7eb'}`,
                      borderRadius: 12, outline: 'none', boxSizing: 'border-box',
                      background: '#fafafa', transition: 'border-color 0.2s',
                      fontFamily: 'inherit'
                    }}
                  />
                  {confirm && confirm === password && (
                    <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>✓ Passwords match</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '15px',
                    background: loading ? '#86efac' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#fff', border: 'none', borderRadius: 14,
                    fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 14px rgba(22,163,74,0.35)', transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Updating...
                    </>
                  ) : '🔒 Update Password'}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

                <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                  Remember your password?{' '}
                  <a href="/login" style={{ color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
