import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { redirectToCheckout } from '../../lib/stripe'
import PaymentConfirmingOverlay from '../../components/PaymentConfirmingOverlay'

function Wallet() {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [searchParams] = useSearchParams()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayStatus, setOverlayStatus] = useState('verifying')
  const [overlayAmount, setOverlayAmount] = useState(0)
  const [verifyState, setVerifyState] = useState({ sending: false, sent: false, error: '' })
  const [emailVerified, setEmailVerified] = useState(false)
  const hasWelcomeBonus = transactions.some(t => /welcome bonus/i.test(t.description || ''))

  // Load profiles.email_verified_at (custom Brevo flow not auth.users.email_confirmed_at)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
      ; (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('email_verified_at')
          .eq('id', user.id)
          .maybeSingle()
        if (!cancelled) setEmailVerified(!!data?.email_verified_at)
      })()
    return () => { cancelled = true }
  }, [user?.id])

  async function handleResendVerification() {
    if (!user?.email || verifyState.sending) return
    setVerifyState({ sending: true, sent: false, error: '' })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-verification-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ appOrigin: window.location.origin }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        setVerifyState({ sending: false, sent: false, error: json.error || `HTTP ${res.status}` })
        return
      }
      if (json.alreadyVerified) setEmailVerified(true)
      setVerifyState({ sending: false, sent: true, error: '' })
    } catch (err) {
      setVerifyState({ sending: false, sent: false, error: err.message || 'Network error' })
    }
  }

  const walletId = user?.id
    ? `WLT-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
    : 'WLT-NEW'

  async function loadWallet() {
    if (!user?.id) return
    setLoadingWallet(true)
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
    if (txns) {
      // Exclude card payment records those are Stripe charges, not wallet movements
      const walletTxns = txns.filter(t => !t.description?.startsWith('Card payment for Order'))
      const bal = walletTxns.reduce((s, t) => t.type === 'credit' ? s + t.amount : s - t.amount, 0)
      setBalance(Math.max(0, bal))
      setTransactions(walletTxns.map(t => ({
        id: t.id,
        date: t.created_at,
        type: t.type,
        description: t.description,
        amount: t.amount,
      })))
    }
    setLoadingWallet(false)
  }

  useEffect(() => { loadWallet() }, [user?.id])

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const cancelled = searchParams.get('cancelled')

    if (sessionId) {
      const key = `stripe_verified_${sessionId}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
      setOverlayVisible(true)
      setOverlayStatus('verifying')
      verifyTopup(sessionId)
    } else if (cancelled) {
      setMsg('Top-up cancelled.')
      setTimeout(() => setMsg(''), 3000)
    }
  }, [])

  async function verifyTopup(sessionId) {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession?.access_token ?? ''}`,
          },
          body: JSON.stringify({ sessionId }),
        }
      )
      const json = await res.json()
      if (json.verified) {
        setOverlayAmount(json.amount || 0)
        setOverlayStatus('success')

        // Fire-and-forget top-up receipt email via Brevo. The edge function
        // looks up the actual top-up transaction server-side (amount,
        // balance_after) so we never trust client-supplied numbers.
        try {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-wallet-topup-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authSession?.access_token ?? ''}`,
            },
            body: JSON.stringify({ appOrigin: window.location.origin }),
          }).catch(err => console.error('Top-up email failed (non-critical):', err.message))
        } catch (_) { /* never block on email */ }

        // Full reload after success so wallet balance fetches fresh from DB and URL is clean
        setTimeout(() => { window.location.href = '/dashboard/wallet' }, 2500)
      } else {
        setOverlayStatus('error')
        setTimeout(() => {
          setOverlayVisible(false)
          setMsg(`⚠️ Could not verify: ${json.reason || json.error}`)
          setTimeout(() => setMsg(''), 5000)
        }, 2000)
      }
    } catch (err) {
      setOverlayStatus('error')
      setTimeout(() => {
        setOverlayVisible(false)
        setMsg('⚠️ Verification error: ' + err.message)
      }, 2000)
    }
  }

  const handleAddMoney = async (e) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return alert('Please enter a valid amount')
    setIsAdding(true)
    try {
      await redirectToCheckout({
        amount: amt,
        description: `Wallet top-up $${amt.toFixed(2)}`,
        orderId: '',
        type: 'topup',
        successPath: '/dashboard/wallet',
        cancelPath: '/dashboard/wallet',
      })
    } catch (err) {
      alert('Could not start checkout: ' + err.message)
      setIsAdding(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  return (
    <StudentLayout title="Wallet">
      <PaymentConfirmingOverlay visible={overlayVisible} status={overlayStatus} amount={overlayAmount} />

      {/* ── $20 Welcome Bonus banner ─────────────────────────── */}
      {!loadingWallet && !hasWelcomeBonus && (
        <div style={{
          background: emailVerified
            ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)'
            : 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: `1.5px solid ${emailVerified ? '#86efac' : '#fcd34d'}`,
          borderRadius: 14, padding: '14px 18px', marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: 32 }}>🎁</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            {emailVerified ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#065f46' }}>
                  Your $20 welcome bonus is on its way
                </div>
                <div style={{ fontSize: 13, color: '#047857', marginTop: 2 }}>
                  Email verified refresh in a moment to see the credit.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e' }}>
                  Verify your email to claim your $20 welcome bonus
                </div>
                <div style={{ fontSize: 13, color: '#a16207', marginTop: 2 }}>
                  We'll send a verification link to <strong>{user?.email}</strong>. Click it and $20 lands in your wallet instantly.
                </div>
                {verifyState.sent && (
                  <div style={{ fontSize: 13, color: '#047857', marginTop: 6, fontWeight: 600 }}>
                    ✅ Verification email sent. Check your inbox (and spam folder).
                  </div>
                )}
                {verifyState.error && (
                  <div style={{ fontSize: 13, color: '#dc2626', marginTop: 6, fontWeight: 600 }}>
                    ⚠ {verifyState.error}
                  </div>
                )}
              </>
            )}
          </div>
          {!emailVerified && (
            <button
              onClick={handleResendVerification}
              disabled={verifyState.sending}
              style={{
                padding: '10px 20px', borderRadius: 10,
                background: verifyState.sending ? '#d97706' : '#f59e0b',
                color: 'white', border: 'none', fontWeight: 700, fontSize: 14,
                cursor: verifyState.sending ? 'wait' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {verifyState.sending
                ? 'Sending...'
                : verifyState.sent
                  ? 'Resend Email'
                  : 'Verify Email & Get $20'}
            </button>
          )}
        </div>
      )}

      <div className="sp-wallet-grid">
        {/* Wallet balance card - uses existing sp-balance-card CSS */}
        <div className="sp-balance-card">
          <p className="sp-balance-label">Available Balance</p>
          <p className="sp-balance-amount">{loadingWallet ? '...' : `$${balance.toFixed(2)}`}</p>
          <p className="sp-balance-id">Wallet ID: {walletId}</p>

          {msg && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, textAlign: 'center' }}>
              {msg}
            </div>
          )}

          {/* Quick checkout buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[10, 25, 50, 100].map(preset => (
              <button
                key={preset}
                disabled={isAdding}
                onClick={async () => {
                  setIsAdding(true)
                  try {
                    await redirectToCheckout({
                      amount: preset,
                      description: `Wallet top-up $${preset.toFixed(2)}`,
                      orderId: '',
                      type: 'topup',
                      successPath: '/dashboard/wallet',
                      cancelPath: '/dashboard/wallet',
                    })
                  } catch (err) {
                    alert('Could not start checkout: ' + err.message)
                    setIsAdding(false)
                  }
                }}
                style={{
                  padding: '12px 8px',
                  borderRadius: 10,
                  border: '2px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: isAdding ? 'not-allowed' : 'pointer',
                  opacity: isAdding ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                ${preset}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 10 }}>
            or enter custom amount
          </div>

          <form onSubmit={handleAddMoney} className="sp-balance-form">
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="Custom amount (USD)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              type="submit"
              disabled={isAdding || !amount}
              style={{
                background: 'var(--sp-green)',
                color: 'white',
                border: 'none',
                padding: '12px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: (isAdding || !amount) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                opacity: (isAdding || !amount) ? 0.7 : 1,
              }}
            >
              {isAdding ? '⏳...' : '+ Add Money'}
            </button>
          </form>

          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: 14, textAlign: 'center' }}>
            🔒 Secured by Stripe · Instant credit after payment
          </p>
        </div>

        {/* Transaction history */}
        <div className="sp-card" style={{ marginBottom: 0 }}>
          <div className="sp-card-header">
            <h3 className="sp-card-title">📊 Transaction History</h3>
          </div>

          {transactions.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">💰</div>
              <h4>No transactions yet</h4>
              <p>Your transaction history will appear here once you place an order or add money to your wallet.</p>
              <Link to="/dashboard/new-order" className="sp-btn sp-btn-primary">
                Place First Order →
              </Link>
            </div>
          ) : (
            <div>
              {transactions.map((tx) => (
                <div key={tx.id} style={{
                  padding: '14px 24px',
                  borderBottom: '1px solid var(--sp-surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      display: 'grid',
                      placeItems: 'center',
                      background: tx.type === 'credit' ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
                      flexShrink: 0
                    }}>
                      {tx.type === 'credit' ? '⬇️' : '⬆️'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--sp-primary)', fontSize: '14px' }}>
                        {tx.description}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--sp-muted)', marginTop: '2px' }}>
                        {formatDate(tx.date)}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 700,
                    fontFamily: 'var(--sp-font-display)',
                    fontSize: '17px',
                    color: tx.type === 'credit' ? 'var(--sp-green)' : 'var(--sp-red)',
                    flexShrink: 0
                  }}>
                    {tx.type === 'credit' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  )
}

export default Wallet
