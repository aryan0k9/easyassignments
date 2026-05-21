import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { redirectToCheckout } from '../../lib/stripe'
import { LockKeyhole, ShieldCheck, ShieldAlert, Check, CreditCard, AlertCircle, Info } from 'lucide-react'

const TAX_RATE      = 0.10
const BONUS_CAP_PCT = 0.05    // bonus credits usable up to 5% of subtotal
const round2 = (n) => Math.round(n * 100) / 100

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const orderId     = searchParams.get('orderId') || ''
  const plan        = searchParams.get('plan') || 'full'
  const addonParam  = searchParams.get('addon') || ''
  const addonAmount = parseFloat(searchParams.get('addonAmount') || '0')
  const addonLabel  = searchParams.get('addonLabel') || 'Add-on Service'
  const isAddon     = !!addonParam && addonAmount > 0

  const [order, setOrder] = useState(null)
  const [topupBalance, setTopupBalance] = useState(0)
  const [bonusBalance, setBonusBalance] = useState(0)
  const [useWallet, setUseWallet] = useState(true)
  const [paying, setPaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(true)

  const [promo] = useState(null)

  useEffect(() => {
    if (!orderId || !user?.id) return
    Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('wallet_balance_breakdown')
        .select('topup_balance, bonus_balance')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]).then(([{ data: ord }, { data: pool }]) => {
      setOrder(ord)
      setTopupBalance(Math.max(0, round2(Number(pool?.topup_balance) || 0)))
      setBonusBalance(Math.max(0, round2(Number(pool?.bonus_balance) || 0)))
      setLoading(false)
    })
  }, [orderId, user?.id])

  if (!orderId) {
    navigate('/dashboard/payments')
    return null
  }

  const planMultiplier = (() => {
    if (plan === 'splithalf') return 0.5
    const m = plan && plan.match(/^(weekly|biweekly)(\d+)$/)
    if (m) return 1 / parseInt(m[2], 10)
    if (plan === 'biweekly') return 0.5
    if (plan === 'weekly') return 0.25
    return 1.0
  })()
  const fullPrice   = order?.price || 0
  const paidAlready = order?.paid_amount || 0

  const offerPrice = isAddon
    ? addonAmount
    : plan === 'full'
      ? Math.max(0, round2(fullPrice - paidAlready))
      : round2(fullPrice * planMultiplier)

  const promoDiscount      = promo?.discount || 0
  const subtotalAfterPromo = Math.max(0, round2(offerPrice - promoDiscount))
  const tax                = isAddon ? 0 : round2(subtotalAfterPromo * TAX_RATE)
  const total              = round2(subtotalAfterPromo + tax)

  // Wallet split (display-side; server re-derives at pay time).
  // Bonus (website-provided) is deducted FIRST, always even when topup
  // covers the full order. That way admin/welcome credits are always consumed.
  // Topup (user-recharged via Stripe) covers whatever remains.
  const bonusCap    = round2(subtotalAfterPromo * BONUS_CAP_PCT)  // 5% of order subtotal
  const fromBonus   = useWallet ? Math.min(bonusCap, bonusBalance, total) : 0
  const fromTopup   = useWallet ? Math.min(topupBalance, Math.max(0, round2(total - fromBonus))) : 0
  const walletApplied = round2(fromBonus + fromTopup)
  const chargeAmount  = Math.max(0, round2(total - walletApplied))




  // ── Pay flow ────────────────────────────────────────────────────
  async function handleWalletOnlyPay() {
    if (paying || !order) return
    setPaying(true)
    try {
      const { data, error } = await supabase.functions.invoke('wallet-pay', {
        body: { orderId: order.id, plan, promoCode: promo?.code || '' },
      })
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Payment failed')
      }
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession()
        if (authSession?.access_token) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-wallet-payment-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authSession.access_token}`,
            },
            body: JSON.stringify({ orderId: order.id, appOrigin: window.location.origin }),
          }).catch(err => console.error('Wallet payment email failed (non-critical):', err.message))
        }
      } catch (_) { /* never block on email */ }

      sessionStorage.setItem('payment_success_msg', `✅ $${walletApplied.toFixed(2)} paid from wallet!`)
      window.location.href = '/dashboard/payments'
    } catch (err) {
      alert('Payment error: ' + err.message)
      setPaying(false)
    }
  }

  async function handlePay() {
    if (paying || !order) return
    if (!termsAccepted) {
      alert('Please accept the Terms & Conditions, Refund Policy, and Privacy Policy to continue.')
      return
    }
    if (chargeAmount === 0 && walletApplied > 0) {
      return handleWalletOnlyPay()
    }
    setPaying(true)
    try {
      if (isAddon) {
        sessionStorage.setItem('pending_addon', JSON.stringify({
          orderId: String(order.id),
          addonType: addonParam,
          addonLabel,
          amount: chargeAmount,
          userId: user?.id,
        }))
      }
      await redirectToCheckout({
        description: isAddon ? `${addonLabel} Order ${order.order_number}` : `Order ${order.order_number}`,
        orderId: String(order.id),
        type: isAddon ? 'addon' : 'payment',
        plan: isAddon ? 'full' : plan,
        addonType: isAddon ? addonParam : '',
        promoCode: promo?.code || '',
        useWallet,
        successPath: '/dashboard/payments',
        cancelPath: isAddon
          ? `/dashboard/checkout?orderId=${orderId}&addon=${addonParam}&addonAmount=${addonAmount}&addonLabel=${encodeURIComponent(addonLabel)}`
          : `/dashboard/checkout?orderId=${orderId}&plan=${plan}`,
      })
    } catch (err) {
      alert('Could not start checkout: ' + err.message)
      setPaying(false)
    }
  }

  // ── Derived banner: only when admin discount on order ───────────
  const hasAdminDiscount = !isAddon && order?.original_price > order?.price
  const productLabel = isAddon ? addonLabel : (order?.subject || 'Academic Service')

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb', fontFamily: "'Inter', 'Segoe UI', system-ui, Arial, sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .co-pay-btn:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
        .co-pay-btn { transition: all 0.15s ease; }
        .co-apply-btn:hover { background: #1e293b !important; }
        .co-link { color: #2563eb; font-weight: 600; text-decoration: none; }
        .co-link:hover { text-decoration: underline; }
        .co-input:focus { outline: none; border-color: #16a34a !important; box-shadow: 0 0 0 3px rgba(22,163,74,0.12); }
        @media (max-width: 880px) {
          .co-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          .co-navbar { padding: 0 16px !important; }
          .co-container { padding: 0 16px !important; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        .co-tip-wrap { position: relative; display: inline-flex; align-items: center; }
        .co-tip { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(4px); width: 240px; padding: 10px 12px; background: #0f172a; color: white; font-size: 11px; font-weight: 500; line-height: 1.5; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); opacity: 0; pointer-events: none; transition: opacity 0.18s, transform 0.18s; z-index: 20; white-space: normal; }
        .co-tip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #0f172a; }
        .co-tip-wrap:hover .co-tip { opacity: 1; transform: translateX(-50%) translateY(0); }
      `}</style>

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <div className="co-navbar" style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '0 40px', display: 'flex', alignItems: 'center', height: 64,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginRight: 16, display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '7px 10px', cursor: 'pointer', color: '#475569',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#475569' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>easyassignments</span>
        <div style={{
          marginLeft: 18, display: 'flex', alignItems: 'center', gap: 6,
          background: '#f3f4f6', border: '1px solid #e5e7eb',
          borderRadius: 999, padding: '5px 12px',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Secure Checkout</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, color: '#475569' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
      </div>

      {/* ── Info banner ──────────────────────────────────────────── */}
      <div style={{ maxWidth: 1160, width: '100%', margin: '16px auto 0', padding: '0 24px' }}>
        <div style={{
          background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 12,
          padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Info size={18} color="#64748b" />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#475569' }}>
            Charges on your card will appear as{' '}
            <span style={{ color: '#0f172a', fontWeight: 700 }}>"Nexvanta Consulting LLC"</span>
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', flex: 1 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '4px solid #e2e8f0', borderTopColor: '#16a34a',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#64748b', fontSize: 15 }}>Loading order details...</p>
        </div>
      ) : !order ? (
        <div style={{ padding: 80, textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p style={{ color: '#ef4444', fontSize: 16, fontWeight: 600 }}>Order not found.</p>
        </div>
      ) : (
        <div className="co-container" style={{ flex: 1, maxWidth: 1160, width: '100%', margin: '32px auto 56px', padding: '0 24px' }}>

          <div className="co-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 28, alignItems: 'start' }}>

            {/* ─────────── LEFT: Complete Your Payment ─────────── */}
            <div>
              <h1 style={{ margin: '0 0 20px', fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.6px' }}>
                Complete Your Payment
              </h1>

              {/* Amount Due dark card */}
              <div style={{
                background: '#0f172a', borderRadius: 14, padding: '22px 24px', marginBottom: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                    Order ID #EA-{(order.order_number || '').replace(/^EA-/, '')}
                  </div>
                  <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Amount Due</div>
                </div>
                <div style={{ color: 'white', fontSize: 38, fontWeight: 800, letterSpacing: '-1.2px' }}>
                  ${chargeAmount.toFixed(2)}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8', marginLeft: 6 }}>USD</span>
                </div>
              </div>

              {/* Payment Method card */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px 32px', boxShadow: '0px 8px 30px rgba(30,41,59,0.05)', display: 'flex', flexDirection: 'column', gap: 32 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Manrope', 'Inter', system-ui" }}>Payment Method</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontWeight: 500, fontSize: 14 }}>
                    <LockKeyhole size={16} strokeWidth={2.5} />
                    <span>Secure Stripe Gateway</span>
                  </div>
                </div>

                {/* Card Selection box */}
                <div style={{ border: '2px solid rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.02)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* Row 1: icon + title + radio */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ background: '#f1f5f9', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={24} strokeWidth={2.5} color="#475569" />
                      </div>
                      <span style={{ fontFamily: "'Manrope', 'Inter', system-ui", fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Debit / Credit Card</span>
                    </div>
                    <div style={{ width: 20, height: 20, background: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0 }}>
                      <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: '50%' }} />
                    </div>
                  </div>

                  {/* Row 2: card badges + powered by stripe */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['VISA', 'MC', 'AMEX'].map(card => (
                        <div key={card} style={{ border: '1px solid #e2e8f0', background: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.08em' }}>
                          {card}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                      Powered by <span style={{ color: '#334155', fontWeight: 800, letterSpacing: '-0.3px' }}>stripe</span>
                    </div>
                  </div>

                  {/* Placeholder field — inside card box */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8', background: 'white' }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Payment details secured by Stripe...</span>
                    <LockKeyhole size={18} strokeWidth={2.5} color="#94a3b8" />
                  </div>
                </div>

                {/* Pay button */}
                {(() => {
                  const walletOnly = chargeAmount === 0 && walletApplied > 0
                  const isDisabled = paying || !termsAccepted || (chargeAmount <= 0 && !walletOnly)
                  return (
                    <button
                      className="co-pay-btn"
                      onClick={handlePay}
                      disabled={isDisabled}
                      style={{
                        width: '100%', padding: '16px 18px',
                        background: '#16a34a', color: 'white', border: 'none', borderRadius: 12,
                        fontFamily: "'Manrope', 'Inter', system-ui", fontSize: 20, fontWeight: 800,
                        cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 4px 14px rgba(22,163,74,0.32)',
                      }}
                    >
                      {paying ? (
                        <>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                          Redirecting…
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={22} strokeWidth={3} />
                          {walletOnly ? `Pay $${walletApplied.toFixed(2)} USD from Wallet` : `Pay $${chargeAmount.toFixed(2)} USD`}
                        </>
                      )}
                    </button>
                  )
                })()}

                {/* Merchant location */}
                <div style={{ textAlign: 'center', fontSize: 14, color: '#64748b', fontWeight: 500, marginTop: -16 }}>
                  Merchant Location - Wyoming, United States
                </div>

                {/* Trust badges */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
                    <ShieldCheck size={18} strokeWidth={2.5} color="#16a34a" />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>SSL Encrypted</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
                    <ShieldCheck size={18} strokeWidth={2.5} color="#16a34a" />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Secured by Stripe</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
                    <ShieldAlert size={18} strokeWidth={2.5} color="#16a34a" />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>No card stored</span>
                  </div>
                </div>

                {/* Terms checkbox */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingTop: 24, borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  />
                  <div style={{
                    width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: termsAccepted ? '#3b5998' : 'white',
                    border: `1px solid ${termsAccepted ? '#3b5998' : '#cbd5e1'}`,
                    transition: 'all 0.15s',
                  }}>
                    <Check size={18} strokeWidth={3.5} color="white" style={{ opacity: termsAccepted ? 1 : 0, transition: 'opacity 0.15s' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
                    I have read and accept{' '}
                    <a className="co-link" href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> |{' '}
                    <a className="co-link" href="/refund-policy" target="_blank" rel="noreferrer">Refund Policy</a> |{' '}
                    <a className="co-link" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
                  </p>
                </label>
              </div>
            </div>

            {/* ─────────── RIGHT: Order Summary ─────────── */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '0px 1px 3px rgba(0,0,0,0.06)' }}>

              {/* Header */}
              <h3 style={{ margin: 0, fontFamily: "'Manrope','Inter',system-ui", fontSize: 20, fontWeight: 800, color: '#0f172a', paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                Order Summary
              </h3>

              {/* Line Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>{productLabel}</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>${offerPrice.toFixed(2)} USD</span>
                </div>
                {!isAddon && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#475569', fontWeight: 500 }}>Govt. &amp; Local Taxes (10%)</span>
                      <div className="co-tip-wrap">
                        <AlertCircle size={16} strokeWidth={2} color="#94a3b8" style={{ cursor: 'help' }} />
                        <div className="co-tip">
                          Includes applicable government taxes and regional compliance fee for online services
                        </div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>${tax.toFixed(2)} USD</span>
                  </div>
                )}
              </div>

              {/* Add-on Features */}
              {!isAddon && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#0b513d', textTransform: 'uppercase' }}>
                    Add-on Features
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[{ name: 'SMS Updates', price: '4.99' }, { name: 'Priority Review', price: '7.99' }].map(a => (
                      <div key={a.name} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 16, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{a.name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8', textDecoration: 'line-through' }}>${a.price}</p>
                        </div>
                        <span style={{ color: '#16a34a', fontWeight: 800, fontSize: 14, padding: '4px 10px', background: 'rgba(22,163,74,0.1)', borderRadius: 8 }}>FREE</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin discount display */}
              {hasAdminDiscount && (() => {
                const orig  = order.original_price
                const offer = order.price
                const pct   = Math.round((1 - offer / orig) * 100)
                const saved = round2(orig - offer)
                return (
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Info size={18} fill="#12B159" stroke="white" strokeWidth={2} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#003b19', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                      {pct}% OFF PROMO APPLIED
                    </span>
                  </div>
                )
              })()}

              {/* Wallet section */}
              {(topupBalance > 0 || bonusBalance > 0) && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Apply Wallet Balance</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                        Available Balance: <strong>${(topupBalance + bonusBalance).toFixed(2)} USD</strong>
                      </p>
                    </div>
                    <div
                      onClick={() => setUseWallet(v => !v)}
                      style={{ width: 48, height: 24, borderRadius: 12, background: useWallet ? '#16a34a' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}
                    >
                      <div style={{ position: 'absolute', top: 4, left: useWallet ? 26 : 4, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>

                  {useWallet && walletApplied > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 13 }}>
                      {fromTopup > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>From wallet balance</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>−${fromTopup.toFixed(2)} USD</span>
                        </div>
                      )}
                      {fromBonus > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>Bonus credit (5% of ${subtotalAfterPromo.toFixed(2)} USD)</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>−${fromBonus.toFixed(2)} USD</span>
                        </div>
                      )}
                      {bonusBalance > 0 && (
                        <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Website-provided credits are limited to 5% of their balance per order.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Totals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Total Due</span>
                  <span style={{ fontFamily: "'Manrope','Inter',system-ui", fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.8px' }}>
                    ${total.toFixed(2)}
                  </span>
                </div>
                {walletApplied > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <span>Charged to Wallet</span>
                    <span>${walletApplied.toFixed(2)} USD</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>Charged to Card</span>
                  <span style={{ color: '#0f172a' }}>${chargeAmount.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer style={{ background: 'white', borderTop: '1px solid #e2e8f0', marginTop: 48, paddingTop: 40, paddingBottom: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 32 }}>
          <div style={{ fontFamily: "'Manrope','Inter',system-ui", fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
            easyassignments
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
            {[['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Refund Policy', '/refund-policy'], ['Security Standards', '/security']].map(([label, href]) => (
              <a key={label} href={href} style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textDecoration: 'underline', textDecorationColor: '#e2e8f0', textUnderlineOffset: 4, textDecorationThickness: 1, transition: 'color 0.15s' }}
                onMouseEnter={e => e.target.style.color = '#16a34a'}
                onMouseLeave={e => e.target.style.color = '#94a3b8'}
              >
                {label}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>
            © {new Date().getFullYear()} easyassignments. Professional Academic Support.
          </div>
        </div>
      </footer>
    </div>
  )
}

