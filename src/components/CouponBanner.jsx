// ============================================================
// CouponBanner shown at the TOP of every student dashboard page
// Displays active coupons the student can copy and use at checkout
// ============================================================

import { useState, useEffect } from 'react'
import { getActiveCoupons } from '../lib/coupons'
import { useAuth } from '../contexts/AuthContext'

export default function CouponBanner() {
  const { user } = useAuth()
  const [coupons, setCoupons] = useState([])
  const [current, setCurrent] = useState(0)
  const [copied, setCopied]   = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    getActiveCoupons(user?.id || null).then(data => {
      if (data.length > 0) setCoupons(data)
    })
  }, [user?.id])

  // Auto-rotate through coupons every 4 seconds
  useEffect(() => {
    if (coupons.length <= 1) return
    const t = setInterval(() => setCurrent(c => (c + 1) % coupons.length), 4000)
    return () => clearInterval(t)
  }, [coupons.length])

  if (dismissed || coupons.length === 0) return null

  const coupon = coupons[current]

  const discountLabel =
    coupon.discount_type === 'percentage'
      ? `${coupon.discount_value}% OFF`
      : `$${coupon.discount_value} OFF`

  function copyCode() {
    navigator.clipboard.writeText(coupon.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 60%, #14532d 100%)',
      borderRadius: 14,
      padding: '14px 18px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(22,163,74,0.25)',
      flexWrap: 'wrap',
    }}>
      {/* Background decorative circles */}
      <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 60, bottom: -40, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

      {/* Icon */}
      <div style={{ fontSize: 22, flexShrink: 0 }}>🎟️</div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#bbf7d0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Special Offer
          </span>
          <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {discountLabel}
          </span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {coupon.description || `Use code ${coupon.code} at checkout to get ${discountLabel}!`}
          {coupon.expires_at && (
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
              · Expires {new Date(coupon.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Code chip + copy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          border: '1.5px dashed rgba(255,255,255,0.5)',
          borderRadius: 8,
          padding: '6px 14px',
          fontFamily: 'monospace',
          fontSize: 16,
          fontWeight: 900,
          color: 'white',
          letterSpacing: '0.1em',
        }}>
          {coupon.code}
        </div>
        <button
          onClick={copyCode}
          style={{
            background: copied ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 7,
            padding: '7px 13px',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>

      {/* Dot pagination for multiple coupons */}
      {coupons.length > 1 && (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
          {coupons.map((_, i) => (
            <div
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i === current ? 'white' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.25s',
              }}
            />
          ))}
        </div>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 2, flexShrink: 0 }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
