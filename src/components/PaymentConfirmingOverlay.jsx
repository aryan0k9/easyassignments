import { useEffect, useState } from 'react'

export default function PaymentConfirmingOverlay({ visible, status = 'verifying', amount = 0 }) {
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => setOpacity(1))
    } else {
      setOpacity(0)
    }
  }, [visible])

  if (!visible && opacity === 0) return null

  const isVerifying = status === 'verifying'
  const isSuccess   = status === 'success'
  const isError     = status === 'error'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10, 15, 30, 0.92)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      opacity, transition: 'opacity 0.4s ease',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 0.6 }
          50%  { transform: scale(1.1); opacity: 0.3 }
          100% { transform: scale(0.8); opacity: 0.6 }
        }
        @keyframes pop-in {
          0%   { transform: scale(0.5); opacity: 0 }
          70%  { transform: scale(1.1) }
          100% { transform: scale(1);   opacity: 1 }
        }
        @keyframes stripe-wave {
          0%   { background-position: 0% 50% }
          50%  { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)',
        borderRadius: 28,
        padding: '48px 40px',
        maxWidth: 420, width: '100%',
        textAlign: 'center',
        boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.2)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Animated gradient top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: 'linear-gradient(90deg, #635bff, #7c3aed, #06b6d4, #635bff)',
          backgroundSize: '300% 100%',
          animation: 'stripe-wave 3s ease infinite',
        }} />

        {/* Icon area */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 28 }}>
          {isVerifying && (
            <>
              {/* Pulse ring */}
              <div style={{
                position: 'absolute', inset: -12,
                borderRadius: '50%',
                border: '3px solid rgba(99,91,255,0.4)',
                animation: 'pulse-ring 2s ease-in-out infinite',
              }} />
              {/* Spinner */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                border: '4px solid rgba(255,255,255,0.1)',
                borderTop: '4px solid #635bff',
                animation: 'spin 0.9s linear infinite',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} />
              {/* Stripe S inside */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M15.4 11.2c0-1.3 1-1.9 2.7-1.9 2.4 0 5.5.7 7.9 2V5.5C23.4 4.2 20.8 4 18.1 4c-5.7 0-9.5 2.9-9.5 7.7 0 7.5 10.4 6.3 10.4 9.5 0 1.5-1.3 2-3.1 2-2.7 0-6.1-.9-8.8-2.5v5.9c3 1.3 6 1.8 8.8 1.8 5.9 0 10-2.8 10-7.7-.1-8.1-10.5-6.7-10.5-9.5z" fill="rgba(99,91,255,0.8)"/>
                </svg>
              </div>
            </>
          )}

          {isSuccess && (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: '0 0 40px rgba(22,163,74,0.4)',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}

          {isError && (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>

        {/* Text */}
        <div style={{ color: 'white' }}>
          {isVerifying && (
            <>
              <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Confirming Payment
              </h2>
              <p style={{ margin: '0 0 6px', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                Verifying your payment with Stripe...
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Please don't close this window
              </p>
            </>
          )}

          {isSuccess && (
            <>
              <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: '#4ade80', letterSpacing: '-0.02em' }}>
                Payment Confirmed!
              </h2>
              {amount > 0 && (
                <p style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 900, color: 'white' }}>
                  ${Number(amount).toFixed(2)}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                Successfully verified by Stripe
              </p>
            </>
          )}

          {isError && (
            <>
              <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: '#f87171' }}>
                Verification Failed
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                Please contact support if money was charged.
              </p>
            </>
          )}
        </div>

        {/* Stripe badge */}
        <div style={{
          marginTop: 32,
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="rgba(99,91,255,0.6)"/>
          </svg>
          Secured by Stripe · End-to-end encrypted
        </div>
      </div>
    </div>
  )
}
